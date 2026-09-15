// Re-export the single Supabase client instance from the integrations folder.
export { supabase } from '@/integrations/supabase/client';

// ─── Types alignés sur le schéma Supabase RÉEL ────────────────────────────────
// (basés sur une introspection directe de la DB — ignorer types.ts qui est obsolète)

/** Table `profiles` */
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  registered_at: string;
  last_seen_at: string | null;
  updated_at: string;
}

/** Table `schools` */
export interface School {
  id: string;
  name: string;
  slug: string | null;
  country: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled';
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}
