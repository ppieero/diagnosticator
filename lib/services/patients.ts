import { createClient } from "@/lib/supabase/client"
import type { Patient } from "@/types/domain"
import type { PatientFormData } from "@/lib/validations/schemas"

export async function getPatients(): Promise<Patient[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("is_active", true)
    .order("full_name")
  if (error) throw error
  return data as Patient[]
}

export async function createPatient(formData: PatientFormData): Promise<Patient> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("patients")
    .insert({
      ...formData,
      is_active: true,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data as Patient
}
