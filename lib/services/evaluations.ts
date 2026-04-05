import { createClient } from "@/lib/supabase/client"
import type { Evaluation, FormTemplateConfig } from "@/types/domain"

export async function getPatientEvaluations(patientId: string): Promise<Evaluation[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("patient_id", patientId)
    .order("started_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as Evaluation[]
}

export async function getEvaluation(id: string): Promise<Evaluation | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return null
  return data as Evaluation
}

export async function createEvaluation(payload: {
  patient_id: string
  specialty_id: string
  professional_id: string
  encounter_type: "initial" | "session" | "followup"
  evaluation_type_id: string
  chief_complaint?: string
}): Promise<Evaluation> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      ...payload,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data as Evaluation
}

export async function completeEvaluation(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("evaluations")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function getTemplateBySpecialtyAndType(
  specialtyId: string,
  formType: "initial" | "session" | "followup" | "evaluation"
): Promise<FormTemplateConfig | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("specialty_form_templates")
    .select("*")
    .eq("specialty_id", specialtyId)
    .eq("form_type", formType)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    name: data.name,
    specialty: data.specialty_id,
    form_type: data.form_type,
    version: data.version,
    description: data.description,
    estimated_minutes: data.estimated_minutes,
    sections: data.fields ?? [],
  } as FormTemplateConfig
}

export async function saveFormResponse(payload: {
  template_id: string
  template_version: number
  encounter_id: string
  patient_id: string
  professional_id: string
  answers: Record<string, unknown>
  computed_scores: Record<string, number>
  body_map_data?: unknown[]
  status: "draft" | "in_progress" | "completed"
}): Promise<void> {
  const supabase = createClient()
  const existing = await supabase
    .from("form_responses")
    .select("id")
    .eq("encounter_id", payload.encounter_id)
    .eq("template_id", payload.template_id)
    .single()

  if (existing.data?.id) {
    await supabase
      .from("form_responses")
      .update({
        answers: payload.answers,
        computed_scores: payload.computed_scores,
        body_map_data: payload.body_map_data ?? [],
        status: payload.status,
        ...(payload.status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", existing.data.id)
  } else {
    await supabase
      .from("form_responses")
      .insert({
        ...payload,
        body_map_data: payload.body_map_data ?? [],
        started_at: new Date().toISOString(),
        ...(payload.status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      })
  }
}

export async function getFormResponse(encounterId: string, templateId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("form_responses")
    .select("*")
    .eq("encounter_id", encounterId)
    .eq("template_id", templateId)
    .single()
  return data
}