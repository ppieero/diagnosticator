import { createClient } from "@/lib/supabase/client"

export interface PackageItem {
  id?: string
  package_id?: string
  service_id: string
  quantity: number
  service?: { id: string; name: string; duration_minutes: number; price: number; specialty?: { name: string; color: string } }
}

export interface Package {
  id: string
  name: string
  description?: string
  image_url?: string
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
  items?: PackageItem[]
}

export async function getPackages(): Promise<Package[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .order("name")
  if (error) throw error
  return (data ?? []) as Package[]
}

export async function getPackage(id: string): Promise<Package | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return null
  const pkg = data as Package
  const { data: items } = await supabase
    .from("package_items")
    .select("*, service:services(id, name, duration_minutes, price, specialty:specialties(name, color))")
    .eq("package_id", id)
  pkg.items = (items ?? []) as unknown as PackageItem[]
  return pkg
}

export async function createPackage(payload: {
  name: string
  description?: string
  price: number
  is_active: boolean
}, items: { service_id: string; quantity: number }[]): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("packages")
    .insert(payload)
    .select("id")
    .single()
  if (error) throw error
  const pkgId = data.id
  if (items.length > 0) {
    await supabase.from("package_items").insert(
      items.map(i => ({ package_id: pkgId, service_id: i.service_id, quantity: i.quantity }))
    )
  }
  return pkgId
}

export async function updatePackage(id: string, payload: Partial<{
  name: string; description: string; price: number; is_active: boolean
}>, items: { service_id: string; quantity: number }[]): Promise<void> {
  const supabase = createClient()
  await supabase.from("packages").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id)
  await supabase.from("package_items").delete().eq("package_id", id)
  if (items.length > 0) {
    await supabase.from("package_items").insert(
      items.map(i => ({ package_id: id, service_id: i.service_id, quantity: i.quantity }))
    )
  }
}

export async function deletePackage(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("packages").update({ is_active: false }).eq("id", id)
}