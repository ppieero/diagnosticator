import { createClient } from "@/lib/supabase/client"

export interface FormTemplate {
  id: string
  name: string
  form_type: string
  specialty_id: string
  description?: string
  estimated_minutes?: number
  tags: string[]
  is_active: boolean
  fields: FormSection[]
  created_at: string
  updated_at: string
  specialty?: { name: string; color: string }
}

export interface FormSection {
  id: string
  order: number
  title: string
  fields: FormField[]
  required?: boolean
  collapsible?: boolean
  description?: string
}

export interface FormField {
  key: string
  type: string
  label: string
  required?: boolean
  placeholder?: string
  rows?: number
  options?: { label: string; value: string }[]
  help_text?: string
  audit_required?: boolean
}

export async function getTemplates(): Promise<FormTemplate[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("specialty_form_templates")
    .select("*, specialty:specialties(name, color)")
    .order("name")
  if (error) throw error
  return (data ?? []) as unknown as FormTemplate[]
}

export async function getTemplate(id: string): Promise<FormTemplate | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("specialty_form_templates")
    .select("*, specialty:specialties(name, color)")
    .eq("id", id)
    .single()
  if (error) return null
  return data as unknown as FormTemplate
}

export async function getTemplatesForSpecialty(specialtyId: string): Promise<FormTemplate[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("specialty_form_templates")
    .select("*, specialty:specialties(name, color)")
    .eq("specialty_id", specialtyId)
    .eq("is_active", true)
    .order("name")
  return (data ?? []) as unknown as FormTemplate[]
}

export async function getTemplatesForService(serviceId: string): Promise<(FormTemplate & { is_default: boolean; sort_order: number })[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("service_form_templates")
    .select("is_default, sort_order, template:specialty_form_templates(*, specialty:specialties(name, color))")
    .eq("service_id", serviceId)
    .order("sort_order")
  return (data ?? []).map((d: { is_default: boolean; sort_order: number; template: FormTemplate }) => ({
    ...d.template,
    is_default: d.is_default,
    sort_order: d.sort_order,
  }))
}

export async function assignTemplatesToService(
  serviceId: string,
  templates: { template_id: string; is_default: boolean; sort_order: number }[]
): Promise<void> {
  const supabase = createClient()
  await supabase.from("service_form_templates").delete().eq("service_id", serviceId)
  if (templates.length > 0) {
    await supabase.from("service_form_templates").insert(
      templates.map(t => ({ service_id: serviceId, ...t }))
    )
  }
}