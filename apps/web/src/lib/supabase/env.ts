// Supabase settings come from .env (see .env.example).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until real project values replace the placeholders in .env. */
export const supabaseConfigured =
  /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && !SUPABASE_URL.includes("your-project-ref") &&
  SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.startsWith("your-");
