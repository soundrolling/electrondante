// src/composables/useSupabase.js
import { supabase } from '@/supabase'

export function useSupabase() {
  return {
    supabase
  }
}

