import { createClient } from "@/lib/supabase/client"

export interface Encounter {
  id: string
  patient_id: string
  appointment_id?: string
  professional_id: string
  specialty_id: string
  status: "in_progress" | "completed" | "cancelled"
  encounter_type: string
  session_number: number
  started_at: string
  completed_at?: string
  ended_at?: string
  soap_notes?: string
  notes?: string
  patient?: { id: string; full_name: string }
  professional?: { id: string; profile?: { full_name: string } }
  appointment?: { id: string; scheduled_at: string; service?: { id: string; name: string; specialty_id: string } }
}

export interface EncounterForm {
  id: string
  encounter_id: string
  template_id: string
  form_type: string
  answers: Record<string, unknown>
  completed_at?: string
  completed_by?: string
  template?: { id: string; name: string; fields: unknown[] }
}

export async function startEncounter(payload: {
  patient_id: string
  appointment_id: string
  professional_id: string
  specialty_id: string
  encounter_type: string
}): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: prev } = await supabase
    .from("evaluations")
    .select("id")
    .eq("patient_id", payload.patient_id)
    .eq("specialty_id", payload.specialty_id)
  const sessionNumber = (prev?.length ?? 0) + 1
  const isFirst = sessionNumber === 1
  const evalTypeId = isFirst
    ? `initial_${payload.specialty_id}`
    : `followup_${payload.specialty_id}`
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      ...payload,
      evaluation_type_id: evalTypeId,
      performed_by: user?.id ?? payload.professional_id,
      status: "in_progress",
      session_number: sessionNumber,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (error) throw error
  await supabase
    .from("appointments")
    .update({ status: "in_progress" })
    .eq("id", payload.appointment_id)
  return data.id
}

export async function getEncounter(id: string): Promise<Encounter | null> {
  const supabase = createClient()
  const { data: enc, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("id", id)
    .single()
  if (error) { console.error("getEncounter error:", JSON.stringify(error)); return null }
  const result = enc as unknown as Encounter
  const [patRes, apptRes] = await Promise.all([
    supabase.from("patients").select("id, full_name").eq("id", enc.patient_id).single(),
    enc.appointment_id
      ? supabase.from("appointments").select("id, scheduled_at, service:services(id, name, specialty_id)").eq("id", enc.appointment_id).single()
      : Promise.resolve({ data: null }),
  ])
  result.patient = patRes.data as { id: string; full_name: string }
  result.appointment = apptRes.data as unknown as Encounter["appointment"]
  return result
}

export async function getEncounterForms(encounterId: string): Promise<EncounterForm[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("encounter_forms")
    .select("*, template:specialty_form_templates(id, name, fields)")
    .eq("encounter_id", encounterId)
  return (data ?? []) as unknown as EncounterForm[]
}

const VALID_FORM_TYPES = ["initial","evaluation","followup"]

export async function saveEncounterForm(payload: {
  encounter_id: string
  template_id: string
  form_type: string
  answers: Record<string, unknown>
  completed_by: string
}): Promise<string> {
  payload.form_type = VALID_FORM_TYPES.includes(payload.form_type) ? payload.form_type : "initial"
  const supabase = createClient()
  const { data: existing } = await supabase
    .from("encounter_forms")
    .select("id")
    .eq("encounter_id", payload.encounter_id)
    .eq("template_id", payload.template_id)
    .single()
  if (existing) {
    await supabase
      .from("encounter_forms")
      .update({ answers: payload.answers, completed_at: new Date().toISOString(), completed_by: payload.completed_by })
      .eq("id", existing.id)
    return existing.id
  }
  const { data, error } = await supabase
    .from("encounter_forms")
    .insert({ ...payload, completed_at: new Date().toISOString() })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function completeEncounter(encounterId: string, appointmentId?: string, soapNotes?: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from("evaluations")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      soap_notes: soapNotes,
    })
    .eq("id", encounterId)
  if (appointmentId) {
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", appointmentId)
  }
}

export async function getPatientEncounters(patientId: string): Promise<Encounter[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("evaluations")
    .select("*, performer:profiles!performed_by(id, full_name), appointment:appointments(id, scheduled_at, service:services(id, name))")
    .eq("patient_id", patientId)
    .order("started_at", { ascending: false })
  return (data ?? []) as unknown as Encounter[]
}