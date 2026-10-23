import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const jwtSecret = process.env.JWT_SECRET;
let sql;
function database() {
  if (!dbUrl) throw new Error('Database is not connected. Set DATABASE_URL or POSTGRES_URL in the Render environment.');
  if (!sql) sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: false, idle_timeout: 5, connect_timeout: 10 });
  return sql;
}
const now = () => new Date().toISOString();
const uid = p => `${p}-${randomUUID()}`;
const roles = ['student','maintenance','security','admin'];
const tables = {
  profiles: ['id','username','full_name','role','created_at'],
  maintenance_requests: ['id','title','building_id','area','category','priority','status','description','reporter_id','reporter_name','assigned_to','assigned_staff_id','created_at','updated_at','verified_by','verified_at'],
  alerts: ['id','title','building_id','area','severity','status','detail','audience','source','created_by','created_at'],
  assets: ['id','name','building_id','area','category','status'],
  visitors: ['id','name','organization','building_id','purpose','checked_out','checked_out_at','created_by','created_at'],
};
async function init(db) {
  await db`CREATE TABLE IF NOT EXISTS profiles (
    id text PRIMARY KEY, username text NOT NULL UNIQUE, full_name text NOT NULL,
    role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','maintenance','security','admin')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db`CREATE TABLE IF NOT EXISTS credentials (
    username text PRIMARY KEY REFERENCES profiles(username) ON UPDATE CASCADE ON DELETE CASCADE,
    password_hash text NOT NULL
  )`;
  await db`CREATE TABLE IF NOT EXISTS maintenance_requests (
    id text PRIMARY KEY, title text NOT NULL, building_id text, area text, category text, priority text,
    status text NOT NULL DEFAULT 'Pending', description text, reporter_id text REFERENCES profiles(id),
    reporter_name text, assigned_to text, assigned_staff_id text REFERENCES profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    verified_by text REFERENCES profiles(id), verified_at timestamptz
  )`;
  await db`CREATE TABLE IF NOT EXISTS alerts (
    id text PRIMARY KEY, title text NOT NULL, building_id text, area text, severity text, status text,
    detail text, audience text, source text, created_by text REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db`CREATE TABLE IF NOT EXISTS assets (
    id text PRIMARY KEY, name text NOT NULL, building_id text, area text, category text, status text
  )`;
  await db`CREATE TABLE IF NOT EXISTS visitors (
    id text PRIMARY KEY, name text NOT NULL, organization text, building_id text, purpose text,
    checked_out boolean NOT NULL DEFAULT false, checked_out_at timestamptz, created_by text REFERENCES profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  const count = await db`SELECT count(*)::int AS n FROM assets`;
  if (!count[0].n) {
    const assets = [
      ['AST-001','Science Lab ventilation unit','B3','Lab wing','HVAC','Operational'],
      ['AST-002','Library emergency light','B2','North exit','Safety','Needs inspection'],
      ['AST-003','Academic Block fire panel','B1','Ground floor','Safety','Operational'],
      ['AST-004','Hostel water pump','B4','Utility room','Plumbing','Operational'],
    ];
    for (const a of assets) await db`INSERT INTO assets (id,name,building_id,area,category,status) VALUES (${a[0]},${a[1]},${a[2]},${a[3]},${a[4]},${a[5]}) ON CONFLICT DO NOTHING`;
  }
  const adminName = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (adminName && adminPassword && /^[a-z0-9._-]{3,32}$/.test(adminName) && adminPassword.length >= 12) {
    const existing = await db`SELECT id FROM profiles WHERE role='admin' LIMIT 1`;
    if (!existing.length) {
      const found = await db`SELECT id FROM profiles WHERE username=${adminName}`;
      if (!found.length) {
        const id = uid('usr');
        await db.begin(async tx => {
          await tx`INSERT INTO profiles (id,username,full_name,role,created_at) VALUES (${id},${adminName},'SurakshaHub Administrator','admin',${now()})`;
          await tx`INSERT INTO credentials (username,password_hash) VALUES (${adminName},${await bcrypt.hash(adminPassword,12)})`;
        });
      }
    }
  }
}
function cookies(req) {
  const result = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1) result[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  }
  return result;
}
function sessionFor(profile) {
  const token = jwt.sign({ sub: profile.id }, jwtSecret, { expiresIn: '8h', issuer: 'surakshahub' });
  return { token, session: { access_token:'httpOnly-cookie-session', token_type:'bearer', expires_in:28800,
    user:{ id:profile.id, email:`${profile.username}@username.local`, user_metadata:{username:profile.username,full_name:profile.full_name} } } };
}
async function currentUser(req, db) {
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be configured with a random secret of at least 32 characters.');
  const token = cookies(req).suraksha_session;
  if (!token) return null;
  try {
    const claim = jwt.verify(token,jwtSecret,{issuer:'surakshahub'});
    const rows = await db`SELECT id,username,full_name,role,created_at FROM profiles WHERE id=${claim.sub}`;
    return rows[0] || null;
  } catch { return null; }
}
function sendError(res, code, message) { return res.status(code).json({error:message}); }
export default async function handler(req,res) {
  const url = new URL(req.url, 'https://surakshahub.local');
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/,'');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const db = database();
    await init(db);
    if (!jwtSecret || jwtSecret.length < 32) return sendError(res,500,'JWT_SECRET is missing or too short in Vercel environment variables.');
    const cookie = (token, clear=false) => res.setHeader('Set-Cookie', clear
      ? 'suraksha_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
      : `suraksha_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`);
    if (path === 'health' && req.method === 'GET') return res.json({ok:true,service:'SurakshaHub API'});
    if (path === 'auth/me' && req.method === 'GET') {
      const user = await currentUser(req,db);
      if (!user) return res.json({session:null});
      const s = sessionFor(user);
      // Preserve the current cookie's lifetime; don't rotate token on each profile read.
      return res.json({session:{...s.session,access_token:'httpOnly-cookie-session'}});
    }
    if (path === 'auth/logout' && req.method === 'POST') { cookie('',true); return res.json({ok:true}); }
    if (path === 'auth/signup' && req.method === 'POST') {
      const username=String(req.body?.username||'').trim().toLowerCase();
      const password=String(req.body?.password||'');
      const fullName=String(req.body?.full_name||username).trim().slice(0,100);
      if(!/^[a-z0-9._-]{3,32}$/.test(username)) return sendError(res,400,'Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens.');
      if(password.length<8||password.length>128) return sendError(res,400,'Password must be 8–128 characters long.');
      if(!fullName) return sendError(res,400,'Please enter your name.');
      const exists=await db`SELECT id FROM profiles WHERE username=${username}`;
      if(exists.length) return sendError(res,409,'That username is already taken.');
      const profile={id:uid('usr'),username,full_name:fullName,role:'student',created_at:now()};
      await db.begin(async tx=>{
        await tx`INSERT INTO profiles (id,username,full_name,role,created_at) VALUES (${profile.id},${username},${fullName},'student',${profile.created_at})`;
        await tx`INSERT INTO credentials (username,password_hash) VALUES (${username},${await bcrypt.hash(password,12)})`;
      });
      const s=sessionFor(profile); cookie(s.token);
      return res.status(201).json({session:s.session,user:s.session.user});
    }
    if (path === 'auth/login' && req.method === 'POST') {
      const username=String(req.body?.username||'').trim().toLowerCase();
      const password=String(req.body?.password||'');
      const rows=await db`SELECT p.id,p.username,p.full_name,p.role,p.created_at,c.password_hash FROM profiles p JOIN credentials c ON c.username=p.username WHERE p.username=${username}`;
      const row=rows[0];
      const ok = row ? await bcrypt.compare(password,row.password_hash) : await bcrypt.compare(password || 'invalid', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6e0JjQ9kQ5M4kX7sYQf6yJxYx8x2K');
      if(!row||!ok) return sendError(res,401,'Username or password is incorrect.');
      const profile={id:row.id,username:row.username,full_name:row.full_name,role:row.role,created_at:row.created_at};
      const s=sessionFor(profile); cookie(s.token);
      return res.json({session:s.session,user:s.session.user});
    }
    const user=await currentUser(req,db);
    if(!user) return sendError(res,401,'Please sign in.');
    if(path==='rpc' && req.method==='POST') {
      if(req.body?.name!=='admin_set_user_role') return sendError(res,400,'Unknown operation.');
      if(user.role!=='admin') return sendError(res,403,'Administrator access required.');
      const target=String(req.body.args?.target_user_id||'');
      const role=String(req.body.args?.next_role||'');
      if(!roles.includes(role)) return sendError(res,400,'Invalid role.');
      if(target===user.id&&role!=='admin') return sendError(res,400,'You cannot remove your own administrator role.');
      const result=await db`UPDATE profiles SET role=${role} WHERE id=${target} RETURNING id`;
      if(!result.length) return sendError(res,404,'Account not found.');
      return res.json({data:true});
    }
    if(path==='data' && req.method==='POST') {
      const {table,action='select',payload,filters=[],order}=req.body||{};
      if(!Object.hasOwn(tables,table)) return sendError(res,400,'Unknown table.');
      const cols=tables[table], isAdmin=user.role==='admin';
      if(table==='profiles'&&action!=='select') return sendError(res,403,'Use the role-management operation.');
      
      const safeFilters=(filters||[]).filter(f=>Array.isArray(f)&&cols.includes(f[0]));
      if(action==='select') {
        let query=`SELECT ${cols.map(c=>'"'+c+'"').join(',')} FROM "${table}"`;
        const where=[...safeFilters];
        if(table==='maintenance_requests'&&user.role==='student') where.push(['reporter_id',user.id]);
        if(table==='maintenance_requests'&&user.role==='maintenance') where.push(['assigned_staff_id',user.id]);
        if(table==='profiles'&&!isAdmin) { where.length=0; where.push(['id',user.id]); }
        if(where.length) query+=' WHERE '+where.map(([c])=>`"${c}" = $${where.indexOf(where.find(x=>x[0]===c))+1}`).join(' AND ');
        // Build unique positional indexes deterministically.
        if(where.length) query=`SELECT ${cols.map(c=>'"'+c+'"').join(',')} FROM "${table}" WHERE `+where.map(([c],i)=>`"${c}" = $${i+1}`).join(' AND ');
        if(order&&cols.includes(order.column)) query+=` ORDER BY "${order.column}" ${order.ascending===false?'DESC':'ASC'}`;
        const rows=await db.unsafe(query,where.map(([,v])=>v));
        return res.json({data:table==='visitors'?rows.map(r=>({...r,checked_out:Boolean(r.checked_out)})):rows});
      }
      if(action==='insert') {
        const items=Array.isArray(payload)?payload:[payload], inserted=[];
        for(const raw of items) {
          const record={...(raw||{})};
          if(table==='maintenance_requests') {
            if(user.role!=='student'&&!isAdmin) return sendError(res,403,'Only users can submit a new maintenance request.');
            Object.assign(record,{id:record.id||uid('MNT'),reporter_id:user.id,reporter_name:user.full_name,status:'Pending',assigned_staff_id:null,assigned_to:'',created_at:now(),updated_at:now()});
          } else if(table==='alerts') {
            if(!['admin','security'].includes(user.role)) return sendError(res,403,'Only administrators and security staff can create alerts.');
            Object.assign(record,{id:uid('ALT'),created_by:user.id,created_at:now()});
          } else if(table==='visitors') {
            if(!['admin','security'].includes(user.role)) return sendError(res,403,'Only administrators and security staff can check in visitors.');
            Object.assign(record,{id:uid('VIS'),created_by:user.id,created_at:now(),checked_out:false});
          } else return sendError(res,403,'This table cannot be changed this way.');
          const clean=Object.fromEntries(Object.entries(record).filter(([k,v])=>cols.includes(k)&&v!==undefined));
          const names=Object.keys(clean);
          const query=`INSERT INTO "${table}" (${names.map(n=>'"'+n+'"').join(',')}) VALUES (${names.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING ${cols.map(c=>'"'+c+'"').join(',')}`;
          const rows=await db.unsafe(query,names.map(n=>clean[n]));
          inserted.push(rows[0]);
        }
        return res.status(201).json({data:Array.isArray(payload)?inserted:inserted[0]});
      }
      if(action==='update') {
        const where=[...safeFilters];
        if(!where.length) return sendError(res,400,'An update filter is required.');
        const whereSql=where.map(([c],i)=>`"${c}"=$${i+1}`).join(' AND ');
        const existing=await db.unsafe(`SELECT * FROM "${table}" WHERE ${whereSql}`,where.map(([,v])=>v));
        if(!existing.length) return sendError(res,404,'Record not found.');
        if(table==='maintenance_requests') {
          for(const row of existing) {
            if(isAdmin) {
              if(payload?.status==='Completed'&&row.status!=='Awaiting verification') return sendError(res,400,'Only work awaiting verification can be marked Completed.');
            } else if(user.role==='maintenance') {
              if(row.assigned_staff_id!==user.id) return sendError(res,403,'You can only update work assigned to you.');
              if(!['In progress','Awaiting verification'].includes(payload?.status)) return sendError(res,403,'Staff may move work to In progress or Awaiting verification; only an admin can complete it.');
            } else return sendError(res,403,'Only assigned maintenance staff or an administrator can update work orders.');
          }
        } else if(table==='alerts') {
          if(!['admin','security'].includes(user.role)) return sendError(res,403,'Insufficient permissions.');
        } else if(table==='visitors') {
          if(!['admin','security'].includes(user.role)) return sendError(res,403,'Insufficient permissions.');
        } else return sendError(res,403,'This table cannot be updated.');
        const updates=Object.fromEntries(Object.entries(payload||{}).filter(([k,v])=>cols.includes(k)&&!['id','reporter_id','created_by','verified_by','verified_at','assigned_staff_id'].includes(k)&&v!==undefined));
        if(table==='maintenance_requests'&&isAdmin&&payload?.assigned_to!==undefined) {
          if(payload.assigned_to==='') { updates.assigned_staff_id=null;updates.assigned_to='';updates.status='Pending'; }
          else {
            const staff=await db`SELECT id,full_name FROM profiles WHERE username=${String(payload.assigned_to)} AND role IN ('maintenance','security')`;
            if(!staff.length) return sendError(res,400,'Choose a registered maintenance or security staff account.');
            updates.assigned_staff_id=staff[0].id;updates.assigned_to=staff[0].full_name;updates.status='Assigned';
          }
        }
        if(table==='maintenance_requests'&&isAdmin&&payload?.status==='Completed') { updates.verified_by=user.id;updates.verified_at=now(); }
        if(table==='maintenance_requests'&&isAdmin&&payload?.status==='In progress'&&existing.some(r=>r.status==='Awaiting verification')) { updates.verified_by=null;updates.verified_at=null; }
        if(table==='maintenance_requests') updates.updated_at=now();
        const names=Object.keys(updates);
        if(!names.length) return sendError(res,400,'No valid updates supplied.');
        const params=[...names.map(n=>updates[n]),...where.map(([,v])=>v)];
        const updateSql=`UPDATE "${table}" SET ${names.map((n,i)=>'"'+n+'"=$'+(i+1)).join(',')} WHERE `+where.map(([c],i)=>`"${c}"=$${names.length+i+1}`).join(' AND ') + ` RETURNING ${cols.map(c=>'"'+c+'"').join(',')}`;
        const rows=await db.unsafe(updateSql,params);
        return res.json({data:table==='visitors'?rows.map(r=>({...r,checked_out:Boolean(r.checked_out)})):rows});
      }
      return sendError(res,400,'Unsupported database action.');
    }
    return sendError(res,404,'Not found.');
  } catch(error) {
    console.error('SurakshaHub API error:', error);
    return sendError(res,500, error.message?.includes('DATABASE_URL')?'Database is not configured. Set DATABASE_URL or POSTGRES_URL in Render environment variables.':'Server error. Check the Render service logs.');
  }
}
