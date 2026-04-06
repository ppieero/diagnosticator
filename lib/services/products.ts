import { createClient } from "@/lib/supabase/client"

export interface Product {
  id: string
  name: string
  description?: string
  image_url?: string
  price: number
  tax_rate: number
  barcode?: string
  is_active: boolean
  created_at: string
  updated_at: string
  connected_services?: { service_id: string; service?: { id: string; name: string } }[]
}

export interface ProductSale {
  id: string
  patient_id: string
  product_id: string
  appointment_id?: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
  notes?: string
  sold_by?: string
  sold_at: string
  product?: { id: string; name: string; price: number }
  patient?: { id: string; full_name: string }
  appointment?: { id: string; scheduled_at: string }
}

export async function getProducts(): Promise<Product[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name")
  if (error) throw error
  return (data ?? []) as Product[]
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return null
  const prod = data as Product
  const { data: svProds } = await supabase
    .from("service_products")
    .select("service_id, service:services(id, name)")
    .eq("product_id", id)
  prod.connected_services = (svProds ?? []) as unknown as Product["connected_services"]
  return prod
}

export async function createProduct(payload: {
  name: string; description?: string; price: number
  tax_rate: number; barcode?: string; is_active: boolean
}, serviceIds: string[]): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("products").insert(payload).select("id").single()
  if (error) throw error
  const prodId = data.id
  if (serviceIds.length > 0) {
    await supabase.from("service_products").insert(
      serviceIds.map(sid => ({ product_id: prodId, service_id: sid }))
    )
  }
  return prodId
}

export async function updateProduct(id: string, payload: Partial<{
  name: string; description: string; price: number
  tax_rate: number; barcode: string; is_active: boolean
}>, serviceIds: string[]): Promise<void> {
  const supabase = createClient()
  await supabase.from("products").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id)
  await supabase.from("service_products").delete().eq("product_id", id)
  if (serviceIds.length > 0) {
    await supabase.from("service_products").insert(
      serviceIds.map(sid => ({ product_id: id, service_id: sid }))
    )
  }
}

export async function registerSale(payload: {
  patient_id: string; product_id: string; appointment_id?: string
  quantity: number; unit_price: number; tax_rate: number; notes?: string; sold_by: string
}): Promise<void> {
  const supabase = createClient()
  const total = payload.unit_price * payload.quantity * (1 + payload.tax_rate / 100)
  await supabase.from("product_sales").insert({ ...payload, total: Math.round(total * 100) / 100 })
}

export async function getPatientSales(patientId: string): Promise<ProductSale[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("product_sales")
    .select("*, product:products(id, name, price), appointment:appointments(id, scheduled_at)")
    .eq("patient_id", patientId)
    .order("sold_at", { ascending: false })
  return (data ?? []) as unknown as ProductSale[]
}

export async function getRecentSales(limit = 20): Promise<ProductSale[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("product_sales")
    .select("*, product:products(id, name, price), patient:patients(id, full_name)")
    .order("sold_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as ProductSale[]
}