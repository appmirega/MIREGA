import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_BOLT_DATABASE_URL || 'https://utpzjvmhqfgoehvwjuxa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_BOLT_DATABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0cHpqdm1ocWZnb2VodndqdXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5ODg5NzEsImV4cCI6MjA3NzU2NDk3MX0.DXFy0xFNhp9QN9Xe6gIirkkfeqnhr5Uoh7CNFhzbGbw';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
