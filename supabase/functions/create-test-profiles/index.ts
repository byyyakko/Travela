import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NAMES = ['Yuki','Carlos','Amara','Liam','Priya','Omar','Sofia','Jin','Nadia','Felix','Luna','Marco','Zara','Kai','Elena','Ravi','Chloe','Davi','Mia','Aiden','Hana','Leo','Ines','Sami','Aria','Noah','Leila','Mateo','Sara','Ethan','Maya','Hugo','Fatima','Theo','Ava','Ren','Isla','Andre','Noor','Jasper','Rosa','Tariq','Emma','Yusuf','Lily','Ivan','Mina','Oscar','Layla','Axel','Sakura','Diego','Aisha','Finn','Vera','Hassan','Julia','Ali','Freya','Luca','Suki','Pablo','Kira','Remy','Ada','Emir','Clara','Dante','Mei','Soren','Nina','Rio','Petra','Kian','Elsa','Idris','Greta','Zen','Uma','Lars','Hina','Nico','Tara','Emil','Ivy','Reza','Ana','Odin','Dina','Joel','Mira','Samir','Olga','Cruz','Wren','Bao','Elle','Nash','Lina','Tao'];
const BIOS = ['Love showing visitors hidden gems!','Foodie who knows every street stall','Adventure enthusiast and hiking guide','History buff with stories to tell','Artist exploring the local scene','Musician who knows the best live venues','Coffee connoisseur and café hopper','Beach lover and water sports fan','Night owl who knows the best nightlife','Nature photographer and trail finder','Yoga instructor and wellness guide','Surfer catching waves daily','Bookworm who knows cozy reading spots','Chef sharing secret recipes','Cyclist exploring every corner','Dance lover hitting local clubs','Market explorer and bargain hunter','Temple and shrine enthusiast','Street art tour guide','Wine and dine specialist'];
const LOCATIONS = ['Tokyo, Japan','Barcelona, Spain','Bangkok, Thailand','Paris, France','Bali, Indonesia','Istanbul, Turkey','Lisbon, Portugal','Seoul, South Korea','Marrakech, Morocco','Melbourne, Australia','Buenos Aires, Argentina','Prague, Czech Republic','Hanoi, Vietnam','Cape Town, South Africa','Mexico City, Mexico','Amsterdam, Netherlands','Kyoto, Japan','Medellín, Colombia','Dubrovnik, Croatia','Chiang Mai, Thailand'];
const INTERESTS_A = ['hiking','food','art','music','photography','surfing','yoga','nightlife','history','nature','coffee','dancing','markets','temples','cycling','wine','books','beach','cooking','adventure'];
const INTERESTS_B = ['travel','culture','fitness','meditation','gaming','film','fashion','tech','sports','volunteering'];
const LANGS = ['Japanese','Spanish','Thai','French','Indonesian','Turkish','Portuguese','Korean','Arabic','German','Vietnamese','Afrikaans','Italian','Dutch','Mandarin','Hindi','Croatian','Czech','Malay','Swahili'];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results = [];
  for (let i = 0; i < 100; i++) {
    const email = `testlocal${i + 1}@travela-test.com`;
    const password = "TestPass123!";
    
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // User might already exist, skip
      results.push({ email, error: authError.message });
      continue;
    }

    const userId = authData.user.id;
    const dob = new Date(1990, 0, 1);
    dob.setDate(dob.getDate() + (i * 37) % 3650);

    // Update the auto-created profile
    const { error: profileError } = await supabaseAdmin.from("profiles").update({
      display_name: NAMES[i],
      bio: BIOS[i % 20],
      is_local: true,
      location: LOCATIONS[i % 20],
      interests: [INTERESTS_A[i % 20], INTERESTS_B[i % 10]],
      languages: [LANGS[i % 20], 'English'],
      date_of_birth: dob.toISOString().split('T')[0],
    }).eq("user_id", userId);

    results.push({ email, userId, error: profileError?.message ?? null });
  }

  return new Response(JSON.stringify({ created: results.filter(r => !r.error).length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
