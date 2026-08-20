// International Learning Platform — Worker backend
// Serves the static site (via ASSETS binding) and handles /api/* routes using the D1 binding (DB).

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

/* ---- Web Push helpers ---- */
function b64uToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concatBytes(...arrs) {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}
async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, dataBytes));
}
async function hkdf(salt, ikm, info, length) {
  const prk = await hmacSha256(salt, ikm);
  const t = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return t.slice(0, length);
}
async function vapidJwt(env, audience) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:admin@ilp-app.com' };
  const enc = s => bytesToB64u(new TextEncoder().encode(JSON.stringify(s)));
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const pubBytes = b64uToBytes(env.VAPID_PUBLIC_KEY);
  const x = pubBytes.slice(1, 33), y = pubBytes.slice(33, 65);
  const jwk = { kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE_KEY, x: bytesToB64u(x), y: bytesToB64u(y), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${bytesToB64u(sig)}`;
}
async function sendPushToUser(env, userId, payload) {
  try {
    const sub = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE userId = ?').bind(userId).first();
    if (!sub) return;
    const uaPublic = b64uToBytes(sub.p256dh);
    const authSecret = b64uToBytes(sub.auth);
    const asKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey));
    const uaPublicKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, asKeyPair.privateKey, 256));
    const keyInfo = concatBytes(new TextEncoder().encode('WebPush: info\0'), uaPublic, asPublicRaw);
    const prkKey = await hmacSha256(authSecret, sharedSecret);
    const ikm = (await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([1])))).slice(0, 32);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const prk = await hmacSha256(salt, ikm);
    const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
    const plaintext = concatBytes(new TextEncoder().encode(JSON.stringify(payload)), new Uint8Array([2]));
    const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, plaintext));
    const rs = new Uint8Array([0, 0, 16, 0]);
    const body = concatBytes(salt, rs, new Uint8Array([65]), asPublicRaw, ciphertext);
    const audience = new URL(sub.endpoint).origin;
    const jwt = await vapidJwt(env, audience);
    await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      },
      body,
    });
  } catch (e) { /* ignore push failures */ }
}

async function handleApi(request, env, url, ctx) {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/register' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return json({ error: 'Email and password are required.' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'This email is already registered. Please login.' }, 409);

    const role = String(body.role || '').toLowerCase().includes('tutor') ? 'tutor' : 'student';
    const user = {
      id: uid(),
      firstName: String(body.firstName || '').trim(),
      lastName: String(body.lastName || '').trim(),
      email,
      password,
      role,
      createdAt: new Date().toISOString(),
    };
    await env.DB.prepare(
      'INSERT INTO users (id, firstName, lastName, email, password, role, createdAt) VALUES (?,?,?,?,?,?,?)'
    ).bind(user.id, user.firstName, user.lastName, user.email, user.password, user.role, user.createdAt).run();

    return json({ user: publicUser(user) });
  }

  if (path === '/api/login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND password = ?')
      .bind(email, password).first();
    if (!user) return json({ error: 'Email or password is incorrect.' }, 401);
    return json({ user: publicUser(user) });
  }

  if (path === '/api/users' && method === 'GET') {
    const role = url.searchParams.get('role');
    const rows = role
      ? await env.DB.prepare('SELECT * FROM users WHERE role = ?').bind(role).all()
      : await env.DB.prepare('SELECT * FROM users').all();
    return json({ users: rows.results.map(publicUser) });
  }

  if (path === '/api/profile' && method === 'GET') {
    const userId = url.searchParams.get('userId');
    if (!userId) return json({ error: 'userId is required.' }, 400);
    const profile = await env.DB.prepare('SELECT * FROM profiles WHERE userId = ?').bind(userId).first();
    return json({ profile: profile || null });
  }

  if (path === '/api/profile' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId;
    if (!userId) return json({ error: 'userId is required.' }, 400);
    const fields = ['phone', 'phoneCode', 'country', 'bio', 'subjects', 'languages', 'learningGoal', 'experience', 'qualification', 'price', 'profilePicture'];
    const values = fields.map(f => body[f] ?? '');
    await env.DB.prepare(
      `INSERT INTO profiles (userId, ${fields.join(',')}) VALUES (?, ${fields.map(() => '?').join(',')})
       ON CONFLICT(userId) DO UPDATE SET ${fields.map(f => `${f}=excluded.${f}`).join(',')}`
    ).bind(userId, ...values).run();
    return json({ ok: true });
  }

  if (path === '/api/push/subscribe' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!body.userId || !body.endpoint || !body.keys) return json({ error: 'Invalid subscription.' }, 400);
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (userId, endpoint, p256dh, auth, createdAt) VALUES (?,?,?,?,?)
       ON CONFLICT(userId) DO UPDATE SET endpoint=excluded.endpoint, p256dh=excluded.p256dh, auth=excluded.auth`
    ).bind(body.userId, body.endpoint, body.keys.p256dh, body.keys.auth, new Date().toISOString()).run();
    return json({ ok: true });
  }

  if (path === '/api/requests' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!body.tutorId || !body.studentId) return json({ error: 'tutorId and studentId are required.' }, 400);

    const dup = await env.DB.prepare(
      "SELECT id FROM requests WHERE tutorId = ? AND studentId = ? AND status = 'pending'"
    ).bind(body.tutorId, body.studentId).first();
    if (dup) return json({ request: dup });

    const reqRow = {
      id: body.id || uid(),
      tutorId: body.tutorId,
      tutorName: body.tutorName || 'Tutor',
      studentId: body.studentId,
      studentName: body.studentName || 'Student',
      status: 'pending',
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: null,
      studentCountry: body.studentCountry || '',
      studentSubjects: body.studentSubjects || '',
    };
    await env.DB.prepare(
      'INSERT INTO requests (id, tutorId, tutorName, studentId, studentName, status, createdAt, updatedAt, studentCountry, studentSubjects) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).bind(reqRow.id, reqRow.tutorId, reqRow.tutorName, reqRow.studentId, reqRow.studentName, reqRow.status, reqRow.createdAt, reqRow.updatedAt, reqRow.studentCountry, reqRow.studentSubjects).run();

    ctx.waitUntil(sendPushToUser(env, reqRow.studentId, { title: 'New tutor request', body: `${reqRow.tutorName} wants to teach you.`, url: '/dashboard.html' }));

    return json({ request: reqRow });
  }

  if (path === '/api/requests' && method === 'GET') {
    const tutorId = url.searchParams.get('tutorId');
    const studentId = url.searchParams.get('studentId');
    let rows;
    if (tutorId) rows = await env.DB.prepare('SELECT * FROM requests WHERE tutorId = ? ORDER BY createdAt DESC').bind(tutorId).all();
    else if (studentId) rows = await env.DB.prepare('SELECT * FROM requests WHERE studentId = ? ORDER BY createdAt DESC').bind(studentId).all();
    else rows = await env.DB.prepare('SELECT * FROM requests ORDER BY createdAt DESC').all();
    return json({ requests: rows.results });
  }

  if (path.startsWith('/api/requests/') && path.endsWith('/status') && method === 'POST') {
    const id = path.split('/')[3];
    const body = await request.json().catch(() => ({}));
    const status = body.status === 'accepted' ? 'accepted' : body.status === 'declined' ? 'declined' : null;
    if (!status) return json({ error: 'status must be accepted or declined.' }, 400);
    await env.DB.prepare('UPDATE requests SET status = ?, updatedAt = ? WHERE id = ?')
      .bind(status, new Date().toISOString(), id).run();
    const updated = await env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first();

    if (updated) {
      ctx.waitUntil(sendPushToUser(env, updated.tutorId, { title: 'Request update', body: `${updated.studentName} ${status} your request.`, url: '/tutor-dashboard.html' }));
    }

    return json({ request: updated });
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url, ctx);
      } catch (err) {
        return json({ error: 'Server error', detail: String(err) }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

