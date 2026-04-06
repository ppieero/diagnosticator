import { createClient } from "@/lib/supabase/client"
import { startEncounter } from "@/lib/services/encounters"

export async function initConsulta(appointmentId: string): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { data: appt, error: apptError } = await supabase
    .from("appointments")
    .select("patient_id, professional_id, service:services(id, specialty_id)")
    .eq("id", appointmentId)
    .single()
  if (apptError) { console.error("appt error:", JSON.stringify(apptError)); throw apptError }
  if (!appt) throw new Error("Cita no encontrada")
  const svc = appt.service as { id: string; specialty_id: string } | null
  const encounterId = await startEncounter({
    patient_id: appt.patient_id,
    appointment_id: appointmentId,
    professional_id: appt.professional_id,
    specialty_id: svc?.specialty_id ?? "",
    encounter_type: "session",
  })
  console.log("encounter creado:", encounterId)
  return encounterId
}