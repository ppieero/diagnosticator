"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createService, updateService } from "@/lib/services/services"
import { getTemplatesForSpecialty, assignTemplatesToService } from "@/lib/services/form-templates"
import type { Service } from "@/lib/services/services"
import type { FormTemplate } from "@/lib/services/form-templates"
import { useCurrency } from "@/hooks/useCurrency"
import { cn } from "@/lib/utils"

const DURATIONS = [15,20,30,45,60,75,90,120]
const BUFFERS = [0,5,10,15,20,30]
const COLORS = ["#0F6E56","#185FA5","#534AB7","#993C1D","#993556","#3B6D11","#854F0B","#5F5E5A"]

interface Props { service?: Service }

export default function ServiceForm({ service }: Props) {
  const router = useRouter()
  const { symbol } = useCurrency()
  const [specialties, setSpecialties] = useState<{ id: string; name: string; color: string }[]>([])
  const [availableTemplates, setAvailableTemplates] = useState<FormTemplate[]>([])
  const [selectedTemplates, setSelectedTemplates] = useState<{ template_id: string; is_default: boolean; sort_order: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(service?.name ?? "")
  const [description, setDescription] = useState(service?.description ?? "")
  const [specialtyId, setSpecialtyId] = useState(service?.specialty_id ?? "")
  const [durationMinutes, setDurationMinutes] = useState(service?.duration_minutes ?? 60)
  const [price, setPrice] = useState(String(service?.price ?? ""))
  const [bufferMinutes, setBufferMinutes] = useState(service?.buffer_minutes ?? 0)
  const [color, setColor] = useState(service?.color ?? "")
  const [requiresIntake, setRequiresIntake] = useState(service?.requires_intake ?? false)
  const [isActive, setIsActive] = useState(service?.is_active ?? true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("specialties").select("id, name, color").eq("is_active", true)
      setSpecialties(data ?? [])
      if (!service && data?.[0]) setSpecialtyId(data[0].id)
    }
    load()
  }, [service])

  useEffect(() => {
    if (!specialtyId) return
    getTemplatesForSpecialty(specialtyId).then(setAvailableTemplates)
  }, [specialtyId])

  useEffect(() => {
    if (!service?.id) return
    const supabase = createClient()
    supabase.from("service_form_templates")
      .select("template_id, is_default, sort_order")
      .eq("service_id", service.id)
      .order("sort_order")
      .then(({ data }) => setSelectedTemplates(data ?? []))
  }, [service?.id])

  function toggleTemplate(tmplId: string) {
    setSelectedTemplates(prev => {
      const exists = prev.find(t => t.template_id === tmplId)
      if (exists) {
        const next = prev.filter(t => t.template_id !== tmplId)
        return next.map((t, i) => ({ ...t, sort_order: i }))
      }
      return [...prev, { template_id: tmplId, is_default: prev.length === 0, sort_order: prev.length }]
    })
  }

  function setDefault(tmplId: string) {
    setSelectedTemplates(prev => prev.map(t => ({ ...t, is_default: t.template_id === tmplId })))
  }

  async function handleSave() {
    if (!name.trim() || !specialtyId) { setError("Nombre y especialidad son obligatorios"); return }
    if (!price || parseFloat(price) <= 0) { setError("El precio debe ser mayor a 0"); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        description: description || undefined,
        specialty_id: specialtyId,
        duration_minutes: durationMinutes,
        price: parseFloat(price),
        session_count: 1,
        buffer_minutes: bufferMinutes,
        color: color || undefined,
        requires_intake: requiresIntake,
        is_active: isActive,
      }
      let serviceId = service?.id
      if (service) {
        await updateService(service.id, payload)
      } else {
        serviceId = await createService(payload as Parameters<typeof createService>[0])
      }
      if (serviceId) {
        await assignTemplatesToService(serviceId, selectedTemplates)
      }
      router.push("/servicios")
    } catch (err) {
      console.error(err)
      setError("Error al guardar el servicio")
    } finally {
      setSaving(false)
    }
  }

  const FORM_TYPE_LABELS: Record<string, string> = {
    initial: "Inicial", followup: "Seguimiento", discharge: "Alta", screening: "Screening",
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del servicio</p>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Nombre del servicio</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Evaluacion fisioterapeutica inicial" className="input-base" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Descripcion (opcional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="Descripcion para el paciente..." className="input-base resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">Especialidad</label>
          <div className="flex flex-col gap-2">
            {specialties.map(sp => (
              <button key={sp.id} type="button"
                onClick={() => { setSpecialtyId(sp.id); setSelectedTemplates([]) }}
                className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                  specialtyId === sp.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                <div className="w-3 h-3 rounded-full" style={{ background: sp.color }} />
                <span className={cn("text-sm font-medium", specialtyId === sp.id ? "text-blue-900" : "text-gray-700")}>
                  {sp.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tiempo y precio</p>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">Duracion de la sesion</label>
          <div className="flex gap-2 flex-wrap">
            {DURATIONS.map(d => (
              <button key={d} type="button" onClick={() => setDurationMinutes(d)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                  durationMinutes === d ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300")}>
                {d} min
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">Buffer entre citas</label>
          <div className="flex gap-2 flex-wrap">
            {BUFFERS.map(b => (
              <button key={b} type="button" onClick={() => setBufferMinutes(b)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                  bufferMinutes === b ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}>
                {b === 0 ? "Sin buffer" : `${b} min`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Precio por sesion ({symbol})</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0.00" step="0.01" className="input-base" />
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Formularios de evaluacion
        </p>
        <p className="text-xs text-gray-400">
          Selecciona los formularios disponibles para este servicio. El profesional elegira cual aplicar al iniciar la consulta.
        </p>
        {availableTemplates.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800">No hay formularios disponibles para esta especialidad.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {availableTemplates.map(tmpl => {
              const isSelected = selectedTemplates.some(t => t.template_id === tmpl.id)
              const isDefault = selectedTemplates.find(t => t.template_id === tmpl.id)?.is_default ?? false
              return (
                <div key={tmpl.id}
                  className={cn("rounded-xl border-2 transition-all overflow-hidden",
                    isSelected ? "border-blue-400 bg-blue-50" : "border-gray-200")}>
                  <button type="button" onClick={() => toggleTemplate(tmpl.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                      isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300")}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", isSelected ? "text-blue-900" : "text-gray-800")}>
                        {tmpl.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {FORM_TYPE_LABELS[tmpl.form_type] ?? tmpl.form_type}
                        {tmpl.estimated_minutes ? ` · ~${tmpl.estimated_minutes} min` : ""}
                        {" · "}{tmpl.fields?.length ?? 0} secciones
                      </p>
                    </div>
                  </button>
                  {isSelected && (
                    <div className="border-t border-blue-200 px-4 py-2 flex items-center justify-between">
                      <p className="text-xs text-blue-700">
                        {isDefault ? "Formulario por defecto" : "Formulario alternativo"}
                      </p>
                      {!isDefault && (
                        <button type="button" onClick={() => setDefault(tmpl.id)}
                          className="text-xs text-blue-600 font-medium hover:text-blue-800">
                          Marcar como defecto
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color en agenda</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(color === c ? "" : c)}
              className={cn("w-9 h-9 rounded-xl transition-all",
                color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105")}
              style={{ background: c }} />
          ))}
          {color && (
            <button type="button" onClick={() => setColor("")}
              className="px-3 py-1.5 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50">
              Sin color
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">Servicio activo</p>
          <p className="text-xs text-gray-400">Los servicios inactivos no aparecen al agendar</p>
        </div>
        <button type="button" onClick={() => setIsActive(!isActive)}
          className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
            isActive ? "bg-blue-600" : "bg-gray-200")}>
          <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            isActive ? "translate-x-5" : "translate-x-1")} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !name.trim() || !specialtyId}
        className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
        {saving ? "Guardando..." : service ? "Guardar cambios" : "Crear servicio →"}
      </button>
    </div>
  )
}