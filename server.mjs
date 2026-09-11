import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const PORT = Number(process.env.PORT || 8080);
const APP_SECRET = process.env.APP_SECRET || 'troque-esta-chave-em-producao-2026';
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'A3@2026!';
const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT '',
  job_function TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('manager','employee')),
  employee_id INTEGER,
  display_name TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);
CREATE TABLE IF NOT EXISTS daily_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_date TEXT NOT NULL,
  evaluator_user_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  productivity REAL NOT NULL,
  quality REAL NOT NULL,
  losses REAL NOT NULL,
  attendance REAL NOT NULL,
  safety REAL NOT NULL,
  organization REAL NOT NULL,
  teamwork REAL NOT NULL,
  critical_quality INTEGER NOT NULL DEFAULT 0,
  critical_safety INTEGER NOT NULL DEFAULT 0,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(evaluator_user_id) REFERENCES users(id),
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);
CREATE TABLE IF NOT EXISTS self_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  productivity REAL NOT NULL,
  quality REAL NOT NULL,
  losses REAL NOT NULL,
  attendance REAL NOT NULL,
  safety REAL NOT NULL,
  organization REAL NOT NULL,
  teamwork REAL NOT NULL,
  wins TEXT NOT NULL DEFAULT '',
  improvements TEXT NOT NULL DEFAULT '',
  support_needed TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, week_start),
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);
CREATE TABLE IF NOT EXISTS weekly_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  target_value REAL,
  target_unit TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, week_start),
  FOREIGN KEY(employee_id) REFERENCES employees(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS monthly_collective (
  month TEXT PRIMARY KEY,
  production REAL NOT NULL DEFAULT 100,
  quality REAL NOT NULL DEFAULT 100,
  losses REAL NOT NULL DEFAULT 100,
  safety REAL NOT NULL DEFAULT 100,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS monthly_acknowledgements (
  month TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  acknowledged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(month, employee_id),
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
ensureColumn('users', 'display_name', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 1');

function passwordHash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function createUser(username, password, role, employeeId = null, displayName = '', mustChange = 1) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = passwordHash(password, salt);
  db.prepare('INSERT INTO users (username,password_hash,salt,role,employee_id,display_name,must_change_password) VALUES (?,?,?,?,?,?,?)')
    .run(username, hash, salt, role, employeeId, displayName, mustChange ? 1 : 0);
}

function seed() {
  const defaults = {
    max_prize: '500', min_score: '70', individual_weight: '0.80', collective_weight: '0.20',
    w_productivity: '0.30', w_quality: '0.25', w_losses: '0.15', w_attendance: '0.10',
    w_safety: '0.10', w_organization: '0.05', w_teamwork: '0.05',
    critical_quality_factor: '0', critical_safety_factor: '0', program_name: 'A3 Premiação'
  };
  const ins = db.prepare('INSERT OR IGNORE INTO config (key,value) VALUES (?,?)');
  for (const [k,v] of Object.entries(defaults)) ins.run(k,v);

  const employeeCount = Number(db.prepare('SELECT COUNT(*) AS c FROM employees').get().c);
  if (employeeCount === 0) {
    const add = db.prepare('INSERT INTO employees (name,sector,job_function,status) VALUES (?,?,?,?)');
    const roster = [
      ['LUCIEL NEVES MESSIAS','Ensaque','AUXILIAR PRODUÇÃO - ENSAQUE','Ativo','luciel.messias'],
      ['WESLEY DE ALMEIDA DA SILVA LIMA','Ensaque','AUXILIAR PRODUÇÃO - ENSAQUE','Ativo','wesley.lima'],
      ['DENILSON MARANHAO VENANCIO','Limpeza de Sementes','AUXILIAR PRODUÇÃO - LIMPEZA SEMENTES','Ativo','denilson.venancio'],
      ['GUSTAVO RAFAEL DE AS','Ensaque','AUXILIAR PRODUÇÃO - ENSAQUE','Ativo','gustavo.as'],
      ['WALLACE JONATAS BELLO DA SILVA','Logística','AUXILIAR PRODUÇÃO - EMPILHADEIRA','Ativo','wallace.silva'],
      ['SELMA DE OLIVEIRA SANTOS','Laboratório','TÉCNICA LABORATÓRIO','Ativo','selma.santos'],
      ['ELVIS VERONESE','Logística','AUXILIAR PRODUÇÃO - EMPILHADEIRA','Ativo','elvis.veronese']
    ];
    for (const [name,sector,job,status,username] of roster) {
      const r = add.run(name,sector,job,status);
      createUser(username,DEFAULT_PASSWORD,'employee',Number(r.lastInsertRowid),name,1);
    }
  }

  const managerCount = Number(db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='manager'").get().c);
  if (managerCount === 0) {
    createUser('joao.victor',DEFAULT_PASSWORD,'manager',null,'JOAO VICTOR',1);
    createUser('diego.papini',DEFAULT_PASSWORD,'manager',null,'DIEGO PAPINI',1);
    createUser('alana.carvalho',DEFAULT_PASSWORD,'manager',null,'ALANA LUISA CARVALHO',1);
  }
}
seed();

function b64url(input) { return Buffer.from(input).toString('base64url'); }
function signToken(user) {
  const payload = { id:user.id, role:user.role, employee_id:user.employee_id, exp: Date.now()+1000*60*60*24*30 };
  const p = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', APP_SECRET).update(p).digest('base64url');
  return `${p}.${sig}`;
}
function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [p,sig] = token.split('.');
  const expected = crypto.createHmac('sha256', APP_SECRET).update(p).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(p,'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    const u = db.prepare('SELECT id,username,role,employee_id,display_name,active,must_change_password FROM users WHERE id=?').get(payload.id);
    return u && u.active ? u : null;
  } catch { return null; }
}
function auth(req) {
  const h = req.headers.authorization || '';
  return verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
}
function safeUser(u) {
  return {id:u.id,username:u.username,role:u.role,employee_id:u.employee_id,display_name:u.display_name,must_change_password:!!u.must_change_password};
}
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
}
function text(res,status,body,type='text/plain; charset=utf-8', extraHeaders={}) {
  res.writeHead(status,{'Content-Type':type,...extraHeaders}); res.end(body);
}
async function bodyJson(req) {
  return await new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',c=>{ raw+=c; if(raw.length>1e6) req.destroy(); });
    req.on('end',()=>{ try { resolve(raw ? JSON.parse(raw) : {}); } catch(e){ reject(e); } });
  });
}
function num(v, d=0) { const n=Number(v); return Number.isFinite(n)?n:d; }
function clamp(v){ return Math.max(0,Math.min(100,num(v))); }
function cfg() {
  const rows = db.prepare('SELECT key,value FROM config').all();
  const out = {};
  for (const r of rows) out[r.key] = /^-?\d+(\.\d+)?$/.test(r.value) ? Number(r.value) : r.value;
  return out;
}
function monthStartEnd(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Mês inválido');
  const [y,m] = month.split('-').map(Number);
  const start=`${month}-01`;
  const next = m===12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;
  return [start,next];
}
function isDate(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v||'')); }
function collectiveScore(row) {
  if(!row) return 100;
  return row.production*0.40 + row.quality*0.30 + row.losses*0.20 + row.safety*0.10;
}
function employeeMonthStats(employeeId, month) {
  const [start,next] = monthStartEnd(month);
  const rows = db.prepare(`SELECT * FROM daily_evaluations WHERE employee_id=? AND eval_date>=? AND eval_date<? ORDER BY eval_date`).all(employeeId,start,next);
  const c = cfg();
  const collective = db.prepare('SELECT * FROM monthly_collective WHERE month=?').get(month) || {production:100,quality:100,losses:100,safety:100};
  const coll = collectiveScore(collective);
  const baseEmpty = {count:0, individual:0, collective:coll, final:0, prize:0, factor:1, criteria:{productivity:0,quality:0,losses:0,attendance:0,safety:0,organization:0,teamwork:0}, critical_quality:false,critical_safety:false};
  if (!rows.length) return baseEmpty;
  const keys=['productivity','quality','losses','attendance','safety','organization','teamwork'];
  const criteria={};
  keys.forEach(k=> criteria[k]=rows.reduce((s,r)=>s+Number(r[k]),0)/rows.length);
  const individual = criteria.productivity*c.w_productivity + criteria.quality*c.w_quality + criteria.losses*c.w_losses + criteria.attendance*c.w_attendance + criteria.safety*c.w_safety + criteria.organization*c.w_organization + criteria.teamwork*c.w_teamwork;
  const final = individual*c.individual_weight + coll*c.collective_weight;
  const cq=rows.some(r=>r.critical_quality); const cs=rows.some(r=>r.critical_safety);
  let factor=1;
  if(cq) factor=Math.min(factor,c.critical_quality_factor);
  if(cs) factor=Math.min(factor,c.critical_safety_factor);
  const base = final < c.min_score ? 0 : Math.min(c.max_prize,c.max_prize*final/100);
  return {count:rows.length,individual,collective:coll,final,prize:base*factor,factor,criteria,critical_quality:cq,critical_safety:cs};
}
function csvEscape(v) {
  const s=String(v??''); return /[;"\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json; charset=utf-8'};
function serveStatic(req,res,urlPath){
  let p = urlPath==='/'?'/index.html':urlPath;
  p = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
  const file=path.join(PUBLIC_DIR,p);
  if(!file.startsWith(PUBLIC_DIR)) return text(res,403,'Forbidden');
  fs.readFile(file,(err,data)=>{
    if(err){
      if(!path.extname(file)) return fs.readFile(path.join(PUBLIC_DIR,'index.html'),(e,d)=> e?text(res,404,'Not found'):text(res,200,d,'text/html; charset=utf-8'));
      return text(res,404,'Not found');
    }
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':path.extname(file)==='.html'?'no-cache':'public, max-age=3600'}); res.end(data);
  });
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    const pathname=url.pathname;
    if(pathname==='/api/health') return json(res,200,{ok:true,time:new Date().toISOString()});

    if(pathname==='/api/login' && req.method==='POST'){
      const b=await bodyJson(req); const u=db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(String(b.username||'').trim().toLowerCase());
      if(!u || passwordHash(String(b.password||''),u.salt)!==u.password_hash) return json(res,401,{error:'Usuário ou senha inválidos.'});
      return json(res,200,{token:signToken(u),user:safeUser(u)});
    }

    if(pathname==='/api/bootstrap'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const employees = u.role==='manager' ? db.prepare('SELECT * FROM employees ORDER BY name').all() : db.prepare('SELECT * FROM employees WHERE id=?').all(u.employee_id);
      return json(res,200,{user:safeUser(u),employees,config:cfg()});
    }

    if(pathname==='/api/change-password' && req.method==='POST'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const b=await bodyJson(req); const full=db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
      if(passwordHash(String(b.current_password||''),full.salt)!==full.password_hash) return json(res,400,{error:'Senha atual incorreta.'});
      if(String(b.new_password||'').length<8) return json(res,400,{error:'A nova senha deve ter ao menos 8 caracteres.'});
      const salt=crypto.randomBytes(16).toString('hex'); const hash=passwordHash(String(b.new_password),salt);
      db.prepare('UPDATE users SET salt=?, password_hash=?, must_change_password=0 WHERE id=?').run(salt,hash,u.id);
      return json(res,200,{ok:true});
    }

    if(pathname==='/api/employees' && req.method==='GET'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const rows=u.role==='manager'?db.prepare('SELECT * FROM employees ORDER BY name').all():db.prepare('SELECT * FROM employees WHERE id=?').all(u.employee_id);
      return json(res,200,rows);
    }

    if(pathname==='/api/employees' && req.method==='POST'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const b=await bodyJson(req); if(!String(b.name||'').trim()) return json(res,400,{error:'Nome obrigatório'});
      const r=db.prepare('INSERT INTO employees (name,sector,job_function,status) VALUES (?,?,?,?)').run(String(b.name).trim(),String(b.sector||''),String(b.job_function||''),String(b.status||'Ativo'));
      let credentials=null;
      if(b.create_access){
        const username=String(b.username||`colab${r.lastInsertRowid}`).trim().toLowerCase(); const pass=String(b.password||DEFAULT_PASSWORD);
        createUser(username,pass,'employee',Number(r.lastInsertRowid),String(b.name).trim(),1); credentials={username,password:pass};
      }
      return json(res,201,{id:Number(r.lastInsertRowid),credentials});
    }

    if(pathname.startsWith('/api/employees/') && req.method==='PUT'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const id=Number(pathname.split('/').pop()); const b=await bodyJson(req);
      db.prepare('UPDATE employees SET name=?,sector=?,job_function=?,status=? WHERE id=?').run(String(b.name||''),String(b.sector||''),String(b.job_function||''),String(b.status||'Ativo'),id);
      return json(res,200,{ok:true});
    }

    if(pathname==='/api/daily-evaluations' && req.method==='GET'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7); const [start,next]=monthStartEnd(month);
      const requested=Number(url.searchParams.get('employee_id')||0);
      const empId=u.role==='employee'?u.employee_id:requested;
      let rows;
      if(empId) rows=db.prepare(`SELECT d.*,e.name employee_name,COALESCE(u.display_name,u.username) evaluator FROM daily_evaluations d JOIN employees e ON e.id=d.employee_id JOIN users u ON u.id=d.evaluator_user_id WHERE d.employee_id=? AND d.eval_date>=? AND d.eval_date<? ORDER BY d.eval_date DESC`).all(empId,start,next);
      else rows=db.prepare(`SELECT d.*,e.name employee_name,COALESCE(u.display_name,u.username) evaluator FROM daily_evaluations d JOIN employees e ON e.id=d.employee_id JOIN users u ON u.id=d.evaluator_user_id WHERE d.eval_date>=? AND d.eval_date<? ORDER BY d.eval_date DESC,e.name`).all(start,next);
      return json(res,200,rows);
    }

    if(pathname==='/api/daily-evaluations' && req.method==='POST'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const b=await bodyJson(req); const emp=Number(b.employee_id); if(!emp) return json(res,400,{error:'Selecione o colaborador'});
      const vals=['productivity','quality','losses','attendance','safety','organization','teamwork'].map(k=>clamp(b[k]));
      const evalDate=String(b.eval_date||new Date().toISOString().slice(0,10)); if(!isDate(evalDate)) return json(res,400,{error:'Data inválida'});
      const r=db.prepare(`INSERT INTO daily_evaluations (eval_date,evaluator_user_id,employee_id,productivity,quality,losses,attendance,safety,organization,teamwork,critical_quality,critical_safety,comment) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        evalDate,u.id,emp,...vals,b.critical_quality?1:0,b.critical_safety?1:0,String(b.comment||'')
      );
      return json(res,201,{id:Number(r.lastInsertRowid)});
    }

    if(pathname.startsWith('/api/daily-evaluations/') && req.method==='DELETE'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const id=Number(pathname.split('/').pop()); db.prepare('DELETE FROM daily_evaluations WHERE id=?').run(id); return json(res,200,{ok:true});
    }

    if(pathname==='/api/self-evaluations' && req.method==='GET'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const empId=u.role==='employee'?u.employee_id:Number(url.searchParams.get('employee_id')||0);
      const sql=`SELECT s.*,e.name employee_name FROM self_evaluations s JOIN employees e ON e.id=s.employee_id`;
      const rows=empId?db.prepare(sql+' WHERE s.employee_id=? ORDER BY s.week_start DESC').all(empId):db.prepare(sql+' ORDER BY s.week_start DESC,e.name').all();
      return json(res,200,rows);
    }

    if(pathname==='/api/self-evaluations' && req.method==='POST'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const b=await bodyJson(req); const empId=u.role==='employee'?u.employee_id:Number(b.employee_id||0);
      if(!empId) return json(res,400,{error:'Colaborador inválido'});
      if(u.role==='employee' && empId!==u.employee_id) return json(res,403,{error:'Acesso restrito'});
      if(!isDate(b.week_start)) return json(res,400,{error:'Semana inválida'});
      const vals=['productivity','quality','losses','attendance','safety','organization','teamwork'].map(k=>clamp(b[k]));
      db.prepare(`INSERT INTO self_evaluations (week_start,employee_id,productivity,quality,losses,attendance,safety,organization,teamwork,wins,improvements,support_needed,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(employee_id,week_start) DO UPDATE SET productivity=excluded.productivity,quality=excluded.quality,losses=excluded.losses,attendance=excluded.attendance,safety=excluded.safety,organization=excluded.organization,teamwork=excluded.teamwork,wins=excluded.wins,improvements=excluded.improvements,support_needed=excluded.support_needed,updated_at=CURRENT_TIMESTAMP`).run(
          String(b.week_start),empId,...vals,String(b.wins||''),String(b.improvements||''),String(b.support_needed||'')
        );
      return json(res,200,{ok:true});
    }

    if(pathname==='/api/weekly-goals' && req.method==='GET'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const week=url.searchParams.get('week_start')||''; if(!isDate(week)) return json(res,400,{error:'Semana inválida'});
      const requested=Number(url.searchParams.get('employee_id')||0); const empId=u.role==='employee'?u.employee_id:requested;
      if(empId){
        const row=db.prepare(`SELECT g.*,e.name employee_name FROM weekly_goals g JOIN employees e ON e.id=g.employee_id WHERE g.employee_id=? AND g.week_start=?`).get(empId,week);
        return json(res,200,row||null);
      }
      const rows=db.prepare(`SELECT g.*,e.name employee_name,e.sector,e.job_function FROM weekly_goals g JOIN employees e ON e.id=g.employee_id WHERE g.week_start=? ORDER BY e.name`).all(week);
      return json(res,200,rows);
    }

    if(pathname==='/api/weekly-goals' && req.method==='POST'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const b=await bodyJson(req); const empId=Number(b.employee_id); if(!empId || !isDate(b.week_start)) return json(res,400,{error:'Colaborador ou semana inválidos'});
      db.prepare(`INSERT INTO weekly_goals (week_start,employee_id,title,detail,target_value,target_unit,created_by,updated_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(employee_id,week_start) DO UPDATE SET title=excluded.title,detail=excluded.detail,target_value=excluded.target_value,target_unit=excluded.target_unit,created_by=excluded.created_by,updated_at=CURRENT_TIMESTAMP`).run(
          String(b.week_start),empId,String(b.title||''),String(b.detail||''),b.target_value===''||b.target_value==null?null:num(b.target_value),String(b.target_unit||''),u.id
        );
      return json(res,200,{ok:true});
    }

    if(pathname==='/api/collective' && req.method==='GET'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
      const row=db.prepare('SELECT * FROM monthly_collective WHERE month=?').get(month)||{month,production:100,quality:100,losses:100,safety:100};
      return json(res,200,{...row,score:collectiveScore(row)});
    }

    if(pathname==='/api/collective' && req.method==='POST'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const b=await bodyJson(req); const month=String(b.month||''); monthStartEnd(month);
      db.prepare(`INSERT INTO monthly_collective (month,production,quality,losses,safety,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(month) DO UPDATE SET production=excluded.production,quality=excluded.quality,losses=excluded.losses,safety=excluded.safety,updated_at=CURRENT_TIMESTAMP`).run(month,clamp(b.production),clamp(b.quality),clamp(b.losses),clamp(b.safety));
      return json(res,200,{ok:true});
    }

    if(pathname==='/api/acknowledgement' && req.method==='GET'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7); monthStartEnd(month);
      if(u.role==='employee') return json(res,200,db.prepare('SELECT * FROM monthly_acknowledgements WHERE month=? AND employee_id=?').get(month,u.employee_id)||null);
      const rows=db.prepare(`SELECT a.*,e.name employee_name FROM monthly_acknowledgements a JOIN employees e ON e.id=a.employee_id WHERE a.month=? ORDER BY e.name`).all(month);
      return json(res,200,rows);
    }

    if(pathname==='/api/acknowledgement' && req.method==='POST'){
      const u=auth(req); if(!u||u.role!=='employee') return json(res,403,{error:'Acesso exclusivo do colaborador'});
      const b=await bodyJson(req); const month=String(b.month||''); monthStartEnd(month);
      db.prepare(`INSERT INTO monthly_acknowledgements (month,employee_id,note,acknowledged_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(month,employee_id) DO UPDATE SET note=excluded.note,acknowledged_at=CURRENT_TIMESTAMP`).run(month,u.employee_id,String(b.note||''));
      return json(res,200,{ok:true});
    }

    if(pathname==='/api/today-status' && req.method==='GET'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const date=url.searchParams.get('date')||new Date().toISOString().slice(0,10); if(!isDate(date)) return json(res,400,{error:'Data inválida'});
      const rows=db.prepare(`SELECT e.id,e.name,e.sector,e.job_function,
        CASE WHEN EXISTS(SELECT 1 FROM daily_evaluations d WHERE d.employee_id=e.id AND d.eval_date=?) THEN 1 ELSE 0 END evaluated
        FROM employees e WHERE e.status='Ativo' ORDER BY e.name`).all(date);
      return json(res,200,rows);
    }

    if(pathname==='/api/dashboard' && req.method==='GET'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'});
      const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
      const employees=u.role==='employee'?db.prepare('SELECT * FROM employees WHERE id=?').all(u.employee_id):db.prepare("SELECT * FROM employees WHERE status='Ativo' ORDER BY name").all();
      const items=employees.map(e=>({...e,...employeeMonthStats(e.id,month)}));
      const totalPrize=items.reduce((s,x)=>s+x.prize,0); const avg=items.length?items.reduce((s,x)=>s+x.final,0)/items.length:0;
      return json(res,200,{month,items,totalPrize,avg,count:items.length});
    }

    if(pathname==='/api/export.csv' && req.method==='GET'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7); monthStartEnd(month);
      const employees=db.prepare("SELECT * FROM employees WHERE status='Ativo' ORDER BY name").all();
      const lines=[['Mês','Colaborador','Setor','Função','Avaliações','Nota individual','Nota coletiva','Nota final','Prêmio (R$)','Crítica qualidade','Crítica segurança']];
      for(const e of employees){ const s=employeeMonthStats(e.id,month); lines.push([month,e.name,e.sector,e.job_function,s.count,s.individual.toFixed(2),s.collective.toFixed(2),s.final.toFixed(2),s.prize.toFixed(2),s.critical_quality?'SIM':'NÃO',s.critical_safety?'SIM':'NÃO']); }
      const csv='\ufeff'+lines.map(r=>r.map(csvEscape).join(';')).join('\n');
      return text(res,200,csv,'text/csv; charset=utf-8',{'Content-Disposition':`attachment; filename="premiacao-${month}.csv"`});
    }

    if(pathname==='/api/config' && req.method==='GET'){
      const u=auth(req); if(!u) return json(res,401,{error:'Não autorizado'}); return json(res,200,cfg());
    }

    if(pathname==='/api/config' && req.method==='POST'){
      const u=auth(req); if(!u||u.role!=='manager') return json(res,403,{error:'Acesso restrito'});
      const b=await bodyJson(req); const stmt=db.prepare('INSERT INTO config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      const allowed=['max_prize','min_score','individual_weight','collective_weight','w_productivity','w_quality','w_losses','w_attendance','w_safety','w_organization','w_teamwork','critical_quality_factor','critical_safety_factor','program_name'];
      for(const k of allowed) if(k in b) stmt.run(k,String(typeof b[k]==='string'?b[k]:num(b[k])));
      return json(res,200,{ok:true,config:cfg()});
    }

    return serveStatic(req,res,pathname);
  } catch(err) {
    console.error(err); json(res,500,{error:'Erro interno',detail:process.env.NODE_ENV==='production'?undefined:String(err.message||err)});
  }
});
server.listen(PORT,'0.0.0.0',()=>console.log(`A3 Premiação disponível em http://localhost:${PORT}`));
