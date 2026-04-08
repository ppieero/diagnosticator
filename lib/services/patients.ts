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

export async function getPatient(id: string): Promise<Patient | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single()
  return data as Patient | null
}

export async function createPatient(formData: PatientFormData): Promise<Patient> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const res = await fetch("/api/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...formData, created_by: user.id }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? "Error al crear paciente")
  }
  return res.json()
}

export async function updatePatient(id: string, formData: Partial<PatientFormData>): Promise<Patient> {
  const res = await fetch(`/api/patients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? "Error al actualizar paciente")
  }
  return res.json()
}
