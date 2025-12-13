import { createClient } from '@supabase/supabase-js';

// Access import.meta.env safely by casting to any to avoid TypeScript errors 
// when vite/client types are missing or not configured.
const env = (import.meta as any).env;

const supabaseUrl = env?.VITE_SUPABASE_URL;
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase Environment Variables. Database features will fail.');
}

// We provide placeholder values if env vars are missing to prevent the 
// "supabaseUrl is required" error which crashes the app on load.
// Database calls will fail gracefully later instead of white-screening immediately.
export const supabase = createClient(
  supabaseUrl || 'https://qboaduixikjbruhzhjau.supabase.co', 
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFib2FkdWl4aWtqYnJ1aHpoamF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjg1MDcsImV4cCI6MjA4MTEwNDUwN30.w8B_jRdw-rUi834mQVhQLULe2AtQLTy4D2FNj_0tEx8'
);