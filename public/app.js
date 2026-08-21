const VAPID_PUBLIC_KEY='BDUS6uuXkaMBikNCYJH5jAQFl7r1_kAzgypGflVdF1L6qNiMhkTymZszPqY8ZDo3KPaUhzL6JOy6GgEcik-M_sM';
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const rawData=atob(base64);const outputArray=new Uint8Array(rawData.length);for(let i=0;i<rawData.length;i++){outputArray[i]=rawData.charCodeAt(i)}return outputArray}
async function subscribeToPush(userId){try{const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)})}const json=sub.toJSON();await api('/api/push/subscribe',{method:'POST',body:JSON.stringify({userId,endpoint:json.endpoint,keys:json.keys})})}catch(e){}}
const nav=document.getElementById('nav');
if(nav){
nav.innerHTML=`<nav class="nav"><a class="brand" href="index.html"><span class="logo">☪</span><span>International Learning Platform<small>ONLINE LEARNING</small></span></a><div class="links" id="navLinks"><a href="index.html">Home</a><a href="courses.html">Courses</a><a href="tutors.html">Find Tutors</a><a href="pricing.html">Pricing</a><a href="about.html">About</a><a class="btn ghost" href="login.html">Login</a><a class="btn primary" href="register.html">Register</a></div><span class="menu" id="navMenu">☰</span></nav>`;
const navMenu=document.getElementById('navMenu'),navLinks=document.getElementById('navLinks');
if(navMenu&&navLinks){navMenu.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');navMenu.classList.toggle('active',open);navMenu.textContent=open?'✕':'☰';});}
}
const footer=document.getElementById('footer');
if(footer){
footer.className='footer';
footer.innerHTML=`<div><h3>International Learning Platform</h3><p>Modern online learning with qualified tutors, flexible classes and a simple student experience.</p></div><div><h4>Learn</h4><a href="courses.html">Courses</a><a href="tutors.html">Tutors</a><a href="pricing.html">Pricing</a></div><div><h4>Platform</h4><a href="about.html">About us</a><a href="contact.html">Contact</a><a href="faq.html">FAQ</a></div><div><h4>Account</h4><a href="login.html">Login</a><a href="register.html">Register</a><a href="dashboard.html">Dashboard</a></div>`;
}
/* Homepage live stats: registered tutors, registered students, classes — pulled from the real backend so the numbers update automatically as people register or classes are booked. */
const statTutorsEl=document.getElementById('statTutors');
if(statTutorsEl){(async()=>{
try{
const r=await api('/api/stats');
document.getElementById('statTutors').textContent=r.tutors??0;
document.getElementById('statStudents').textContent=r.students??0;
document.getElementById('statClasses').textContent=r.classes??0;
}catch(e){}
})()}
const db={users:'ilp_users_v6',current:'ilp_current_v6',bookings:'ilp_bookings_v6',profiles:'ilp_profiles_v6',schedules:'ilp_schedules_v8',studentRequests:'ilp_student_requests_v9'};
const tutors=[
{id:'ahmad',name:'Ustadh Ahmad',subjects:'Quran • Tajweed • Hifz',langs:'English, Urdu',price:8,rating:5},
{id:'maryam',name:'Ustadha Maryam',subjects:'Kids Quran • Qaida • Tajweed',langs:'English, Urdu',price:7,rating:5},
{id:'bilal',name:'Ustadh Bilal',subjects:'Quran Reading • Arabic',langs:'English, Arabic',price:9,rating:4}
];
function read(key,fallback=[]){try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch(e){return fallback}}
function write(key,val){localStorage.setItem(key,JSON.stringify(val))}
function getUsers(){return read(db.users,[])}
function currentUser(){return read(db.current,null)}
function isTutor(u){return !!u&&String(u.role||'').toLowerCase().trim().includes('tutor')}
function setCurrent(u){write(db.current,u)}
function msg(id,text){const el=document.getElementById(id);if(el){el.textContent=text;el.style.display='block'}}
function qs(name){return new URLSearchParams(location.search).get(name)}
/* Highlight the current page in the nav — matches with or without a .html extension, and handles the root "/" path, so every page (not just Home) gets highlighted correctly. */
document.querySelectorAll('#navLinks a:not(.btn)').forEach(a=>{
let here=(location.pathname.split('/').pop()||'index.html').replace('.html','');
if(here==='')here='index';
if(here==='course')here='courses';
const linkPage=(a.getAttribute('href')||'').replace('.html','');
a.classList.toggle('active',linkPage===here);
});
/* Lock feature buttons/links until the visitor has registered or logged in — the page itself stays reachable, only the action inside is disabled */
document.querySelectorAll('.requires-auth').forEach(el=>{
if(!currentUser()){
el.classList.add('locked');
el.setAttribute('aria-disabled','true');
if(el.tagName==='A')el.removeAttribute('href');
if(!el.dataset.lockLabelled){el.dataset.lockLabelled='1';el.innerHTML='🔒 '+el.innerHTML;}
el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
}
});
/* ---- Server API helpers: real online backend (D1 via Worker), replaces per-device localStorage for users/profiles/requests ---- */
async function api(path,options={}){
const res=await fetch(path,{headers:{'Content-Type':'application/json'},...options});
let data={};
try{data=await res.json()}catch(e){}
if(!res.ok) throw new Error(data.error||'Request failed');
return data;
}
/* Notification foundation: registers the service worker and lets each user enable Android/web notifications. */
async function registerNotifications(){
try{
if(!('serviceWorker' in navigator)) return false;
await navigator.serviceWorker.register('sw.js');
return true;
}catch(e){return false}
}
async function enableNotifications(){
const status=document.getElementById('notificationStatus');
try{
if(!('Notification' in window)){if(status)status.textContent='This browser does not support web notifications.';return false}
await registerNotifications();
const permission=await Notification.requestPermission();
if(permission==='granted'){
if(status)status.textContent='Notifications are enabled on this device.';
localStorage.setItem('ilp_notifications_enabled','yes');
const cu=currentUser();if(cu)subscribeToPush(cu.id);
return true;
}
if(status)status.textContent='Notifications are blocked. Allow them in browser settings to receive alerts.';
return false;
}catch(e){if(status)status.textContent='Could not enable notifications on this device.';return false}
}
registerNotifications();
if(document.getElementById('enableNotifications')){
document.getElementById('enableNotifications').addEventListener('click',enableNotifications);
if(localStorage.getItem('ilp_notifications_enabled')==='yes') document.getElementById('notificationStatus').textContent='Notifications are enabled on this device.';
}
/* Country list: displayed in A-Z order. Calling codes are used for the phone prefix. */
const countries=[
['Afghanistan','+93'],['Albania','+355'],['Algeria','+213'],['Andorra','+376'],['Angola','+244'],['Antigua and Barbuda','+1-268'],['Argentina','+54'],['Armenia','+374'],['Australia','+61'],['Austria','+43'],['Azerbaijan','+994'],
['Bahamas','+1-242'],['Bahrain','+973'],['Bangladesh','+880'],['Barbados','+1-246'],['Belarus','+375'],['Belgium','+32'],['Belize','+501'],['Benin','+229'],['Bhutan','+975'],['Bolivia','+591'],['Bosnia and Herzegovina','+387'],['Botswana','+267'],['Brazil','+55'],['Brunei','+673'],['Bulgaria','+359'],['Burkina Faso','+226'],['Burundi','+257'],
['Cabo Verde','+238'],['Cambodia','+855'],['Cameroon','+237'],['Canada','+1'],['Central African Republic','+236'],['Chad','+235'],['Chile','+56'],['China','+86'],['Colombia','+57'],['Comoros','+269'],['Congo, Democratic Republic of the','+243'],['Congo, Republic of the','+242'],['Costa Rica','+506'],['Croatia','+385'],['Cuba','+53'],['Cyprus','+357'],['Czechia','+420'],
['Denmark','+45'],['Djibouti','+253'],['Dominica','+1-767'],['Dominican Republic','+1-809'],
['Ecuador','+593'],['Egypt','+20'],['El Salvador','+503'],['Equatorial Guinea','+240'],['Eritrea','+291'],['Estonia','+372'],['Eswatini','+268'],['Ethiopia','+251'],
['Fiji','+679'],['Finland','+358'],['France','+33'],
['Gabon','+241'],['Gambia','+220'],['Georgia','+995'],['Germany','+49'],['Ghana','+233'],['Greece','+30'],['Grenada','+1-473'],['Guatemala','+502'],['Guinea','+224'],['Guinea-Bissau','+245'],['Guyana','+592'],
['Haiti','+509'],['Honduras','+504'],['Hungary','+36'],
['Iceland','+354'],['India','+91'],['Indonesia','+62'],['Iran','+98'],['Iraq','+964'],['Ireland','+353'],['Israel','+972'],['Italy','+39'],['Ivory Coast','+225'],
['Jamaica','+1-876'],['Japan','+81'],['Jordan','+962'],
['Kazakhstan','+7'],['Kenya','+254'],['Kiribati','+686'],['Kuwait','+965'],['Kyrgyzstan','+996'],
['Laos','+856'],['Latvia','+371'],['Lebanon','+961'],['Lesotho','+266'],['Liberia','+231'],['Libya','+218'],['Liechtenstein','+423'],['Lithuania','+370'],['Luxembourg','+352'],
['Madagascar','+261'],['Malawi','+265'],['Malaysia','+60'],['Maldives','+960'],['Mali','+223'],['Malta','+356'],['Marshall Islands','+692'],['Mauritania','+222'],['Mauritius','+230'],['Mexico','+52'],['Micronesia','+691'],['Moldova','+373'],['Monaco','+377'],['Mongolia','+976'],['Montenegro','+382'],['Morocco','+212'],['Mozambique','+258'],['Myanmar','+95'],
['Namibia','+264'],['Nauru','+674'],['Nepal','+977'],['Netherlands','+31'],['New Zealand','+64'],['Nicaragua','+505'],['Niger','+227'],['Nigeria','+234'],['North Korea','+850'],['North Macedonia','+389'],['Norway','+47'],
['Oman','+968'],
['Pakistan','+92'],['Palau','+680'],['Palestine','+970'],['Panama','+507'],['Papua New Guinea','+675'],['Paraguay','+595'],['Peru','+51'],['Philippines','+63'],['Poland','+48'],['Portugal','+351'],
['Qatar','+974'],
['Romania','+40'],['Russia','+7'],['Rwanda','+250'],
['Saint Kitts and Nevis','+1-869'],['Saint Lucia','+1-758'],['Saint Vincent and the Grenadines','+1-784'],['Samoa','+685'],['San Marino','+378'],['Sao Tome and Principe','+239'],['Saudi Arabia','+966'],['Senegal','+221'],['Serbia','+381'],['Seychelles','+248'],['Sierra Leone','+232'],['Singapore','+65'],['Slovakia','+421'],['Slovenia','+386'],['Solomon Islands','+677'],['Somalia','+252'],['South Africa','+27'],['South Korea','+82'],['South Sudan','+211'],['Spain','+34'],['Sri Lanka','+94'],['Sudan','+249'],['Suriname','+597'],['Sweden','+46'],['Switzerland','+41'],['Syria','+963'],
['Taiwan','+886'],['Tajikistan','+992'],['Tanzania','+255'],['Thailand','+66'],['Timor-Leste','+670'],['Togo','+228'],['Tonga','+676'],['Trinidad and Tobago','+1-868'],['Tunisia','+216'],['Turkey','+90'],['Turkmenistan','+993'],['Tuvalu','+688'],
['Uganda','+256'],['Ukraine','+380'],['United Arab Emirates','+971'],['United Kingdom','+44'],['United States','+1'],['Uruguay','+598'],['Uzbekistan','+998'],
['Vanuatu','+678'],['Vatican City','+39'],['Venezuela','+58'],['Vietnam','+84'],
['Yemen','+967'],
['Zambia','+260'],['Zimbabwe','+263']
];
const countrySelect=document.getElementById('country');
const phoneCode=document.getElementById('phoneCode');
if(countrySelect){
countries.forEach(([name,code])=>{const o=document.createElement('option');o.value=name;o.textContent=`${name} (${code})`;o.dataset.code=code;countrySelect.appendChild(o)});
const updateCode=()=>{const opt=countrySelect.options[countrySelect.selectedIndex];phoneCode&&(phoneCode.textContent=opt?.dataset.code||'+—')};
countrySelect.addEventListener('change',updateCode);
countrySelect.dataset.updateCode='true';
}
const rolePicker=document.getElementById('rolePicker');
const roleSelect=document.getElementById('role');
if(rolePicker&&roleSelect){
rolePicker.querySelectorAll('.role-card').forEach(card=>{
card.addEventListener('click',()=>{
rolePicker.querySelectorAll('.role-card').forEach(c=>c.classList.remove('selected'));
card.classList.add('selected');
roleSelect.value=card.dataset.role;
});
});
}
const reg=document.getElementById('registerForm');
if(reg){reg.addEventListener('submit',async e=>{e.preventDefault();
if(rolePicker&&!rolePicker.querySelector('.selected')){msg('registerMsg','Please choose Student or Tutor above first.');return}
const email=document.getElementById('email').value.trim().toLowerCase();const selectedRole=document.getElementById('role').value;try{const {user}=await api('/api/register',{method:'POST',body:JSON.stringify({firstName:document.getElementById('firstName').value.trim(),lastName:document.getElementById('lastName').value.trim(),email,password:document.getElementById('password').value,role:selectedRole})});setCurrent(user);location.href='profile.html';}catch(err){msg('registerMsg',err.message||'This email is already registered. Please login.')}});}
const login=document.getElementById('loginForm');
if(login){login.addEventListener('submit',async e=>{e.preventDefault();const email=document.getElementById('loginEmail').value.trim().toLowerCase(),password=document.getElementById('loginPassword').value;try{const {user}=await api('/api/login',{method:'POST',body:JSON.stringify({email,password})});setCurrent(user);location.href=isTutor(user)?'tutor-dashboard.html':'dashboard.html';}catch(err){msg('loginMsg',err.message||'Email or password is incorrect.')}});}
document.getElementById('logoutLink')?.addEventListener('click',e=>{e.preventDefault();localStorage.removeItem(db.current);location.href='index.html';});
if(location.pathname.endsWith('dashboard.html')||location.pathname.endsWith('/dashboard')){const u=currentUser();if(!u){location.href='login.html'}else if(isTutor(u)){location.href='tutor-dashboard.html'}else{(async()=>{
try{
const bookings=read(db.bookings,[]).filter(b=>b.userId===u.id);
let requests=[];
let debugMsg='';
let p={};
try{const pr=await api(`/api/profile?userId=${encodeURIComponent(u.id)}`);p=pr.profile||{}}catch(e){}
try{const r=await api(`/api/requests?studentId=${encodeURIComponent(u.id)}`);requests=r.requests||[];debugMsg=`DEBUG: fetched ok, userId=${u.id}, requests found=${requests.length}, raw=${JSON.stringify(r).slice(0,300)}`}catch(e){debugMsg='DEBUG: fetch failed: '+(e&&e.message||e)}
document.getElementById('welcome').textContent=`Assalamu Alaikum, ${u.firstName||'Learner'} 👋`;
document.getElementById('roleLabel').textContent='STUDENT DASHBOARD';
document.getElementById('dashIntro').textContent='Track your trial requests, classes and learning journey.';
const studentSummary=document.getElementById('profileSummary');
if(studentSummary){const fullName=`${u.firstName||''} ${u.lastName||''}`.trim()||'Student';studentSummary.innerHTML=`<div class="ph">${p.profilePicture?`<img src="${escapeHtml(p.profilePicture)}" alt="${escapeHtml(fullName)}">`:'🧑‍🎓'}</div><div><div class="psu-name">${escapeHtml(fullName)}</div><div class="psu-meta">${escapeHtml(p.country||'Country not added')}${p.subjects?` • Learning: ${escapeHtml(p.subjects)}`:''}</div></div>`;}
document.getElementById('stat1').textContent=bookings.length;
document.getElementById('stat2').textContent='0%';
document.getElementById('stat3').textContent=bookings.filter(b=>b.status!=='cancelled').length;
document.getElementById('stat1Label').textContent='Bookings';
document.getElementById('stat2Label').textContent='Progress';
document.getElementById('stat3Label').textContent='Upcoming classes';
document.getElementById('sectionTitle').textContent='My bookings';
const html=bookings.length?bookings.map(b=>`<div class="booking-row"><div><strong>${b.course}</strong><p>${b.tutor||'Tutor matching requested'} • ${b.time?new Date(b.time).toLocaleString():'Time to be arranged'}</p></div><span class="pill">${b.status||'requested'}</span></div>`).join(''):'<p style="color:var(--muted)">No bookings yet.</p>';
const pendingCount=requests.filter(r=>r.status==='pending').length;
const requestHtml=requests.length?`<div class="panel" style="margin-top:18px"><h2>${pendingCount?`🔔 New Tutor Request${pendingCount>1?'s':''}`:'Tutor requests'}</h2>${requests.map(r=>`<div class="request-row"><div><strong>${r.tutorName||'Tutor'}</strong><p>${r.status==='pending'?`${escapeHtml(r.tutorName||'A tutor')} wants to teach you.`:''} Sent ${new Date(r.createdAt).toLocaleString()}</p></div><span class="pill">${r.status||'pending'}</span>${r.status==='pending'?`<div class="request-actions"><button class="btn primary" data-request-action="accepted" data-request-id="${r.id}">Accept</button><button class="btn ghost" data-request-action="declined" data-request-id="${r.id}">Decline</button></div>`:''}</div>`).join('')}</div>`:'';
document.getElementById('dashContent').innerHTML=html+`<div class="actions"><a class="btn primary" href="trial.html">Book Free Trial</a><a class="btn ghost" href="tutors.html">Find a Tutor</a><a class="btn ghost" href="profile.html">My Profile</a></div>`+requestHtml+`<div class="notification-card"><div><strong>🔔 Phone notifications</strong><p id="notificationStatus">Turn on notifications so new tutor requests can appear in your Android notification menu.</p></div><button class="btn primary" id="enableNotifications">Enable Notifications</button></div>`;
document.getElementById('enableNotifications')?.addEventListener('click',enableNotifications);
if(localStorage.getItem('ilp_notifications_enabled')==='yes')document.getElementById('notificationStatus').textContent='Notifications are enabled on this device.';
document.querySelectorAll('[data-request-action]').forEach(btn=>btn.addEventListener('click',async()=>{
try{await api(`/api/requests/${encodeURIComponent(btn.dataset.requestId)}/status`,{method:'POST',body:JSON.stringify({status:btn.dataset.requestAction})});location.reload()}catch(e){}
}));
const dbgEl=document.createElement('pre');dbgEl.style.cssText='white-space:pre-wrap;font-size:11px;background:#eee;padding:10px;margin-top:20px;border-radius:6px;word-break:break-all';dbgEl.textContent=debugMsg;document.getElementById('dashContent').appendChild(dbgEl);
}catch(err){
document.getElementById('dashContent').innerHTML=`<pre style="white-space:pre-wrap;font-size:11px;background:#fee;padding:10px;border-radius:6px;word-break:break-all">JS ERROR: ${(err&&err.stack)||err}</pre>`;
}
})()}}
if(location.pathname.endsWith('tutor-dashboard.html')||location.pathname.endsWith('/tutor-dashboard')){const u=currentUser();if(!u){location.href='login.html'}else if(!isTutor(u)){location.href='dashboard.html'}else{(async()=>{
let p={};
try{const pr=await api(`/api/profile?userId=${encodeURIComponent(u.id)}`);p=pr.profile||{}}catch(e){}
const bookings=read(db.bookings,[]).filter(b=>b.tutorId===u.id);
let requests=[];
try{const r=await api(`/api/requests?tutorId=${encodeURIComponent(u.id)}`);requests=r.requests||[]}catch(e){}
document.getElementById('tutorWelcome').textContent=`Assalamu Alaikum, ${u.firstName||'Tutor'} 👋`;
document.getElementById('tutorEmail').textContent=u.email;
document.getElementById('tutorSubjects').textContent=p.subjects||'Quran • Tajweed • Hifz';
document.getElementById('tutorStatus').textContent=p.bio?'Profile ready':'Complete your profile';
const tutorSummary=document.getElementById('profileSummary');
if(tutorSummary){const fullName=`${u.firstName||''} ${u.lastName||''}`.trim()||'Tutor';tutorSummary.innerHTML=`<div class="ph">${p.profilePicture?`<img src="${escapeHtml(p.profilePicture)}" alt="${escapeHtml(fullName)}">`:'👨‍🏫'}</div><div><div class="psu-name">${escapeHtml(fullName)}</div><div class="psu-meta">${escapeHtml(p.country||'Country not added')}${p.languages?` • ${escapeHtml(p.languages)}`:''}${p.price?` • $${escapeHtml(p.price)}/class`:''}</div></div>`;}
document.getElementById('tutorRequests').textContent=requests.filter(r=>r.status==='pending').length+bookings.length;
document.getElementById('tutorUpcoming').textContent=bookings.filter(b=>b.status!=='cancelled').length;
document.getElementById('tutorProfileLink').href='profile.html';
document.getElementById('studentRequests').innerHTML=requests.length?requests.map(r=>{return `<div class="request-row"><div class="request-avatar">👤</div><div class="request-main"><strong>${r.studentName||'Student'}</strong><p>${r.studentCountry||'Country not added'}${r.studentSubjects?' • Wants: '+r.studentSubjects:''}</p><small>${r.status==='pending'?'Waiting for student response':'Request '+r.status} • ${new Date(r.createdAt).toLocaleString()}</small></div><span class="pill">${r.status||'pending'}</span></div>`}).join(''):'<p style="color:var(--muted)">No student requests yet. Open Find Students to discover learners.</p>';
document.getElementById('tutorBookings').innerHTML=bookings.length?`<h3 style="margin-top:22px">Class bookings</h3>`+bookings.map(b=>`<div class="booking-row"><div><strong>${b.course||'Quran lesson'}</strong><p>${b.student||'Student'} • ${b.time?new Date(b.time).toLocaleString():'Time to be arranged'}</p></div><span class="pill">${b.status||'requested'}</span></div>`).join(''):'';
if(document.getElementById('enableNotifications'))document.getElementById('enableNotifications').addEventListener('click',enableNotifications);
if(localStorage.getItem('ilp_notifications_enabled')==='yes')subscribeToPush(u.id);
})()}}
const profileForm=document.getElementById('profileForm');
if(profileForm){
const u=currentUser();
if(!u){location.href='login.html'}else{(async()=>{
let p={};
try{const pr=await api(`/api/profile?userId=${encodeURIComponent(u.id)}`);p=pr.profile||{}}catch(e){}
['bio','subjects','experience','qualification','price','learningGoal'].forEach(k=>{const el=document.getElementById(k);if(el)el.value=p[k]??''});
const langEl=document.getElementById(isTutor(u)?'tutorLanguages':'languages');if(langEl)langEl.value=p.languages??'';
const phone=document.getElementById('phone');if(phone)phone.value=p.phone||'';
if(countrySelect){countrySelect.value=p.country||'';const opt=countrySelect.options[countrySelect.selectedIndex];if(phoneCode)phoneCode.textContent=opt?.dataset.code||'+—'}
const tutorFields=document.querySelectorAll('[data-tutor-only]');tutorFields.forEach(el=>el.style.display=isTutor(u)?'':'none');
const studentFields=document.querySelectorAll('[data-student-only]');studentFields.forEach(el=>el.style.display=isTutor(u)?'none':'');
document.getElementById('profileHeading')?.replaceChildren(document.createTextNode(isTutor(u)?'Tutor Profile':'Student Profile'));
const preview=document.getElementById('profilePicturePreview');if(preview&&p.profilePicture){preview.style.display='block';preview.innerHTML=`<img src="${p.profilePicture}" alt="Profile picture">`}
const pic=document.getElementById('profilePicture');if(pic)pic.addEventListener('change',()=>{const file=pic.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const size=256,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');const scale=Math.max(size/img.width,size/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);const data=canvas.toDataURL('image/jpeg',.78);pic.dataset.imageData=data;if(preview){preview.style.display='block';preview.innerHTML=`<img src="${data}" alt="Profile picture">`}};img.src=reader.result};reader.readAsDataURL(file)});
profileForm.addEventListener('submit',async e=>{e.preventDefault();const opt=countrySelect?.options[countrySelect.selectedIndex];const imageData=document.getElementById('profilePicture')?.dataset.imageData;const langVal=(isTutor(u)?document.getElementById('tutorLanguages'):document.getElementById('languages'))?.value||'';const body={userId:u.id,phone:phone?.value?.trim()||'',phoneCode:opt?.dataset.code||'',country:countrySelect?.value||'',bio:document.getElementById('bio')?.value||'',subjects:document.getElementById('subjects')?.value||'',languages:langVal,learningGoal:document.getElementById('learningGoal')?.value||'',experience:document.getElementById('experience')?.value||'',qualification:document.getElementById('qualification')?.value||'',price:document.getElementById('price')?.value||'',profilePicture:imageData||p.profilePicture||''};try{await api('/api/profile',{method:'POST',body:JSON.stringify(body)});msg('profileMsg',(isTutor(u)?'Tutor profile saved. Taking you to your dashboard…':'Student profile saved. Taking you to your dashboard…'));setTimeout(()=>{location.href=isTutor(u)?'tutor-dashboard.html':'dashboard.html'},900)}catch(err){msg('profileMsg','Could not save profile. Please try again.')}});
})()}
}
/* Tutor monthly schedule */
const scheduleList=document.getElementById('scheduleList');
if(scheduleList){
const u=currentUser();
if(!u){location.href='login.html'}else if(!isTutor(u)){location.href='dashboard.html'}else{
let view=new Date();view.setDate(1);
const schedules=read(db.schedules,{});
const key=()=>`${u.id}_${view.getFullYear()}-${String(view.getMonth()+1).padStart(2,'0')}`;
const monthName=()=>view.toLocaleString('en-US',{month:'long',year:'numeric'});
const render=()=>{
document.getElementById('monthTitle').textContent=monthName();
const monthKey=key();const saved=schedules[monthKey]||{};const total=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();let html='';
for(let day=1;day<=total;day++){
const d=new Date(view.getFullYear(),view.getMonth(),day);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const item=saved[iso]||{};
html+=`<div class="schedule-row" data-date="${iso}"><div class="schedule-date"><strong>${day}</strong><span>${d.toLocaleDateString('en-US',{weekday:'long'})}</span></div><label class="check-wrap"><input type="checkbox" class="day-available" ${item.available?'checked':''}> <span>Available</span></label><div class="time-fields"><label>From<input type="time" class="start-time" value="${item.start||''}"></label><label>To<input type="time" class="end-time" value="${item.end||''}"></label></div></div>`;
}
scheduleList.innerHTML=html;
};
document.getElementById('prevMonth').onclick=()=>{view.setMonth(view.getMonth()-1);render()};
document.getElementById('nextMonth').onclick=()=>{view.setMonth(view.getMonth()+1);render()};
document.getElementById('saveSchedule').onclick=()=>{const monthKey=key();const data={};document.querySelectorAll('.schedule-row').forEach(row=>{data[row.dataset.date]={available:row.querySelector('.day-available').checked,start:row.querySelector('.start-time').value,end:row.querySelector('.end-time').value}});schedules[monthKey]=data;write(db.schedules,schedules);msg('scheduleMsg',`Schedule saved for ${monthName()}.`)};
document.getElementById('clearMonth').onclick=()=>{if(confirm(`Clear the schedule for ${monthName()}?`)){delete schedules[key()];write(db.schedules,schedules);render();msg('scheduleMsg',`Schedule cleared for ${monthName()}.`)}};
render();
}
}
function escapeHtml(v){return String(v??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function countryMatch(profile,q){return [profile.country,profile.phoneCode].filter(Boolean).join(' ').toLowerCase().includes(q)}
const studentResults=document.getElementById('studentResults');
if(studentResults){
const u=currentUser();
if(!u||!isTutor(u)){location.href=u?'dashboard.html':'login.html'}else{(async()=>{
let allStudents=[],allRequests=[];
try{const r=await api('/api/users?role=student');allStudents=r.users||[]}catch(e){}
try{const r=await api(`/api/requests?tutorId=${encodeURIComponent(u.id)}`);allRequests=r.requests||[]}catch(e){}
const profileCache={};
const getProfile=async(id)=>{if(profileCache[id])return profileCache[id];try{const r=await api(`/api/profile?userId=${encodeURIComponent(id)}`);profileCache[id]=r.profile||{}}catch(e){profileCache[id]={}}return profileCache[id]};
const renderStudents=async()=>{
const q=(document.getElementById('studentSearch')?.value||'').trim().toLowerCase();
const rows=[];
for(const st of allStudents){
const p=await getProfile(st.id);
const text=[st.firstName,st.lastName,p.country,p.languages,p.subjects,p.learningGoal,p.bio].filter(Boolean).join(' ').toLowerCase();
let score=1;
if(q){
if(countryMatch(p,q)) score=3;
else if(`${st.firstName||''} ${st.lastName||''}`.toLowerCase().includes(q)) score=2;
else if(text.includes(q)) score=1;
else score=0;
}
if(score>0) rows.push({st,p,score});
}
rows.sort((a,b)=>b.score-a.score);
document.getElementById('studentEmpty').style.display=rows.length?'none':'block';
studentResults.innerHTML=rows.map(({st,p})=>{
const pending=allRequests.some(r=>r.studentId===st.id&&r.status==='pending');
const sent=allRequests.some(r=>r.studentId===st.id&&r.status==='accepted');
const fullName=(`${st.firstName||''} ${st.lastName||''}`).trim()||'Student';
return `<div class="student-card"><div class="student-photo">${p.profilePicture?`<img src="${escapeHtml(p.profilePicture)}" alt="${escapeHtml(fullName)}">`:'👤'}</div><div class="student-body"><h3>${escapeHtml(fullName)}</h3><div class="student-meta">${escapeHtml(p.country||'Country not added')}${p.languages?` • ${escapeHtml(p.languages)}`:''}</div><p>${escapeHtml(p.bio||'Student profile — learning Quran online.')}</p><div class="student-learning"><strong>Wants to learn:</strong> ${escapeHtml(p.subjects||'Quran')}${p.learningGoal?`<br><span>${escapeHtml(p.learningGoal)}</span>`:''}</div>${sent?'<button class="btn ghost full" disabled>Request accepted</button>':pending?'<button class="btn ghost full" disabled>Request sent</button>':`<button class="btn primary full send-student-request" data-student-id="${escapeHtml(st.id)}">Send a Request</button>`}</div></div>`;
}).join('');
document.querySelectorAll('.send-student-request').forEach(btn=>btn.addEventListener('click',async()=>{
const student=allStudents.find(x=>String(x.id)===String(btn.dataset.studentId));
if(!student)return;
if(allRequests.some(r=>r.studentId===student.id&&r.status==='pending'))return;
const p=await getProfile(student.id);
try{
const {request}=await api('/api/requests',{method:'POST',body:JSON.stringify({tutorId:u.id,tutorName:`${u.firstName||''} ${u.lastName||''}`.trim()||'Tutor',studentId:student.id,studentName:`${student.firstName||''} ${student.lastName||''}`.trim()||'Student',studentCountry:p.country||'',studentSubjects:p.subjects||''})});
allRequests.push(request);
}catch(e){}
renderStudents();
}));
};
renderStudents();
document.getElementById('studentSearch')?.addEventListener('input',renderStudents);
})()}
}
const tutorSearch=document.getElementById('tutorSearch');
if(tutorSearch){tutorSearch.addEventListener('input',()=>{const q=tutorSearch.value.toLowerCase();document.querySelectorAll('[data-tutor]').forEach(el=>el.style.display=el.dataset.tutor.toLowerCase().includes(q)?'':'none');});}
function openModal(){document.querySelector('.modal')?.classList.add('show')}
function closeModal(){document.querySelector('.modal')?.classList.remove('show')}
