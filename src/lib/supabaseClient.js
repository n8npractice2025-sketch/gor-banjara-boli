import { createClient } from '@supabase/supabase-js'

// Connect directly to Supabase - Hardcoded to prevent Bolt.new from injecting its own empty Supabase project credentials
const supabaseUrl = 'https://njyjtptsntaoovvwshud.supabase.co'
const supabaseAnonKey = 'sb_publishable_dEtJXZH72BcFCc3j3jOCGQ_DjkQjLTK'

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
