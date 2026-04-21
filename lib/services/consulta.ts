import { createClient } from "@/lib/supabase/client"
import { createEvaluation, getTemplateBySpecialtyAndType } from "@/lib/services/evaluations"

export async function initConsulta(appointmentId: string): Promise<{ encounterId: string; patientId: string; templateId: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  // Anti-dup: reutilizar si ya existe in_progress para esta cita
  const { data: existing } = await supabase
    .from("evaluations")
    .select("id, patient_id, specialty_id, encounter_type")
    .eq("appointment_id", appointmentId)
    .eq("status", "in_progress")
    .maybeSingle()

  if (existing) {
    const tmpl = await getTemplateBySpecialtyAndType(
      existing.specialty_id ?? "",
      (existing.encounter_type as "initial" | "session" | "followup") ?? "initial"
    )
    return { encounterId: existing.id, patientId: existing.patient_id, templateId: tmpl?.id ?? null }
  }

  const { data: appt, error: apptError } = await supabase
    .from("appointments")
    .select("patient_id, professional_id, specialty_id, service:services(id, name, specialty_id)")
    .eq("id", appointmentId)
    .single()

  if (apptError || !appt) throw new Error("Cita no encontrada")

  const svc = appt.service as { id: string; specialty_id: string } | null
  const specialtyId = svc?.specialty_id ?? appt.specialty_id ?? ""

  // Contar evaluaciones completadas que tienen form_responses O diagnoses
  const { data: prevEvals } = await supabase
    .from("evaluations")
    .select("id")
    .eq("patient_id", appt.patient_id)
    .eq("specialty_id", specialtyId)
    .eq("status", "completed")

  const prevIds = (prevEvals ?? []).map((e: { id: string }) => e.id)

  let clinicalCount = 0
  if (prevIds.length > 0) {
    const [frRes, dxRes] = await Promise.all([
      supabase.from("form_responses").select("encounter_id").in("encounter_id", prevIds),
      supabase.from("diagnoses").select("evaluation_id").in("evaluation_id", prevIds),
    ])
    const withForms = new Set((frRes.data ?? []).map((f: { encounter_id: string }) => f.encounter_id))
    const withDiags = new Set((dxRes.data ?? []).map((d: { evaluation_id: string }) => d.evaluation_id))
    const union = new Set([...withForms, ...withDiags])
    clinicalCount = union.size
  }

  const isFirst = clinicalCount === 0
  const encounterType = isFirst ? "initial" : "session"
  const sessionNumber = clinicalCount + 1
  const evalTypeId = isFirst ? `initial_${specialtyId}` : `followup_${specialtyId}`

  const evaluation = await createEvaluation({
    patient_id: appt.patient_id,
    specialty_id: specialtyId,
    professional_id: user.id,
    performed_by: user.id,
    encounter_type: encounterType,
    evaluation_type_id: evalTypeId,
  })

  await supabase
    .from("evaluations")
    .update({
      appointment_id: appointmentId,
      session_number: sessionNumber,
      professional_id: user.id,
    })
    .eq("id", evaluation.id)

  await supabase
    .from("appointments")
    .update({ status: "in_progress" })
    .eq("id", appointmentId)

  const tmpl = await getTemplateBySpecialtyAndType(specialtyId, encounterType as "initial" | "session" | "followup")

  return { encounterId: evaluation.id, patientId: appt.patient_id, templateId: tmpl?.id ?? null }
}
