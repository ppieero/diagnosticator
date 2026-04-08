import { createClient } from "@/lib/supabase/client"
import { createEvaluation } from "@/lib/services/evaluations"

export async function initConsulta(appointmentId: string): Promise<{ encounterId: string; patientId: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: appt, error: apptError } = await supabase
    .from("appointments")
    .select("patient_id, professional_id, specialty_id, service:services(id, name, specialty_id)")
    .eq("id", appointmentId)
    .single()

  if (apptError || !appt) throw new Error("Cita no encontrada")

  const svc = appt.service as { id: string; specialty_id: string } | null
  const specialtyId = svc?.specialty_id ?? appt.specialty_id ?? ""

  const { data: profData } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", user.id)
    .single()

  const professionalId = profData?.id ?? user.id

  const { data: prev } = await supabase
    .from("evaluations")
    .select("id")
    .eq("patient_id", appt.patient_id)
    .eq("specialty_id", specialtyId)

  const sessionNumber = (prev?.length ?? 0) + 1
  const isFirst = sessionNumber === 1
  const evalTypeId = isFirst ? `initial_${specialtyId}` : `followup_${specialtyId}`

  const evaluation = await createEvaluation({
    patient_id: appt.patient_id,
    specialty_id: specialtyId,
    professional_id: professionalId,
    encounter_type: isFirst ? "initial" : "session",
    evaluation_type_id: evalTypeId,
  })

  await supabase
    .from("evaluations")
    .update({
      appointment_id: appointmentId,
      session_number: sessionNumber,
      professional_id: professionalId,
    })
    .eq("id", evaluation.id)

  await supabase
    .from("appointments")
    .update({ status: "in_progress" })
    .eq("id", appointmentId)

  return { encounterId: evaluation.id, patientId: appt.patient_id }
}
