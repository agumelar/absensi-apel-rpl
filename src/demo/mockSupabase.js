/**
 * Mock Supabase client untuk demo mode.
 * Mengimplementasikan subset API Supabase yang digunakan oleh aplikasi ini,
 * menggunakan data statis dari demoData.js.
 *
 * Semua mutasi (insert/upsert/update/delete) diabaikan dan mengembalikan sukses.
 * Operasi storage (upload) juga diabaikan.
 */
import { DEMO_DB } from './demoData.js';

// ---------- utility ----------

/** Ambil nilai bertingkat dari object menggunakan dot notation.
 *  Contoh: getPath({ a: { b: 1 } }, 'a.b') => 1
 */
const getPath = (obj, path) => {
  if (!path || obj === undefined || obj === null) return obj;
  return path.split('.').reduce((cur, key) => {
    if (cur === undefined || cur === null) return undefined;
    return cur[key];
  }, obj);
};

// ---------- MockQueryBuilder ----------

class MockQueryBuilder {
  constructor(table) {
    this._table = table;
    this._rows = [...(DEMO_DB[table] || [])];
    this._filters = [];
    this._orderCol = null;
    this._orderAsc = true;
    this._limitN = null;
    this._rangeFrom = null;
    this._rangeTo = null;
    this._isSingle = false;
    this._isMaybeSingle = false;
    this._isCount = false;
    this._isHeadOnly = false;
    this._isMutation = false;
    this._mutationPayload = null;
  }

  // ---- SELECT ----
  // eslint-disable-next-line no-unused-vars
  select(fields = '*', opts = {}) {
    if (opts && opts.count === 'exact') this._isCount = true;
    if (opts && opts.head === true) this._isHeadOnly = true;
    return this;
  }

  // ---- FILTERS ----
  eq(col, val) {
    this._filters.push({ type: 'eq', col, val });
    return this;
  }
  neq(col, val) {
    this._filters.push({ type: 'neq', col, val });
    return this;
  }
  gt(col, val) {
    this._filters.push({ type: 'gt', col, val });
    return this;
  }
  gte(col, val) {
    this._filters.push({ type: 'gte', col, val });
    return this;
  }
  lt(col, val) {
    this._filters.push({ type: 'lt', col, val });
    return this;
  }
  lte(col, val) {
    this._filters.push({ type: 'lte', col, val });
    return this;
  }
  in(col, vals) {
    this._filters.push({ type: 'in', col, val: vals });
    return this;
  }
  ilike(col, val) {
    this._filters.push({ type: 'ilike', col, val });
    return this;
  }
  is(col, val) {
    this._filters.push({ type: 'is', col, val });
    return this;
  }
  not(col, op, val) {
    this._filters.push({ type: 'not', col, op, val });
    return this;
  }
  filter(col, op, val) {
    this._filters.push({ type: op, col, val });
    return this;
  }

  // ---- ORDERING / PAGINATION ----
  order(col, opts = {}) {
    this._orderCol = col;
    this._orderAsc = opts.ascending !== false;
    return this;
  }
  limit(n) {
    this._limitN = n;
    return this;
  }
  range(from, to) {
    this._rangeFrom = from;
    this._rangeTo = to;
    return this;
  }

  // ---- SINGLE ROW ----
  single() {
    this._isSingle = true;
    return this;
  }
  maybeSingle() {
    this._isMaybeSingle = true;
    return this;
  }

  // ---- MUTATIONS (demo – tidak benar-benar menyimpan) ----
  insert(payload) {
    this._isMutation = true;
    this._mutationPayload = payload;
    return this;
  }
  upsert(payload) {
    this._isMutation = true;
    this._mutationPayload = payload;
    return this;
  }
  update(payload) {
    this._isMutation = true;
    this._mutationPayload = payload;
    return this;
  }
  delete() {
    this._isMutation = true;
    return this;
  }

  // ---- EXECUTE (thenable) ----
  then(resolve, reject) {
    return Promise.resolve(this._execute()).then(resolve, reject);
  }
  catch(reject) {
    return Promise.resolve(this._execute()).catch(reject);
  }
  finally(fn) {
    return Promise.resolve(this._execute()).finally(fn);
  }

  _execute() {
    // Mutasi selalu sukses tanpa benar-benar menyimpan
    if (this._isMutation) {
      return { data: this._mutationPayload ?? [], error: null };
    }

    let rows = [...this._rows];

    // Terapkan filter
    for (const f of this._filters) {
      rows = rows.filter((row) => {
        const rowVal = getPath(row, f.col);
        switch (f.type) {
          case 'eq': {
            // Handle null explicitly to avoid String(null) === "null"
            if (f.val === null || f.val === undefined) return rowVal === null || rowVal === undefined;
            if (rowVal === null || rowVal === undefined) return false;
            return String(rowVal) === String(f.val);
          }
          case 'neq': {
            if (f.val === null || f.val === undefined) return rowVal !== null && rowVal !== undefined;
            if (rowVal === null || rowVal === undefined) return true;
            return String(rowVal) !== String(f.val);
          }
          case 'gt':
            return rowVal > f.val;
          case 'gte':
            return rowVal >= f.val;
          case 'lt':
            return rowVal < f.val;
          case 'lte':
            return rowVal <= f.val;
          case 'in':
            return Array.isArray(f.val) && f.val.map(String).includes(String(rowVal));
          case 'ilike': {
            const pattern = String(f.val || '').replace(/%/g, '');
            return String(rowVal || '').toLowerCase().includes(pattern.toLowerCase());
          }
          case 'is':
            return f.val === null ? rowVal === null || rowVal === undefined : rowVal === f.val;
          default:
            return true;
        }
      });
    }

    // Jumlah (COUNT query)
    if (this._isCount) {
      const count = rows.length;
      if (this._isHeadOnly) return { data: null, count, error: null };
      return { data: rows, count, error: null };
    }

    // Urutan
    if (this._orderCol) {
      const col = this._orderCol;
      const asc = this._orderAsc;
      rows = [...rows].sort((a, b) => {
        const va = getPath(a, col);
        const vb = getPath(b, col);
        if (va === undefined || va === null) return 1;
        if (vb === undefined || vb === null) return -1;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return asc ? cmp : -cmp;
      });
    }

    // Range pagination
    if (this._rangeFrom !== null && this._rangeTo !== null) {
      rows = rows.slice(this._rangeFrom, this._rangeTo + 1);
    }

    // Limit
    if (this._limitN !== null) {
      rows = rows.slice(0, this._limitN);
    }

    // Single row
    if (this._isSingle) {
      if (rows.length === 0) {
        return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
      }
      return { data: rows[0], error: null };
    }
    if (this._isMaybeSingle) {
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows, error: null };
  }
}

// ---------- Mock Storage ----------
const mockStorageBucket = {
  upload: async () => ({ data: { path: 'demo/placeholder.jpg' }, error: null }),
  getPublicUrl: () => ({ data: { publicUrl: '/Jingga.png' } }),
  remove: async () => ({ data: [], error: null }),
};

const mockStorage = {
  from: () => mockStorageBucket,
};

// ---------- Mock Supabase Client ----------
export const createMockSupabaseClient = () => ({
  from: (table) => new MockQueryBuilder(table),
  storage: mockStorage,
  // Stub lain yang mungkin dipanggil
  rpc: async () => ({ data: null, error: null }),
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
});
