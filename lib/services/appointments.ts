import { createClient } from "@/lib/supabase/client"

export interface AppointmentWithRelations {
  id: string
  patient_id: string
  professional_id: string
  specialty_id: string
  service_id: string
  package_id?: string
  scheduled_at: string
  duration_minutes: number
  status: string
  chief_complaint?: string
  notes?: string
  cancellation_reason?: string
  created_by: string
  created_at: string
  patient?: { id: string; full_name: string; phone?: string }
  specialty?: { id: string; name: string; color: string }
  service?: { id: string; name: string; duration_minutes: number; price: number }
}

export async function getAppointmentsByDateRange(
  from: string,
  to: string
): Promise<AppointmentWithRelations[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:patients(id, full_name, phone),
      specialty:specialties(id, name, color),
      service:services(id, name, duration_minutes, price)
    `)
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .order("scheduled_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as AppointmentWithRelations[]
}

export async function getAppointment(id: string): Promise<AppointmentWithRelations | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:patients(id, full_name, phone),
      specialty:specialties(id, name, color),
      service:services(id, name, duration_minutes, price)
    `)
    .eq("id", id)
    .single()
  if (error) return null
  return data as AppointmentWithRelations
}

export async function createAppointment(payload: {
  patient_id: string
  professional_id: string
  specialty_id: string
  service_id: string
  scheduled_at: string
  duration_minutes: number
  chief_complaint?: string
  notes?: string
  created_by: string
}): Promise<AppointmentWithRelations> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...payload, status: "scheduled" })
    .select(`
      *,
      patient:patients(id, full_name, phone),
      specialty:specialties(id, name, color),
      service:services(id, name, duration_minutes, price)
    `)
    .single()
  if (error) {
    console.error("createAppointment error:", JSON.stringify(error))
    throw error
  }
  return data as AppointmentWithRelations
}

export async function updateAppointmentStatus(
  id: string,
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show",
  extra?: { cancellation_reason?: string; cancelled_by?: string }
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("appointments")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(extra ?? {}),
      ...(status === "cancelled" ? { cancelled_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
  if (error) throw error
}

export async function getServices(specialtyId?: string) {
  const supabase = createClient()
  let query = supabase
    .from("services")
    .select("*, specialty:specialties(id, name, color)")
    .eq("is_active", true)
    .order("name")
  if (specialtyId) query = query.eq("specialty_id", specialtyId)
  const { data } = await query
  return data ?? []
}