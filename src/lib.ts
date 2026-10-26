/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('SEU-PROJETO') && !anonKey.includes('COLE_AQUI'))
export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null

export type ScaffoldStatus = 'montado' | 'aguardando_retirada' | 'retirado'
export type Scaffold = {
  id: string
  code: string
  client: string
  work_site: string
  requester: string
  description: string
  mounted_at: string
  responsible: string
  status: ScaffoldStatus
  notes: string | null
  removed_at: string | null
  removal_responsible: string | null
  removal_notes: string | null
  created_at: string
}
export type Inspection = {
  id: string
  scaffold_id: string
  inspected_at: string
  inspector: string
  condition: 'adequado' | 'pendencia' | 'interditado'
  notes: string
  created_at: string
}
export const statusLabel: Record<ScaffoldStatus, string> = {
  montado: 'Montado',
  aguardando_retirada: 'Aguardando retirada',
  retirado: 'Retirado',
}
export const conditionLabel = {
  adequado: 'Adequado',
  pendencia: 'Com pendÃªncia',
  interditado: 'Interditado',
} as const
export function daysMounted(date: string, endDate?: string | null) {
  if (!date) return 0
  const start = new Date(`${date}T00:00:00`)
  const end = endDate ? new Date(`${endDate}T00:00:00`) : new Date()
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
}
export function today() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

