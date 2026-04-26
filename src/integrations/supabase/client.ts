import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Primary client — personal Supabase (auth + realtime + storage)
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Lovable client — utility edge functions only (geocode-address, check-profanity, find-toilets)
export const supabaseLovable = createClient(
  import.meta.env.VITE_LOVABLE_SUPABASE_URL,
  import.meta.env.VITE_LOVABLE_SUPABASE_KEY
);