import { createClient } from '@supabase/supabase-js';
import { isDemoMode } from '../../demo/demoMode.js';
import { createMockSupabaseClient } from '../../demo/mockSupabase.js';

const supabaseUrl = 'https://pbiffmnzszqdcngbzzsr.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaWZmbW56c3pxZGNuZ2J6enNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTUwODEsImV4cCI6MjA4NDQ5MTA4MX0.rsNy3xx7R7ZOgj9YLP93Y-DSqhhu2aNi3sS5sgpADFY';

const _realClient = createClient(supabaseUrl, supabaseAnonKey);
const _mockClient = createMockSupabaseClient();

/**
 * Proxy yang secara transparan mengarahkan semua panggilan ke mock client
 * (saat demo mode aktif) atau ke real Supabase client.
 * Method-method di-bind ke client yang sesuai agar `this` tidak hilang.
 */
export const supabase = new Proxy(
  {},
  {
    get(_, prop) {
      const client = isDemoMode() ? _mockClient : _realClient;
      const val = client[prop];
      return typeof val === 'function' ? val.bind(client) : val;
    },
  }
);
