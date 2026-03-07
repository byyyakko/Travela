import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_OWN_URL = import.meta.env.VITE_SUPABASE_OWN_URL;
const SUPABASE_OWN_KEY = import.meta.env.VITE_SUPABASE_OWN_KEY;

// Your own Supabase project — gradual replacement for the Lovable-managed one.
// Import like this:
//   import { supabaseOwn } from "@/integrations/supabase/client-own";

export const supabaseOwn = createClient<Database>(SUPABASE_OWN_URL, SUPABASE_OWN_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
