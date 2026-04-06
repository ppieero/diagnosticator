import { createClient } from "@/lib/supabase/client"
import { getClinicSettings } from "@/lib/services/settings"

export interface Payment {
  id: string
  patient_id: string
  appointment_id?: string
  package_id?: string
  amount: number
  tax_amount: number
  total: number
  currency: string
  payment_method: string
  status: "paid" | "pending" | "partial" | "refunded"
  concept?: string
  notes?: string
  invoice_number?: string
  paid_at?: string
  created_at: string
  patient?: { id: string; full_name: string; email?: string; phone?: string }
  appointment?: { id: string; scheduled_at: string; service?: { name: string } }
}

export async function createPayment(payload: {
  patient_id: string
  appointment_id?: string
  package_id?: string
  amount: number
  payment_method: string
  status: Payment["status"]
  concept?: string
  notes?: string
  created_by: string
}): Promise<Payment> {
  const supabase = createClient()
  const settings = await getClinicSettings()
  const { data: seqData } = await supabase.rpc("nextval", { seq: "invoice_seq" }).single().catch(() => ({ data: null }))
  const invNum = `${settings.billing.invoice_prefix}-${new Date().getFullYear()}-${String(seqData ?? Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`
  const taxRate = settings.billing.tax_enabled ? settings.billing.tax_rate : 0
  const taxAmount = Math.round(payload.amount * taxRate / 100 * 100) / 100
  const total = Math.round((payload.amount + taxAmount) * 100) / 100
  const { data, error } = await supabase
    .from("payments")
    .insert({
      ...payload,
      tax_amount: taxAmount,
      total,
      currency: settings.general.currency,
      invoice_number: invNum,
      paid_at: payload.status === "paid" ? new Date().toISOString() : null,
    })
    .select("*")
    .single()
  if (error) throw error
  return data as Payment
}

export async function getPayments(filters?: {
  from?: string; to?: string; status?: string; patient_id?: string
}): Promise<Payment[]> {
  const supabase = createClient()
  let q = supabase
    .from("payments")
    .select("*, patient:patients(id, full_name, email, phone), appointment:appointments(id, scheduled_at, service:services(name))")
    .order("created_at", { ascending: false })
  if (filters?.from) q = q.gte("created_at", filters.from)
  if (filters?.to) q = q.lte("created_at", filters.to)
  if (filters?.status) q = q.eq("status", filters.status)
  if (filters?.patient_id) q = q.eq("patient_id", filters.patient_id)
  const { data } = await q
  return (data ?? []) as unknown as Payment[]
}

export async function getPatientPayments(patientId: string): Promise<Payment[]> {
  return getPayments({ patient_id: patientId })
}

export async function updatePaymentStatus(id: string, status: Payment["status"]): Promise<void> {
  const supabase = createClient()
  await supabase.from("payments").update({
    status,
    paid_at: status === "paid" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id)
}

export async function getPaymentStats(from: string, to: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("payments")
    .select("total, status, payment_method, created_at")
    .gte("created_at", from)
    .lte("created_at", to)
  const payments = data ?? []
  return {
    total_cobrado: payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.total), 0),
    total_pendiente: payments.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.total), 0),
    count_paid: payments.filter(p => p.status === "paid").length,
    count_pending: payments.filter(p => p.status === "pending").length,
    by_method: payments.reduce((acc, p) => {
      if (p.status !== "paid") return acc
      acc[p.payment_method] = (acc[p.payment_method] ?? 0) + Number(p.total)
      return acc
    }, {} as Record<string, number>),
  }
}