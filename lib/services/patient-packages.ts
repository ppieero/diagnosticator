import { createClient } from "@/lib/supabase/client"

export type PatientPackageStatus = "active" | "completed" | "expired" | "cancelled"
export type PaymentMode = "package" | "per_session" | "full" | "installments" | "pending"

export interface PatientPackage {
  id: string
  patient_id: string
  package_id?: string
  service_id?: string
  professional_id?: string
  total_sessions: number
  sessions_used: number
  payment_mode: PaymentMode
  status: PatientPackageStatus
  expires_at?: string
  notes?: string
  price_paid?: number
  purchased_at: string
  updated_at: string
  created_by: string
  package?: { id: string; name: string; price: number }
  service?: { id: string; name: string; duration_minutes: number; price: number }
  professional?: { id: string; profile?: { full_name: string } }
  patient?: { id: string; full_name: string }
}

export async function getPatientPackages(patientId: string): Promise<PatientPackage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("patient_service_packages")
    .select(`
      *,
      package:packages(id, name, price),
      service:services(id, name, duration_minutes, price),
      professional:professionals(id, profile:profiles(full_name))
    `)
    .eq("patient_id", patientId)
    .order("purchased_at", { ascending: false })
  return (data ?? []) as unknown as PatientPackage[]
}

export async function assignPackage(payload: {
  patient_id: string
  package_id?: string
  service_id?: string
  professional_id?: string
  total_sessions: number
  payment_mode: PaymentMode
  price_paid?: number
  expires_at?: string
  notes?: string
  created_by: string
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_service_packages")
    .insert({
      ...payload,
      sessions_used: 0,
      status: "active",
      purchased_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (error) {
    console.error("assignPackage DB error:", JSON.stringify(error))
    throw error
  }
  return data.id
}

export async function useSession(packageId: string): Promise<void> {
  const supabase = createClient()
  const { data: pkg } = await supabase
    .from("patient_service_packages")
    .select("sessions_used, total_sessions")
    .eq("id", packageId)
    .single()
  if (!pkg) return
  const newUsed = pkg.sessions_used + 1
  const newStatus = newUsed >= pkg.total_sessions ? "completed" : "active"
  await supabase
    .from("patient_service_packages")
    .update({
      sessions_used: newUsed,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", packageId)
}

export async function updatePackageStatus(
  id: string,
  status: PatientPackageStatus
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from("patient_service_packages")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
}

export async function getActivePackages(): Promise<PatientPackage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("patient_service_packages")
    .select(`
      *,
      package:packages(id, name, price),
      service:services(id, name, duration_minutes, price),
      patient:patients(id, full_name)
    `)
    .eq("status", "active")
    .order("expires_at", { ascending: true, nullsFirst: false })
  return (data ?? []) as unknown as PatientPackage[]
}