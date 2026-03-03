import { createClient } from '@supabase/supabase-js'

// Route Supabase through our proxy to bypass strict Wi-Fi firewalls!
// If window is defined, use current domain's proxy, else fallback.
const supabaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/supabase` : 'https://njyjtptsntaoovvwshud.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dEtJXZH72BcFCc3j3jOCGQ_DjkQjLTK'

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Check your .env file.')
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
)
