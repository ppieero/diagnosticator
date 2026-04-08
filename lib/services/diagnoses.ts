import { createClient } from "@/lib/supabase/client"

export interface Diagnosis {
  id: string
  patient_id: string
  evaluation_id: string
  professional_id?: string
  diagnosis_code?: string
  diagnosis_name: string
  status: "presumptive" | "confirmed" | "ruled_out" | "under_review"
  severity?: "mild" | "moderate" | "severe" | "critical"
  rationale: string
  treatment_notes?: string
  prognosis?: string
  follow_up_date?: string
  diagnosed_by: string
  diagnosed_at: string
  created_at: string
  updated_at: string
  treatment_plans?: TreatmentPlan[]
  encounter?: {
    id: string
    started_at: string
    specialty?: { name: string; color: string }
  }
}

export interface TreatmentPlan {
  id: string
  diagnosis_id: string
  encounter_id: string
  patient_id: string
  professional_id: string
  plan_type: "exercise" | "medication" | "therapy" | "diet" | "combined" | "other"
  goals: string
  instructions?: string
  total_sessions?: number
  frequency?: string
  duration_weeks?: number
  status: "active" | "on_hold" | "completed" | "stopped"
  started_at?: string
  ends_at?: string
  stopped_reason?: string
  created_at: string
  updated_at: string
}

export async function getPatientDiagnoses(patientId: string): Promise<Diagnosis[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("diagnoses")
    .select("*, treatment_plans(*)")
    .eq("patient_id", patientId)
    .order("diagnosed_at", { ascending: false })
  if (error) { console.error("getPatientDiagnoses:", error); return [] }
  const diagnoses = (data ?? []) as unknown as Diagnosis[]
  for (const d of diagnoses) {
    if (!d.evaluation_id) continue
    const { data: enc } = await supabase
      .from("evaluations")
      .select("id, started_at, specialty_id")
      .eq("id", d.evaluation_id)
      .single()
    if (!enc) continue
    const { data: sp } = await supabase
      .from("specialties")
      .select("name, color")
      .eq("id", enc.specialty_id)
      .single()
    d.encounter = { id: enc.id, started_at: enc.started_at, specialty: sp ?? undefined }
  }
  return diagnoses
}

export async function createDiagnosis(payload: {
  patient_id: string
  evaluation_id: string
  professional_id: string
  diagnosed_by: string
  diagnosis_name: string
  diagnosis_code?: string
  status: Diagnosis["status"]
  severity?: Diagnosis["severity"]
  rationale: string
  treatment_notes?: string
  prognosis?: string
  follow_up_date?: string
}): Promise<Diagnosis> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("diagnoses")
    .insert({ ...payload, diagnosed_at: new Date().toISOString() })
    .select("*")
    .single()
  if (error) throw error
  return data as unknown as Diagnosis
}

export async function updateDiagnosis(
  id: string,
  payload: Partial<Pick<Diagnosis, "status" | "severity" | "rationale" | "prognosis" | "treatment_notes" | "follow_up_date">>
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from("diagnoses")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
}

export async function createTreatmentPlan(payload: {
  diagnosis_id: string
  encounter_id: string
  patient_id: string
  professional_id: string
  plan_type: TreatmentPlan["plan_type"]
  goals: string
  instructions?: string
  total_sessions?: number
  frequency?: string
  duration_weeks?: number
  status: TreatmentPlan["status"]
  started_at?: string
  ends_at?: string
}): Promise<TreatmentPlan> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("treatment_plans")
    .insert(payload)
    .select("*")
    .single()
  if (error) throw error
  return data as unknown as TreatmentPlan
}

export async function updateTreatmentPlan(
  id: string,
  payload: Partial<Pick<TreatmentPlan, "status" | "goals" | "instructions" | "total_sessions" | "frequency" | "duration_weeks" | "stopped_reason" | "ends_at">>
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from("treatment_plans")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
}

export async function getEncounterDiagnosis(evaluationId: string): Promise<Diagnosis | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("diagnoses")
    .select("*, treatment_plans(*)")
    .eq("evaluation_id", evaluationId)
    .order("diagnosed_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as unknown as Diagnosis | null
}
