const API = '/api';
let currentSession = null;
const listeners = new Set();
let sessionLoaded = false;

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
function publish(event, session) {
  currentSession = session;
  sessionLoaded = true;
  listeners.forEach(fn => { try { fn(event, session); } catch {} });
}
function makeError(error) { return error ? { message: error.message || String(error) } : null; }

export function createClient() {
  const auth = {
    async getSession() {
      if (!sessionLoaded) {
        try {
          const data = await request('/auth/me');
          publish('INITIAL_SESSION', data.session || null);
        } catch { publish('INITIAL_SESSION', null); }
      }
      return { data: { session: currentSession }, error: null };
    },
    onAuthStateChange(callback) {
      listeners.add(callback);
      if (sessionLoaded) queueMicrotask(() => callback('INITIAL_SESSION', currentSession));
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    async signInWithPassword({ email, password }) {
      try {
        const username = String(email || '').split('@')[0];
        const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        publish('SIGNED_IN', data.session);
        return { data, error: null };
      } catch (error) { return { data: { session: null, user: null }, error: makeError(error) }; }
    },
    async signUp({ email, password, options = {} }) {
      try {
        const username = String(options.data?.username || String(email || '').split('@')[0]).toLowerCase();
        const data = await request('/auth/signup', { method: 'POST', body: JSON.stringify({ username, password, full_name: options.data?.full_name || username, requested_portal: options.data?.requested_portal || 'student' }) });
        publish('SIGNED_IN', data.session);
        return { data, error: null };
      } catch (error) { return { data: { session: null, user: null }, error: makeError(error) }; }
    },
    async signOut() {
      try { await request('/auth/logout', { method: 'POST', body: '{}' }); } catch {}
      publish('SIGNED_OUT', null);
      return { error: null };
    },
    async resetPasswordForEmail() {
      return { error: { message: 'Email recovery is disabled. Contact an administrator for a secure username-based password reset.' } };
    },
  };
  return {
    auth,
    from(table) { return new Query(table); },
    async rpc(name, args) {
      try {
        const data = await request('/rpc', { method: 'POST', body: JSON.stringify({ name, args }) });
        return { data: data.data, error: null };
      } catch (error) { return { data: null, error: makeError(error) }; }
    },
  };
}
class Query {
  constructor(table) { this.table = table; this.action = 'select'; this.payload = null; this.filters = []; this.ordering = null; this.wantSingle = false; this.wantData = false; }
  select(columns = '*') { this.wantData = true; this.columns = columns; return this; }
  order(column, options = {}) { this.ordering = { column, ascending: options.ascending !== false }; return this; }
  eq(column, value) { this.filters.push([column, value]); return this; }
  insert(payload) { this.action = 'insert'; this.payload = payload; return this; }
  update(payload) { this.action = 'update'; this.payload = payload; return this; }
  single() { this.wantSingle = true; return this.execute(); }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    try {
      const body = { table: this.table, action: this.action, payload: this.payload, filters: this.filters, order: this.ordering };
      const result = await request('/data', { method: 'POST', body: JSON.stringify(body) });
      let data = result.data;
      if (this.wantSingle) data = Array.isArray(data) ? (data[0] || null) : data;
      return { data, error: null };
    } catch (error) { return { data: null, error: makeError(error) }; }
  }
}
