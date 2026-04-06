import { createClient } from "@/lib/supabase/client"

export interface ProfessionalFull {
  id: string
  user_id: string
  specialty_id: string
  license_number?: string
  bio?: string
  description?: string
  color: string
  services_ids: string[]
  slot_duration: number
  is_active: boolean
  created_at: string
  updated_at: string
  specialty?: { id: string; name: string; slug: string; color: string }
  profile?: { id: string; full_name: string; email?: string; phone?: string; avatar_url?: string; role: string }
  schedule?: ScheduleDay[]
}

export interface ScheduleDay {
  id?: string
  professional_id: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_minutes: number
  is_active: boolean
}

export async function getProfessionals(): Promise<ProfessionalFull[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("professionals")
    .select(`
      *,
      specialty:specialties(id, name, slug, color),
      profile:profiles(id, full_name, email, phone, avatar_url, role)
    `)
    .order("created_at")
  if (error) throw error
  return (data ?? []) as unknown as ProfessionalFull[]
}

export async function getProfessional(id: string): Promise<ProfessionalFull | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("professionals")
    .select(`
      *,
      specialty:specialties(id, name, slug, color),
      profile:profiles(id, full_name, email, phone, avatar_url, role)
    `)
    .eq("id", id)
    .single()
  if (error) return null
  const prof = data as unknown as ProfessionalFull
  const { data: sched } = await supabase
    .from("professional_availability")
    .select("*")
    .eq("professional_id", id)
    .order("day_of_week")
  prof.schedule = (sched ?? []) as ScheduleDay[]
  return prof
}

export async function createProfessional(payload: {
  user_id: string
  specialty_id: string
  license_number?: string
  bio?: string
  description?: string
  color: string
  slot_duration: number
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("professionals")
    .insert({ ...payload, is_active: true, services_ids: [] })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function updateProfessional(id: string, payload: Partial<{
  specialty_id: string
  license_number: string
  bio: string
  description: string
  color: string
  slot_duration: number
  services_ids: string[]
  is_active: boolean
}>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("professionals")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function updateProfile(userId: string, payload: Partial<{
  full_name: string
  email: string
  phone: string
  role: string
}>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", userId)
  if (error) throw error
}

export async function saveSchedule(professionalId: string, days: ScheduleDay[]): Promise<void> {
  const supabase = createClient()
  await supabase.from("professional_availability").delete().eq("professional_id", professionalId)
  const active = days.filter(d => d.is_active)
  if (active.length === 0) return
  const { error } = await supabase.from("professional_availability").insert(
    active.map(d => ({
      professional_id: professionalId,
      day_of_week: d.day_of_week,
      start_time: d.start_time,
      end_time: d.end_time,
      slot_duration_minutes: d.slot_duration_minutes,
      is_active: true,
    }))
  )
  if (error) throw error
}

export async function getAvailableUsers(): Promise<{ id: string; full_name: string; email?: string; role: string }[]> {
  const supabase = createClient()
  const { data: existingProfs } = await supabase.from("professionals").select("user_id")
  const existingIds = (existingProfs ?? []).map((p: { user_id: string }) => p.user_id)
  const { data } = await supabase.from("profiles").select("id, full_name, email, role")
  return ((data ?? []) as { id: string; full_name: string; email?: string; role: string }[])
    .filter(p => !existingIds.includes(p.id))
}