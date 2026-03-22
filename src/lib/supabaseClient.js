import { createClient } from '@supabase/supabase-js'

// Connect directly to Supabase (works on all deployment platforms)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://njyjtptsntaoovvwshud.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dEtJXZH72BcFCc3j3jOCGQ_DjkQjLTK'

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
