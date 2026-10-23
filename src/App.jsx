import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from './apiClient.js';
import { QRCodeSVG } from 'qrcode.react';
import { Activity, AlertTriangle, Bell, Building2, CheckCircle2, ChevronRight, ClipboardList, Gauge, GraduationCap, HardHat, LayoutDashboard, LogOut, MapPinned, Menu, Plus, QrCode, RadioTower, Shield, ShieldAlert, ShieldCheck, Users, Wrench, X, RefreshCw, Search, Clock3, CircleHelp, Settings, Send, Check, ExternalLink } from 'lucide-react';

const supabase = createClient();
const BUILDINGS = [
  { id: 'B1', name: 'Academic Block', short: 'Academic', x: 22, y: 28, type: 'Teaching' },
  { id: 'B2', name: 'Central Library', short: 'Library', x: 52, y: 18, type: 'Library' },
  { id: 'B3', name: 'Science Laboratory', short: 'Laboratory', x: 76, y: 33, type: 'Laboratory' },
  { id: 'B4', name: 'Student Hostel', short: 'Hostel', x: 27, y: 68, type: 'Residential' },
  { id: 'B5', name: 'Administration Block', short: 'Admin', x: 53, y: 53, type: 'Office' },
  { id: 'B6', name: 'Auditorium & Events Hall', short: 'Auditorium', x: 77, y: 73, type: 'Events' },
];
const ROLES = {
  student: { label: 'User', icon: Users, intro: 'Report issues and follow their progress.' },
  maintenance: { label: 'Maintenance staff', icon: Wrench, intro: 'Manage assigned work and close repair jobs.' },
  security: { label: 'Security staff', icon: ShieldCheck, intro: 'Monitor building alerts and safety incidents.' },
  admin: { label: 'Administrator', icon: Settings, intro: 'Oversee buildings, people and building operations.' },
};
const DEMO_USERS = {
  student: { id: 'demo-student', email: 'student@demo.campus', role: 'student', full_name: 'Demo User' },
  maintenance: { id: 'demo-maintenance', email: 'maintenance@demo.campus', role: 'maintenance', full_name: 'Demo Maintenance' },
  security: { id: 'demo-security', email: 'security@demo.campus', role: 'security', full_name: 'Demo Security' },
  admin: { id: 'demo-admin', email: 'admin@demo.campus', role: 'admin', full_name: 'Demo Administrator' },
};
const seedRequests = [
  { id: 'MNT-410', title: 'Pre-event equipment check', building_id: 'B6', area: 'Main hall', category: 'Equipment', priority: 'High', status: 'In progress', description: 'Check microphones and stage lighting before the event.', reporter_name: 'Events Office', assigned_to: 'Maintenance Team', created_at: new Date(Date.now()-1000*60*60*5).toISOString() },
  { id: 'MNT-411', title: 'Reading-room light inspection', building_id: 'B2', area: 'Reading room', category: 'Electrical', priority: 'Medium', status: 'Pending', description: 'Inspect a flickering light fixture.', reporter_name: 'Demo User', assigned_to: '', created_at: new Date(Date.now()-1000*60*60*3).toISOString() },
  { id: 'MNT-412', title: 'Washroom tap leak', building_id: 'B4', area: 'Ground floor washroom', category: 'Plumbing', priority: 'Low', status: 'Resolved', description: 'Sample completed repair request.', reporter_name: 'Demo User', assigned_to: 'Maintenance Team', created_at: new Date(Date.now()-1000*60*60*28).toISOString() },
];
const seedAlerts = [
  { id: 'ALT-204', title: 'Temperature threshold exceeded', building_id: 'B3', area: 'Lab wing', severity: 'High', status: 'Open', detail: 'Simulated reading: 43°C (demo threshold: 40°C)', created_at: new Date(Date.now()-1000*60*4).toISOString(), source: 'SIMULATED' },
  { id: 'ALT-203', title: 'Restricted-zone event', building_id: 'B5', area: 'Reception side door', severity: 'Medium', status: 'Acknowledged', detail: 'Demonstration event; no access device connected.', created_at: new Date(Date.now()-1000*60*25).toISOString(), source: 'SIMULATED' },
];
const fmt = (v) => v ? new Date(v).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Just now';
const bName = (id) => BUILDINGS.find(b => b.id === id)?.name || id || 'Unassigned';
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [people, setPeople] = useState([]);
  const [page, setPage] = useState('Overview');
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const [demoUser, setDemoUser] = useState(null);
  const [requests, setRequests] = useState(seedRequests);
  const [alerts, setAlerts] = useState(seedAlerts);
  const [assets, setAssets] = useState([
    { id:'AST-001', name:'Science Lab ventilation unit', building_id:'B3', area:'Lab wing', category:'HVAC', status:'Operational' },
    { id:'AST-002', name:'Library emergency light', building_id:'B2', area:'North exit', category:'Safety', status:'Needs inspection' },
    { id:'AST-003', name:'Auditorium sound system', building_id:'B6', area:'Main hall', category:'AV equipment', status:'Operational' },
    { id:'AST-004', name:'Hostel water pump', building_id:'B4', area:'Utility room', category:'Plumbing', status:'Operational' },
  ]);
  const [visitors, setVisitors] = useState([{ id:'VIS-51', name:'Demo Visitor', organization:'Sample Vendor', building_id:'B5', purpose:'Meeting', checked_out:false, created_at:new Date().toISOString() }]);
  const [search, setSearch] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [toast, setToast] = useState('');
  const user = demoUser || (session?.user ? { ...session.user, ...profile, email: session.user.email, username: profile?.username || session.user.user_metadata?.username } : null);
  const role = user?.role || 'student';
  const isDemo = Boolean(demoUser);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data, error: e }) => {
      if (e) setError(e.message);
      setSession(data.session);
      if (data.session?.user) await fetchProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) await fetchProfile(nextSession.user.id); else setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    if (!supabase) return;
    const { data, error: e } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (e) setError(`Signed in, but your profile could not be loaded: ${e.message}.`);
    else setProfile(data);
  }
  async function refreshData() {
    if (!supabase || isDemo) return;
    const [{ data: reqs, error: reqErr }, { data: alts, error: altErr }, { data: asts, error: astErr }, { data: vis, error: visErr }, { data: ppl, error: pplErr }] = await Promise.all([
      supabase.from('maintenance_requests').select('*').order('created_at', { ascending:false }),
      supabase.from('alerts').select('*').order('created_at', { ascending:false }),
      supabase.from('assets').select('*').order('name'),
      supabase.from('visitors').select('*').order('created_at', { ascending:false }),
      supabase.from('profiles').select('id,full_name,role,username').order('full_name'),
    ]);
    const firstErr = reqErr || altErr || astErr || visErr || pplErr;
    if (firstErr) setError(`Database read failed: ${firstErr.message}.`);
    if (reqs) setRequests(reqs); if (alts) setAlerts(alts); if (asts) setAssets(asts); if (vis) setVisitors(vis); if (ppl) setPeople(ppl);
  }
  useEffect(() => { if (user && !isDemo) refreshData(); }, [user?.id, isDemo]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);

  // Username-only login handled by the self-hosted Node.js API.
  function usernameAuthAddress(username) {
    const clean = String(username || '').trim().toLowerCase();
    return `${clean}@login.surakshahub.invalid`;
  }
  async function signIn(e) {
    e.preventDefault(); setError(''); const fd = new FormData(e.currentTarget);
    const username = String(fd.get('username') || '').trim(); const password = String(fd.get('password') || '');
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) { setError('Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.'); return; }
    if (!supabase) { setError('Login service is unavailable. Check that the SurakshaHub Node.js backend is running.'); return; }
    setLoading(true); const { error: e2 } = await supabase.auth.signInWithPassword({ email: usernameAuthAddress(username), password });
    if (e2) setError('Username or password is incorrect, or the account needs to be set up.'); setLoading(false);
  }
  async function signUp(e) {
    e.preventDefault(); setError(''); const fd = new FormData(e.currentTarget);
    const full_name = String(fd.get('name') || '').trim(); const username = String(fd.get('username') || '').trim().toLowerCase(); const password = String(fd.get('password') || '');
    const requested_portal = String(fd.get('portal') || 'student');
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) { setError('Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.'); return; }
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (!supabase) { setError('Account creation is unavailable. Check that the SurakshaHub Node.js backend is running.'); return; }
    setLoading(true);
    const { data, error: e2 } = await supabase.auth.signUp({ email: usernameAuthAddress(username), password, options: { data: { full_name, username, requested_portal } } });
    if (e2) setError(e2.message);
    else if (data.session) setToast(requested_portal==='student'?'Account created. You can sign in now.':'Account created with standard user access. Ask an administrator to approve your staff/admin role.');
    else setError('Account was created but Supabase is still requiring email confirmation. In Supabase Authentication settings, disable Confirm email for this username-only setup, then try signing up again if no account was created.');
    setLoading(false);
  }


  async function signOut() { if (isDemo) setDemoUser(null); else if (supabase) await supabase.auth.signOut(); setPage('Overview'); setError(''); }

  async function createRequest(form) {
    const item = { id: uid('MNT'), title: form.title, building_id: form.building_id, area: form.area, category: form.category, priority: form.priority, status:'Pending', description:form.description, reporter_name:user?.full_name || user?.email || 'Building user', assigned_to:'', created_at:new Date().toISOString(), reporter_id:user?.id };
    if (supabase && !isDemo) {
      const { data, error: e } = await supabase.from('maintenance_requests').insert({ title:item.title, building_id:item.building_id, area:item.area, category:item.category, priority:item.priority, status:item.status, description:item.description, reporter_id:user.id, reporter_name:item.reporter_name }).select().single();
      if (e) { setError(`Could not submit request: ${e.message}`); return; } setRequests(old => [data, ...old]);
    } else setRequests(old => [item, ...old]);
    setShowRequest(false); setToast('Maintenance request submitted.'); setPage('My requests');
  }
  async function changeRole(person, nextRole) {
    if (!supabase || isDemo) { setPeople(old => old.map(p => p.id === person.id ? {...p, role:nextRole} : p)); setToast('Role updated in demo preview only.'); return; }
    const { data, error:e } = await supabase.rpc('admin_set_user_role', { target_user_id: person.id, next_role: nextRole });
    if (e) { setError(`Role change failed: ${e.message}. Check the admin-only SQL policies.`); return; }
    setPeople(old => old.map(p => p.id === person.id ? {...p, role:nextRole} : p)); setToast('Role updated.');
  }

  async function updateRequest(item, updates) {
    if (supabase && !isDemo) { const { data, error:e } = await supabase.from('maintenance_requests').update(updates).eq('id', item.id).select().single(); if(e){setError(`Update failed: ${e.message}`);return;} setRequests(old=>old.map(x=>x.id===item.id?data:x)); }
    else setRequests(old=>old.map(x=>x.id===item.id?{...x,...updates}:x));
    setToast('Work order updated.');
  }
  async function createAlert(title, building_id, area, severity='Medium', detail='Generated from SurakshaHub demo controls.') {
    const item = { id:uid('ALT'), title, building_id, area, severity, status:'Open', detail, audience:'All users', source:'SIMULATED', created_at:new Date().toISOString() };
    if (supabase && !isDemo) { const {data,error:e}=await supabase.from('alerts').insert({title,building_id,area,severity,status:'Open',detail,audience:'All users',source:'SIMULATED',created_by:user.id}).select().single(); if(e){setError(`Alert could not be saved: ${e.message}`);return;} setAlerts(old=>[data,...old]); }
    else setAlerts(old=>[item,...old]);
    setToast('Alert created. Clearly marked as simulated.');
  }
  async function updateAlert(item, updates) {
    if(supabase && !isDemo){const {data,error:e}=await supabase.from('alerts').update(updates).eq('id',item.id).select().single();if(e){setError(e.message);return;}setAlerts(old=>old.map(x=>x.id===item.id?data:x));}
    else setAlerts(old=>old.map(x=>x.id===item.id?{...x,...updates}:x)); setToast('Alert updated.');
  }
  async function addVisitor(form) {
    const item={id:uid('VIS'),...form,checked_out:false,created_at:new Date().toISOString()};
    if(supabase&&!isDemo){const {data,error:e}=await supabase.from('visitors').insert({name:item.name,organization:item.organization,building_id:item.building_id,purpose:item.purpose,checked_out:false,created_by:user.id}).select().single();if(e){setError(e.message);return;}setVisitors(old=>[data,...old]);}
    else setVisitors(old=>[item,...old]);setToast('Visitor checked in.');
  }
  async function checkoutVisitor(item) {
    if(supabase&&!isDemo){const {data,error:e}=await supabase.from('visitors').update({checked_out:true,checked_out_at:new Date().toISOString()}).eq('id',item.id).select().single();if(e){setError(e.message);return;}setVisitors(old=>old.map(x=>x.id===item.id?data:x));}
    else setVisitors(old=>old.map(x=>x.id===item.id?{...x,checked_out:true}:x));setToast('Visitor checked out.');
  }

  const myRequests = useMemo(() => requests.filter(r => role !== 'student' || isDemo || r.reporter_id === user?.id || r.reporter_name === user?.full_name), [requests, role, isDemo, user?.id, user?.full_name]);
  const openCount = requests.filter(r => !['Resolved','Completed'].includes(r.status)).length;
  const highAlerts = alerts.filter(a => a.status !== 'Resolved' && a.severity === 'High').length;
  const buildingHealth = (b) => {
    const open = requests.filter(r => r.building_id===b.id && !['Resolved','Completed'].includes(r.status)).length;
    const critical = alerts.filter(a=>a.building_id===b.id && a.status!=='Resolved' && a.severity==='High').length;
    return Math.max(28, Math.min(100, 100 - open*13 - critical*22));
  };
  const filteredRequests = myRequests.filter(r => `${r.title} ${r.area} ${bName(r.building_id)} ${r.status} ${r.category}`.toLowerCase().includes(search.toLowerCase()));
  const navItems = role==='student' ? ['Overview','My requests','Alerts','Building Pulse','Assets & QR'] : role==='maintenance' ? ['Overview','Work orders','Alerts','Building Pulse','Assets & QR'] : role==='security' ? ['Overview','Alerts & incidents','Visitors','Building Pulse'] : ['Overview','Work orders','People & roles','Alerts & incidents','Visitors','Building Pulse','Assets & QR','Insights'];

  if (loading) return <div className="loading-screen"><div className="brand-mark"><ShieldCheck/></div><h2>SurakshaHub</h2><p>Connecting securely…</p></div>;
  if (!user) return <AuthScreen onSignIn={signIn} onSignUp={signUp} error={error} setError={setError} configured={Boolean(supabase)} loading={loading} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ShieldCheck size={23}/></div><div><b>SurakshaHub</b><small>BUILDING OPERATIONS</small></div></div>
      <div className="campus-label">WORKSPACE</div>
      <nav>{navItems.map((n)=>{const Icon=navIcon(n);return <button key={n} className={`nav-link ${page===n?'active':''}`} onClick={()=>setPage(n)}><Icon size={18}/><span>{n}</span>{n==='Alerts & incidents'&&highAlerts>0&&<i>{highAlerts}</i>}</button>})}</nav>
      <div className="sidebar-bottom"><div className="system-status"><span className="online-dot"/><div><b>{isDemo?'Demo preview':supabase?'Supabase connected':'Local preview'}</b><small>{isDemo?'Sample data only':supabase?'Database-backed session':'Configure .env.local'}</small></div></div><button className="profile-row" onClick={signOut}><div className="avatar">{(user.full_name||user.username||'U').slice(0,1).toUpperCase()}</div><div className="profile-text"><b>{user.full_name||user.username||'Account'}</b><small>{ROLES[role]?.label||role}</small></div><LogOut size={16}/></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Campus operations</span><ChevronRight size={14}/><b>{page}</b></div><div className="top-actions"><span className="live-label"><span className="online-dot"/> {isDemo?'DEMO MODE':'PORTAL ACTIVE'}</span><button className="icon-btn" title="Refresh data" onClick={refreshData}><RefreshCw size={17}/></button><div className="top-avatar">{(user.full_name||'U').slice(0,1).toUpperCase()}</div></div></header>
      <div className="content-wrap">
        {error&&<div className="error-banner"><AlertTriangle size={17}/><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}
        {isDemo&&<div className="demo-banner"><CircleHelp size={17}/><span><b>Demo preview:</b> changes stay in this browser session. Set up Supabase for real accounts and shared data.</span><button onClick={()=>setDemoUser(null)}>Exit demo</button></div>}
        {page==='People & roles'&&role==='admin'&&<PeopleRolesPage people={people} requests={requests} onRoleChange={changeRole} onUpdateRequest={updateRequest} />}
        {page==='Overview'&&<Overview role={role} user={user} requests={myRequests} alerts={alerts} buildings={BUILDINGS} buildingHealth={buildingHealth} onNavigate={setPage} onNew={()=>setShowRequest(true)} />}
        {(page==='My requests'||page==='Work orders')&&<WorkOrders role={role} requests={filteredRequests} search={search} setSearch={setSearch} onNew={()=>setShowRequest(true)} onUpdate={updateRequest} user={user} people={people} />}
        {page==='Building Pulse'&&<CampusPulse buildings={BUILDINGS} health={buildingHealth} requests={requests} alerts={alerts} onAlert={createAlert} role={role} />}
        {page==='Alerts & incidents'&&<AlertsPage alerts={alerts} role={role} onUpdate={updateAlert} onAlert={createAlert} />}
        {page==='Visitors'&&<VisitorsPage visitors={visitors} onAdd={addVisitor} onCheckout={checkoutVisitor} />}
        {page==='Assets & QR'&&<AssetsPage assets={assets} setAssets={setAssets} role={role} />}
        {page==='Insights'&&<Insights requests={requests} alerts={alerts} buildings={BUILDINGS} health={buildingHealth} />}
      </div>
      <footer className="footer"><span>SurakshaHub · TechTrix’26 prototype</span><span>Sensor readings in this prototype are simulated.</span></footer>
    </main>
    {showRequest&&<RequestModal onClose={()=>setShowRequest(false)} onSubmit={createRequest}/>}
    {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
  </div>;
}

function navIcon(n){return ({Overview:LayoutDashboard,'My requests':ClipboardList,Alerts:Bell,'Work orders':Wrench,'People & roles':Users,'Building Pulse':MapPinned,'Alerts & incidents':ShieldAlert,Visitors:Users,'Assets & QR':QrCode,Insights:Activity})[n]||LayoutDashboard;}
function AuthScreen({onSignIn,onSignUp,error,setError,configured,loading}){
 const [mode,setMode]=useState('login');
 const [portal,setPortal]=useState('student');
 const portalInfo = {
  student: { title: 'User Portal', hint: 'Create an account to report issues and track repairs.' },
  staff: { title: 'Staff Portal', hint: 'Staff accounts need administrator role approval.' },
  admin: { title: 'Administrator Portal', hint: 'Administrator accounts need secure role approval.' }
 };
 const submit = (e) => { if(mode==='signup') return onSignUp(e); return onSignIn(e); };
 return <div className="auth-screen"><div className="auth-left"><div className="brand auth-brand"><div className="brand-mark"><ShieldCheck size={24}/></div><div><b>SurakshaHub</b><small>BUILDING OPERATIONS</small></div></div><div className="auth-copy"><div className="eyebrow light">SAFER BUILDINGS. SMARTER OPERATIONS.</div><h1>Every building issue,<br/><em>one clear response.</em></h1><p>A shared workspace for user reports, maintenance teams, safety alerts and building operations.</p><div className="auth-highlights"><span><CheckCircle2/> Maintenance tracking</span><span><CheckCircle2/> Safety alerts</span><span><CheckCircle2/> Building health insights</span></div></div><div className="auth-bottom">Username access · Secure password verification</div></div><div className="auth-right"><form className="auth-card" onSubmit={submit}><div className="mobile-brand"><div className="brand-mark"><ShieldCheck/></div><b>SurakshaHub</b></div><div className="eyebrow">ACCOUNT ACCESS</div><h2>Choose your portal</h2><div className="portal-choices" role="group" aria-label="Choose portal">{Object.entries(portalInfo).map(([key,item])=><button type="button" key={key} className={'portal-choice '+(portal===key?'active':'')} onClick={()=>{setPortal(key);setError('')}}><b>{item.title}</b><small>{item.hint}</small></button>)}</div><h2>{mode==='login'?'Sign in with username':'Create an account'}</h2><p className="muted">{mode==='login'?'Enter your username and password.':portal==='student'?'Create your user account with a username and password.':'Create your account; an administrator must approve staff or administrator privileges before you can use them.'}</p>{mode==='signup'&&<label>Full name<input name="name" autoComplete="name" required placeholder="Your full name"/></label>}<label>Username<input name="username" autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]{3,32}" placeholder="Choose a username"/></label>{mode==='signup'&&<input type="hidden" name="portal" value={portal}/>}<label>Password<input type="password" name="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={8} placeholder="At least 8 characters"/></label>{error&&<div className="form-error">{error}</div>}<button className="primary-btn full" disabled={loading}>{loading?'Please wait…':mode==='login'?'Sign in':'Create account'}<ChevronRight size={17}/></button><p className="switch-auth">{mode==='login'?"Don't have an account?":"Already registered?"} <button type="button" onClick={()=>{setError('');setMode(mode==='login'?'signup':'login')}}>{mode==='login'?'Create account':'Sign in'}</button></p><div className="auth-divider"><span>{portalInfo[portal].title.toUpperCase()}</span></div><small className="demo-note">Usernames are used on this screen. The SurakshaHub backend verifies passwords securely. New accounts start with User permissions; an existing administrator assigns staff and administrator roles from People & roles.</small></form></div></div>
}

function Overview({role,user,requests,alerts,buildings,buildingHealth,onNavigate,onNew}){
 const activeAlerts=alerts.filter(a=>a.status!=='Resolved'); const activeReq=requests.filter(r=>!['Resolved','Completed'].includes(r.status));
 const title=role==='student'?`Welcome back, ${user.full_name?.split(' ')[0]||'User'}`:role==='maintenance'?'Maintenance workspace':role==='security'?'Security operations':'Building overview';
 const subtitle=ROLES[role]?.intro;
 return <><div className="page-heading"><div><div className="eyebrow">TUESDAY · CAMPUS OPERATIONS</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions"><button className="secondary-btn" onClick={()=>onNavigate('Building Pulse')}><MapPinned size={16}/> Campus Pulse</button>{role==='student'&&<button className="primary-btn" onClick={onNew}><Plus size={17}/> Report an issue</button>}</div></div>
 <div className="stat-grid"><Stat icon={ClipboardList} label={role==='student'?'My open requests':'Open work orders'} value={activeReq.length} foot={`${requests.length} total requests`} tone="blue"/><Stat icon={ShieldAlert} label="Active alerts" value={activeAlerts.length} foot={`${activeAlerts.filter(a=>a.severity==='High').length} high priority`} tone="red"/><Stat icon={Building2} label="Buildings monitored" value={buildings.length} foot="Campus-wide coverage" tone="purple"/><Stat icon={Gauge} label="Average building health" value={`${Math.round(buildings.reduce((a,b)=>a+buildingHealth(b),0)/buildings.length)}%`} foot="Transparent demo score" tone="green"/></div>
 <div className="dashboard-grid"><section className="panel wide-panel"><div className="panel-heading"><div><h3>Campus Pulse</h3><p>Building status at a glance</p></div><button className="text-btn" onClick={()=>onNavigate('Building Pulse')}>Open map <ChevronRight size={15}/></button></div><MiniMap buildings={buildings} health={buildingHealth} alerts={alerts}/><div className="map-legend"><span><i className="dot green"/> Healthy</span><span><i className="dot amber"/> Needs attention</span><span><i className="dot red"/> Critical</span></div></section><section className="panel"><div className="panel-heading"><div><h3>{role==='student'?'My recent requests':'Priority queue'}</h3><p>Latest maintenance activity</p></div><button className="icon-btn" onClick={()=>onNavigate(role==='student'?'My requests':'Work orders')}><ChevronRight size={17}/></button></div><div className="compact-list">{requests.slice(0,4).map(r=><div className="compact-item" key={r.id}><div className={`mini-symbol ${r.priority==='High'?'red-bg':'blue-bg'}`}><Wrench size={16}/></div><div className="compact-copy"><b>{r.title}</b><small>{bName(r.building_id)} · {fmt(r.created_at)}</small></div><Status value={r.status}/></div>)}{!requests.length&&<Empty text="No maintenance requests yet."/>}</div></section></div>
 <div className="dashboard-grid second-grid"><section className="panel"><div className="panel-heading"><div><h3>Safety & security</h3><p>Latest building alerts</p></div><button className="text-btn" onClick={()=>onNavigate('Alerts & incidents')}>View alerts <ChevronRight size={15}/></button></div><div className="compact-list">{activeAlerts.slice(0,3).map(a=><div className="compact-item" key={a.id}><div className={`mini-symbol ${a.severity==='High'?'red-bg':'amber-bg'}`}><AlertTriangle size={16}/></div><div className="compact-copy"><b>{a.title}</b><small>{bName(a.building_id)} · {fmt(a.created_at)}</small></div><Status value={a.severity}/></div>)}{!activeAlerts.length&&<Empty text="No active alerts."/>}</div></section><section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common tasks for your role</p></div></div><div className="quick-actions">{role==='student'&&<button onClick={onNew}><Plus/><span><b>Report a problem</b><small>Send a repair request</small></span><ChevronRight/></button>}{(role==='maintenance'||role==='admin')&&<button onClick={()=>onNavigate('Work orders')}><Wrench/><span><b>Manage work orders</b><small>Assign and update repairs</small></span><ChevronRight/></button>}{(role==='security'||role==='admin')&&<button onClick={()=>onNavigate('Alerts & incidents')}><ShieldAlert/><span><b>Review safety alerts</b><small>Acknowledge and resolve</small></span><ChevronRight/></button>}<button onClick={()=>onNavigate('Assets & QR')}><QrCode/><span><b>Find an asset</b><small>QR equipment directory</small></span><ChevronRight/></button></div></section></div></>;
}
function Stat({icon:Icon,label,value,foot,tone}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{foot}</small></div></div>}
function Status({value}){const v=String(value||'Unknown').toLowerCase().replaceAll(' ','-');return <span className={`status-pill ${v}`}>{value}</span>}
function MiniMap({buildings,health,alerts}){return <div className="mini-map">{buildings.map(b=>{const score=health(b);const critical=alerts.some(a=>a.building_id===b.id&&a.severity==='High'&&a.status!=='Resolved');return <div key={b.id} className={`map-building ${critical?'critical':score<75?'attention':'healthy'}`} style={{left:`${b.x}%`,top:`${b.y}%`}}><span className="map-pin"><Building2 size={16}/></span><b>{b.short}</b><small>{score}% health</small></div>})}<div className="map-path path-one"/><div className="map-path path-two"/><div className="map-caption">BUILDING SCHEMATIC · NOT A LIVE GEOLOCATION MAP</div></div>}
function CampusPulse({buildings,health,requests,alerts,onAlert,role}){return <><div className="page-heading"><div><div className="eyebrow">BUILDING INTELLIGENCE</div><h1>Building Pulse</h1><p>Building condition, open repairs and simulated safety events in one view.</p></div>{['admin','security'].includes(role)&&<button className="primary-btn" onClick={()=>onAlert('Manual safety review requested','B1','Main corridor','Medium','Created by authorized staff for review.') }><Plus size={16}/> Create alert</button>}</div><div className="pulse-layout"><section className="panel map-panel"><div className="panel-heading"><div><h3>Campus map</h3><p>Select a building card to review its health</p></div><span className="sim-chip"><RadioTower size={13}/> SIMULATED FEEDS</span></div><MiniMap buildings={buildings} health={health} alerts={alerts}/><div className="map-legend"><span><i className="dot green"/> Healthy</span><span><i className="dot amber"/> Attention</span><span><i className="dot red"/> Critical alert</span></div></section><section className="panel"><div className="panel-heading"><div><h3>Building health</h3><p>Calculated from current demo issues</p></div></div><div className="health-list">{buildings.map(b=>{const score=health(b);const open=requests.filter(r=>r.building_id===b.id&&!['Resolved','Completed'].includes(r.status)).length;const count=alerts.filter(a=>a.building_id===b.id&&a.status!=='Resolved').length;return <div className="health-row" key={b.id}><div className="health-row-top"><div><b>{b.name}</b><small>{open} open repairs · {count} active alerts</small></div><strong className={score<60?'danger-text':score<80?'warning-text':'good-text'}>{score}%</strong></div><div className="progress-track"><span className={score<60?'danger-fill':score<80?'warning-fill':'good-fill'} style={{width:`${score}%`}}/></div></div>})}</div></section></div><section className="panel pulse-alerts"><div className="panel-heading"><div><h3>Current building alerts</h3><p>Simulated events are labelled and do not connect to hardware.</p></div></div><AlertsTable alerts={alerts.slice(0,5)} role={role} onUpdate={()=>{}}/></section></>}
function WorkOrders({role,requests,search,setSearch,onNew,onUpdate,user,people=[]}){const staff=['maintenance','admin'].includes(role);return <><div className="page-heading"><div><div className="eyebrow">FACILITIES & REPAIRS</div><h1>{role==='student'?'My maintenance requests':'Maintenance work orders'}</h1><p>{role==='student'?'Track the progress of issues you reported.':'Review priorities, assign ownership and keep repair status up to date.'}</p></div>{role==='student'&&<button className="primary-btn" onClick={onNew}><Plus size={17}/> New request</button>}</div><div className="stat-grid small-stats"><Stat icon={ClipboardList} label="Total shown" value={requests.length} foot="Requests in this view" tone="blue"/><Stat icon={Clock3} label="Pending" value={requests.filter(r=>r.status==='Pending').length} foot="Awaiting assignment" tone="amber"/><Stat icon={Activity} label="In progress" value={requests.filter(r=>r.status==='In progress').length} foot="Work underway" tone="purple"/><Stat icon={CheckCircle2} label="Resolved" value={requests.filter(r=>['Resolved','Completed'].includes(r.status)).length} foot="Completed requests" tone="green"/></div><section className="panel table-panel"><div className="table-toolbar"><div><h3>Request register</h3><p>Each record includes its current status and priority.</p></div><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search requests…"/></div></div>{requests.length?<div className="table-scroll"><table><thead><tr><th>Request</th><th>Building / area</th><th>Priority</th><th>Status</th><th>Reported</th>{staff&&<th>Workflow</th>}</tr></thead><tbody>{requests.map(r=><tr key={r.id}><td><b>{r.title}</b><small className="table-sub">{r.id} · {r.category}</small><span className="description-cell">{r.description}</span></td><td>{bName(r.building_id)}<small className="table-sub">{r.area}</small></td><td><Status value={r.priority}/></td><td><Status value={r.status}/></td><td>{fmt(r.created_at)}<small className="table-sub">{r.reporter_name||'Building user'}</small></td>{staff&&<td><div className="workflow-controls">{role==='admin'&&<select aria-label="Assign staff" value={people.find(p=>p.full_name===r.assigned_to)?.username||''} onChange={e=>onUpdate(r,{assigned_to:e.target.value,status:e.target.value?(r.status==='Pending'?'Assigned':r.status):'Pending'})}><option value="">Unassigned</option>{people.filter(p=>['maintenance','security'].includes(p.role)).map(p=><option key={p.id} value={p.username}>{p.full_name||p.id} · {p.role}</option>)}</select>}<select aria-label="Update status" value={r.status} onChange={e=>onUpdate(r,{status:e.target.value})}>{(role==='admin'?['Pending','Assigned','In progress','Awaiting verification','Completed']:['Assigned','In progress','Awaiting verification']).map(s=><option key={s}>{s}</option>)}</select></div></td>}</tr>)}</tbody></table></div>:<Empty text="No matching requests. Submit a new maintenance request to get started."/>}</section></>}

function PeopleRolesPage({people,requests,onRoleChange,onUpdateRequest}){
 const [query,setQuery]=useState(''); const [filter,setFilter]=useState('all');
 const roleNames={student:'User',maintenance:'Maintenance staff',security:'Security staff',admin:'Administrator'};
 const visible=people.filter(p=>`${p.full_name||''} ${p.username||''} ${p.role||''}`.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||p.role===filter));
 return <><div className="page-heading"><div><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>People & roles</h1><p>Assign staff permissions, allocate repair work, and verify completion before a task is marked done.</p></div></div>
 <section className="panel table-panel"><div className="table-toolbar"><div><h3>Accounts and roles</h3><p>Only administrators should change roles. Verify identity before granting elevated access.</p></div><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people…"/></div></div>
 <div className="filter-row"><label>Role filter <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All roles</option><option value="student">User</option><option value="maintenance">Maintenance staff</option><option value="security">Security staff</option><option value="admin">Administrator</option></select></label></div>
 {visible.length?<div className="table-scroll"><table><thead><tr><th>Person</th><th>Current role</th><th>Assign role</th></tr></thead><tbody>{visible.map(p=><tr key={p.id}><td><b>{p.full_name||'Unnamed account'}</b><small className="table-sub">{p.username||p.id}</small></td><td>{roleNames[p.role]||p.role}</td><td><select aria-label={`Role for ${p.full_name||p.id}`} value={p.role} onChange={e=>onRoleChange(p,e.target.value)}><option value="student">User</option><option value="maintenance">Maintenance staff</option><option value="security">Security staff</option><option value="admin">Administrator</option></select></td></tr>)}</tbody></table></div>:<p className="muted">No accounts found. Real accounts appear after profiles are created in Supabase.</p>}</section>
 <section className="panel table-panel"><div className="panel-heading"><div><h3>Completion verification</h3><p>Staff submit finished work for verification. Admin can approve it as Completed or return it to In progress.</p></div></div>
 <div className="table-scroll"><table><thead><tr><th>Problem</th><th>Assigned to</th><th>Status</th><th>Admin decision</th></tr></thead><tbody>{requests.filter(r=>['Awaiting verification','Completed'].includes(r.status)).map(r=><tr key={r.id}><td><b>{r.title}</b><small className="table-sub">{r.id} · {bName(r.building_id)} / {r.area}</small></td><td>{r.assigned_to||'Unassigned'}</td><td><Status value={r.status}/></td><td>{r.status==='Awaiting verification'?<div className="workflow-controls"><button className="primary-btn" onClick={()=>onUpdateRequest(r,{status:'Completed'})}>Verify done</button><button className="text-btn" onClick={()=>onUpdateRequest(r,{status:'In progress'})}>Return to staff</button></div>:'Verified by admin'}</td></tr>)}</tbody></table></div>{!requests.some(r=>['Awaiting verification','Completed'].includes(r.status))&&<p className="muted">No tasks are waiting for verification yet.</p>}</section></>;
}

function AlertsPage({alerts,role,onUpdate,onAlert}){const canManage=['admin','security'].includes(role);return <><div className="page-heading"><div><div className="eyebrow">SHARED NOTICES</div><h1>{role==='student'?'Building alerts':'Alerts & incidents'}</h1><p>{canManage?'Publish official notices for all users. Only authorized security and administrators can change alert status.':'Read official building alerts here. To report a problem, use My requests; you cannot edit official alerts.'}</p></div>{canManage&&<button className="primary-btn" onClick={()=>onAlert('Staff-created safety alert','B5','Reception','Medium','Staff-created alert. Review details before acting.') }><Plus size={16}/> Create alert</button>}</div><div className="stat-grid small-stats"><Stat icon={Bell} label="Active alerts" value={alerts.filter(a=>a.status!=='Resolved').length} foot="Not yet resolved" tone="blue"/><Stat icon={AlertTriangle} label="High severity" value={alerts.filter(a=>a.severity==='High'&&a.status!=='Resolved').length} foot="Review promptly" tone="red"/><Stat icon={CheckCircle2} label="Acknowledged" value={alerts.filter(a=>a.status==='Acknowledged').length} foot="Seen by staff" tone="green"/><Stat icon={RadioTower} label="Simulated sources" value={alerts.filter(a=>a.source==='SIMULATED'||a.source==='SIMULATION').length} foot="No hardware connected" tone="purple"/></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Alert register</h3><p>Sample sensor/access events are explicitly marked simulated.</p></div></div><AlertsTable alerts={alerts} role={role} onUpdate={onUpdate}/></section></>}
function AlertsTable({alerts,role,onUpdate}){const canAct=['security','admin'].includes(role);return <div className="alert-list">{alerts.map(a=><div className="alert-row" key={a.id}><div className={`alert-icon ${a.severity==='High'?'red-bg':'amber-bg'}`}><AlertTriangle size={19}/></div><div className="alert-detail"><div className="alert-title"><b>{a.title}</b><Status value={a.severity}/></div><p>{a.detail}</p><small>{bName(a.building_id)} · {a.area} · {fmt(a.created_at)} · <span className="sim-label">{a.source||'SIMULATED'}</span> · Shared with {a.audience||'all authenticated users'}</small></div><div className="alert-actions"><Status value={a.status}/>{canAct&&a.status!=='Resolved'&&<select aria-label="Alert status" value={a.status} onChange={e=>onUpdate(a,{status:e.target.value})}><option>Open</option><option>Acknowledged</option><option>Resolved</option></select>}</div></div>)}{!alerts.length&&<Empty text="No alerts to display."/>}</div>}
function VisitorsPage({visitors,onAdd,onCheckout}){const [form,setForm]=useState({name:'',organization:'',building_id:'B5',purpose:'Meeting'});return <><div className="page-heading"><div><div className="eyebrow">FRONT DESK & ACCESS LOG</div><h1>Visitor register</h1><p>Record visitor entry and exit for the demo site.</p></div></div><div className="two-column"><section className="panel"><div className="panel-heading"><div><h3>Check in a visitor</h3><p>Collect only the information needed for the visit.</p></div></div><form className="stack-form" onSubmit={e=>{e.preventDefault();onAdd(form);setForm({name:'',organization:'',building_id:'B5',purpose:'Meeting'})}}><label>Visitor name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/></label><label>Organization<input value={form.organization} onChange={e=>setForm({...form,organization:e.target.value})} placeholder="Company or guest"/></label><label>Destination<select value={form.building_id} onChange={e=>setForm({...form,building_id:e.target.value})}>{BUILDINGS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Purpose<input required value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})} placeholder="Meeting, delivery…"/></label><button className="primary-btn full"><Check size={16}/> Record check-in</button></form></section><section className="panel"><div className="panel-heading"><div><h3>Visitor log</h3><p>{visitors.filter(v=>!v.checked_out).length} currently checked in (demo records included).</p></div></div><div className="compact-list">{visitors.map(v=><div className="visitor-item" key={v.id}><div className="avatar visitor-avatar">{v.name.slice(0,1).toUpperCase()}</div><div className="compact-copy"><b>{v.name}</b><small>{v.organization||'Guest'} · {bName(v.building_id)}</small><small>{v.purpose} · {fmt(v.created_at||v.check_in)}</small></div><div className="visitor-status">{v.checked_out?<Status value="Checked out"/>:<><Status value="Checked in"/><button className="small-btn" onClick={()=>onCheckout(v)}>Check out</button></>}</div></div>)}{!visitors.length&&<Empty text="No visitors recorded."/>}</div></section></div></>}
function AssetsPage({assets,setAssets,role}){const [selected,setSelected]=useState(assets[0]?.id||'');const [query,setQuery]=useState('');const [showAdd,setShowAdd]=useState(false);const [form,setForm]=useState({name:'',building_id:'B1',area:'',category:'Equipment'});const visible=assets.filter(a=>`${a.name} ${a.area} ${a.category} ${bName(a.building_id)}`.toLowerCase().includes(query.toLowerCase()));const asset=assets.find(a=>a.id===selected)||visible[0];return <><div className="page-heading"><div><div className="eyebrow">EQUIPMENT DIRECTORY</div><h1>Assets & QR</h1><p>Use a QR code to open an asset record and pre-fill a maintenance report.</p></div>{['admin','maintenance'].includes(role)&&<button className="primary-btn" onClick={()=>setShowAdd(v=>!v)}><Plus size={16}/> Add asset</button>}</div><div className="asset-layout"><section className="panel"><div className="search-box asset-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find an asset…"/></div><div className="asset-list">{visible.map(a=><button key={a.id} className={`asset-list-item ${asset?.id===a.id?'selected':''}`} onClick={()=>setSelected(a.id)}><div className="asset-symbol"><Building2 size={18}/></div><div><b>{a.name}</b><small>{bName(a.building_id)} · {a.area}</small></div><ChevronRight size={16}/></button>)}{!visible.length&&<Empty text="No matching assets."/>}</div></section>{asset&&<section className="panel asset-detail"><div className="asset-detail-head"><div className="asset-symbol large"><QrCode size={24}/></div><div><div className="eyebrow">ASSET ID · {asset.id}</div><h2>{asset.name}</h2><p>{bName(asset.building_id)} · {asset.area}</p></div></div><div className="asset-meta"><div><small>Category</small><b>{asset.category}</b></div><div><small>Condition</small><b>{asset.status||'Registered'}</b></div></div><div className="qr-wrap"><QRCodeSVG value={`${typeof window!=='undefined'?window.location.origin:''}/?asset=${encodeURIComponent(asset.id)}`} size={164} level="M" includeMargin/><b>Scan to identify asset</b><small>QR code points to this site's asset ID.</small></div><p className="muted qr-explain">On a deployed site, scan the code to open this app and select the asset. Add a maintenance request using the asset's building and location.</p></section>}</div>{showAdd&&<form className="panel add-asset-form" onSubmit={e=>{e.preventDefault();const next={id:uid('AST'),...form,status:'Registered'};setAssets(old=>[next,...old]);setSelected(next.id);setShowAdd(false);setForm({name:'',building_id:'B1',area:'',category:'Equipment'})}}><h3>Add campus asset</h3><div className="form-grid"><label>Asset name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Building<select value={form.building_id} onChange={e=>setForm({...form,building_id:e.target.value})}>{BUILDINGS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Area / location<input required value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Equipment','Electrical','HVAC','Safety','Plumbing','AV equipment','Structural'].map(c=><option key={c}>{c}</option>)}</select></label></div><button className="primary-btn">Save asset</button></form>}</>}
function Insights({requests,alerts,buildings,health}){const categories=['Electrical','Plumbing','Equipment','Structural','HVAC','Safety'];return <><div className="page-heading"><div><div className="eyebrow">OPERATIONS ANALYTICS</div><h1>Insights & building health</h1><p>Understand the workload and condition indicators behind the overview.</p></div></div><div className="stat-grid"><Stat icon={ClipboardList} label="Total work orders" value={requests.length} foot="All statuses" tone="blue"/><Stat icon={Clock3} label="Open work orders" value={requests.filter(r=>!['Resolved','Completed'].includes(r.status)).length} foot="Needs follow-up" tone="amber"/><Stat icon={ShieldAlert} label="Unresolved alerts" value={alerts.filter(a=>a.status!=='Resolved').length} foot="Sample and created events" tone="red"/><Stat icon={Gauge} label="Average health" value={`${Math.round(buildings.reduce((s,b)=>s+health(b),0)/buildings.length)}%`} foot="Transparent rule-based score" tone="green"/></div><div className="two-column"><section className="panel"><div className="panel-heading"><div><h3>Requests by category</h3><p>Count of current maintenance records</p></div></div><div className="bar-chart">{categories.map(c=>{const n=requests.filter(r=>r.category===c).length;const max=Math.max(1,...categories.map(k=>requests.filter(r=>r.category===k).length));return <div className="bar-row" key={c}><span>{c}</span><div className="bar-track"><i style={{width:`${Math.max(n?6:0,n/max*100)}%`}}/></div><b>{n}</b></div>})}</div></section><section className="panel"><div className="panel-heading"><div><h3>Building condition</h3><p>Score = 100 minus issue penalties; minimum 28.</p></div></div><div className="health-list">{buildings.map(b=><div className="health-row" key={b.id}><div className="health-row-top"><div><b>{b.name}</b><small>Open items affect score</small></div><strong className={health(b)<60?'danger-text':health(b)<80?'warning-text':'good-text'}>{health(b)}%</strong></div><div className="progress-track"><span className={health(b)<60?'danger-fill':health(b)<80?'warning-fill':'good-fill'} style={{width:`${health(b)}%`}}/></div></div>)}</div></section></div><div className="info-note"><CircleHelp size={18}/><p><b>How to interpret this:</b> building health is a prototype heuristic, not an engineering inspection or certified safety rating. Sensor data is simulated. A production system should validate scores against real inspection and sensor data.</p></div></>}
function RequestModal({onClose,onSubmit}){const [form,setForm]=useState({title:'',building_id:'B1',area:'',category:'Electrical',priority:'Medium',description:''});return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form className="modal-card" onSubmit={e=>{e.preventDefault();onSubmit(form)}}><div className="modal-heading"><div><div className="eyebrow">FACILITIES HELP DESK</div><h2>Report a building issue</h2><p>Provide enough detail for staff to locate and assess it.</p></div><button type="button" className="icon-btn" onClick={onClose}><X/></button></div><label>Issue title<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Broken classroom light"/></label><div className="form-grid"><label>Building<select value={form.building_id} onChange={e=>setForm({...form,building_id:e.target.value})}>{BUILDINGS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Area / room<input required value={form.area} onChange={e=>setForm({...form,area:e.target.value})} placeholder="Room or location"/></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Electrical','Plumbing','Equipment','Structural','HVAC','Safety','Cleaning','Other'].map(c=><option key={c}>{c}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{['Low','Medium','High'].map(c=><option key={c}>{c}</option>)}</select></label></div><label>Description<textarea required rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What happened? Is anything currently unsafe?"/></label><div className="modal-note"><Shield size={16}/> Do not use this prototype as an emergency service. Contact campus security or local emergency services for immediate danger.</div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="primary-btn"><Send size={16}/> Submit request</button></div></form></div>}
function Empty({text}){return <div className="empty-state"><div><ClipboardList size={20}/></div><p>{text}</p></div>}
