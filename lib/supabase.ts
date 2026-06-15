import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 🔧 Replace these with your actual Supabase project URL and anon key
// Get them from: https://supabase.com → Your Project → Settings → API
const SUPABASE_URL = 'https://gugpcyvdfulfeamwttnu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z3BjeXZkZnVsZmVhbXd0dG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Njc1NjUsImV4cCI6MjA4NzI0MzU2NX0.BsiidnRkSN5cihym6jaWAA06kOc8ULu8415Lh2Mn4co';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
