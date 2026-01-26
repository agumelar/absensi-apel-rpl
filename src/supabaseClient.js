import { createClient } from '@supabase/supabase-js';

// Ganti URL dan KEY ini dari dashboard Supabase lo nanti
const supabaseUrl = 'https://pbiffmnzszqdcngbzzsr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaWZmbW56c3pxZGNuZ2J6enNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTUwODEsImV4cCI6MjA4NDQ5MTA4MX0.rsNy3xx7R7ZOgj9YLP93Y-DSqhhu2aNi3sS5sgpADFY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);