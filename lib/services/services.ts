import { createClient } from "@/lib/supabase/client"

export interface Service {
  id: string
  specialty_id: string
  name: string
  description?: string
  duration_minutes: number
  price: number
  session_count: number
  package_price?: number
  buffer_minutes: number
  color?: string
  image_url?: string
  requires_intake: boolean
  form_template_id?: string
  max_advance_days: number
  is_active: boolean
  created_at: string
  updated_at: string
  specialty?: { id: string; name: string; slug: string; color: string }
  form_template?: { id: string; name: string }
}

export async function getServices(specialtyId?: string): Promise<Service[]> {
  const supabase = createClient()
  let query = supabase
    .from("services")
    .select("*, specialty:specialties(id, name, slug, color), form_template:specialty_form_templates(id, name)")
    .order("name")
  if (specialtyId) query = query.eq("specialty_id", specialtyId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Service[]
}

export async function getService(id: string): Promise<Service | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("services")
    .select("*, specialty:specialties(id, name, slug, color), form_template:specialty_form_templates(id, name)")
    .eq("id", id)
    .single()
  if (error) return null
  return data as unknown as Service
}

export async function createService(payload: Omit<Service, "id" | "created_at" | "updated_at" | "specialty" | "form_template">): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("services")
    .insert(payload)
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function updateService(id: string, payload: Partial<Omit<Service, "id" | "created_at" | "updated_at" | "specialty" | "form_template">>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("services")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function deleteService(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("services").update({ is_active: false }).eq("id", id)
}