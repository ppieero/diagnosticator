import { createClient } from "@/lib/supabase/client"

export interface AnamnesisProfile {
  id?: string
  patient_id: string
  occupation?: string
  workplace?: string
  treating_doctor?: string
  referred_by?: string
  emergency_contact_name?: string
  emergency_contact_relationship?: string
  emergency_contact_phone?: string
  smoking_status?: string
  alcohol_status?: string
  active_medications?: { name: string; dose?: string; frequency?: string }[]
  known_allergies?: { substance: string; severity: string; reaction?: string }[]
  personal_history?: { condition: string; status: string; diagnosed_year?: number; notes?: string }[]
  family_history?: { condition: string; relationship: string; notes?: string }[]
  updated_at?: string
}

export interface AnamnesisSnapshot {
  id?: string
  patient_id: string
  evaluation_id?: string
  recorded_by?: string
  height_cm?: number
  weight_kg?: number
  pregnancy_status?: "not_applicable" | "no" | "yes" | "unknown"
  gestation_months?: number
  activity_level?: string
  sleep_quality?: string
  sleep_hours?: number
  stress_level?: number
  energy_level?: number
  diet_type?: string
  diet_quality?: string
  does_sport?: boolean
  sport_frequency?: string
  water_intake?: string
  today_mood?: string
  main_complaint?: string
  current_symptoms?: string[]
  notes?: string
  recorded_at?: string
}

export async function getAnamnesisProfile(patientId: string): Promise<AnamnesisProfile | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("anamnesis")
    .select("*")
    .eq("patient_id", patientId)
    .maybeSingle()
  return data as AnamnesisProfile | null
}

export async function upsertAnamnesisProfile(profile: AnamnesisProfile): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: existing } = await supabase
    .from("anamnesis")
    .select("id")
    .eq("patient_id", profile.patient_id)
    .maybeSingle()
  const now = new Date().toISOString()
  if (existing?.id) {
    await supabase.from("anamnesis")
      .update({ ...profile, updated_at: now, updated_by: user?.id })
      .eq("id", existing.id)
  } else {
    await supabase.from("anamnesis")
      .insert({ ...profile, created_at: now, updated_at: now, created_by: user?.id, updated_by: user?.id })
  }
}

export async function saveAnamnesisSnapshot(snapshot: AnamnesisSnapshot): Promise<void> {
  const supabase = createClient()
  await supabase.from("anamnesis_history")
    .insert({ ...snapshot, recorded_at: new Date().toISOString() })
  if (snapshot.pregnancy_status === "yes") {
    const { data: activeEp } = await supabase.from("patient_episodes")
      .select("id").eq("patient_id", snapshot.patient_id)
      .eq("episode_type", "pregnancy").eq("status", "active").maybeSingle()
    if (!activeEp) {
      await supabase.from("patient_episodes").insert({
        patient_id: snapshot.patient_id, episode_type: "pregnancy",
        start_date: new Date().toISOString().split("T")[0], status: "active",
        details: { gestation_months: snapshot.gestation_months ?? 0 },
      })
    } else {
      await supabase.from("patient_episodes")
        .update({ details: { gestation_months: snapshot.gestation_months ?? 0 }, updated_at: new Date().toISOString() })
        .eq("id", activeEp.id)
    }
  } else if (snapshot.pregnancy_status === "no" || snapshot.pregnancy_status === "not_applicable") {
    await supabase.from("patient_episodes")
      .update({ status: "resolved", end_date: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString() })
      .eq("patient_id", snapshot.patient_id)
      .eq("episode_type", "pregnancy").eq("status", "active")
  }
}

export async function getAnamnesisHistory(patientId: string): Promise<AnamnesisSnapshot[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("anamnesis_history")
    .select("*")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
  return (data ?? []) as AnamnesisSnapshot[]
}

export async function getLatestSnapshot(patientId: string): Promise<AnamnesisSnapshot | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("anamnesis_history")
    .select("*")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as AnamnesisSnapshot | null
}

export async function getTemplateByService(
  serviceId: string,
  specialtyId: string,
  formType: "initial" | "session" | "followup"
): Promise<{ id: string; name: string; fields: unknown[] } | null> {
  const supabase = createClient()
  const { data: byService } = await supabase
    .from("specialty_form_templates")
    .select("id, name, fields, form_type, version, description, estimated_minutes, scoring_config")
    .eq("service_id", serviceId)
    .eq("is_active", true)
    .maybeSingle()
  if (byService) return byService as { id: string; name: string; fields: unknown[] }
  const { data: bySpecialty } = await supabase
    .from("specialty_form_templates")
    .select("id, name, fields, form_type, version, description, estimated_minutes, scoring_config")
    .eq("specialty_id", specialtyId)
    .eq("form_type", formType)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  return bySpecialty as { id: string; name: string; fields: unknown[] } | null
}
