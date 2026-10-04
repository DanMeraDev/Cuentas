import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la secret key: solo en el servidor (Storage y alta de usuarios).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
