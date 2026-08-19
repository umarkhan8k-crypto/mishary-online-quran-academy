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

async function handleApi(request, env, url) {
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
    return json({ request: updated });
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: 'Server error', detail: String(err) }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
