"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createService, updateService } from "@/lib/services/services"
import type { Service } from "@/lib/services/services"
import { cn } from "@/lib/utils"

const DURATIONS = [15,20,30,45,60,75,90,120]
const BUFFERS = [0,5,10,15,20,30]
const COLORS = ["#0F6E56","#185FA5","#534AB7","#993C1D","#993556","#3B6D11","#854F0B","#5F5E5A"]

interface Props {
  service?: Service
  onSaved?: (id: string) => void
}

export default function ServiceForm({ service, onSaved }: Props) {
  const router = useRouter()
  const [specialties, setSpecialties] = useState<{ id: string; name: string; color: string }[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string; specialty_id: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(service?.name ?? "")
  const [description, setDescription] = useState(service?.description ?? "")
  const [specialtyId, setSpecialtyId] = useState(service?.specialty_id ?? "")
  const [durationMinutes, setDurationMinutes] = useState(service?.duration_minutes ?? 60)
  const [price, setPrice] = useState(String(service?.price ?? ""))
  const [sessionCount, setSessionCount] = useState(service?.session_count ?? 1)
  const [packagePrice, setPackagePrice] = useState(String(service?.package_price ?? ""))
  const [bufferMinutes, setBufferMinutes] = useState(service?.buffer_minutes ?? 0)
  const [color, setColor] = useState(service?.color ?? "")
  const [requiresIntake, setRequiresIntake] = useState(service?.requires_intake ?? false)
  const [formTemplateId, setFormTemplateId] = useState(service?.form_template_id ?? "")
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(service?.max_advance_days ?? 60)
  const [isActive, setIsActive] = useState(service?.is_active ?? true)

  const isPackage = sessionCount > 1

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [spRes, tRes] = await Promise.all([
        supabase.from("specialties").select("id, name, color").eq("is_active", true),
        supabase.from("specialty_form_templates").select("id, name, specialty_id").eq("is_active", true),
      ])
      setSpecialties(spRes.data ?? [])
      setTemplates(tRes.data ?? [])
      if (!service && spRes.data?.[0]) setSpecialtyId(spRes.data[0].id)
    }
    load()
  }, [service])

  const filteredTemplates = templates.filter(t => !specialtyId || t.specialty_id === specialtyId)

  async function handleSave() {
    if (!name.trim() || !specialtyId) {
      setError("Nombre y especialidad son obligatorios")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        description: description || undefined,
        specialty_id: specialtyId,
        duration_minutes: durationMinutes,
        price: parseFloat(price) || 0,
        session_count: sessionCount,
        package_price: isPackage && packagePrice ? parseFloat(packagePrice) : undefined,
        buffer_minutes: bufferMinutes,
        color: color || undefined,
        requires_intake: requiresIntake,
        form_template_id: requiresIntake && formTemplateId ? formTemplateId : undefined,
        max_advance_days: maxAdvanceDays,
        is_active: isActive,
      }
      if (service) {
        await updateService(service.id, payload)
        onSaved?.(service.id)
        router.push("/servicios")
      } else {
        const id = await createService(payload as Parameters<typeof createService>[0])
        onSaved?.(id)
        router.push("/servicios")
      }
    } catch (err) {
      console.error(err)
      setError("Error al guardar el servicio")
    } finally {
      setSaving(false)
    }
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
              <button key={sp.id} type="button" onClick={() => { setSpecialtyId(sp.id); setFormTemplateId("") }}
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
          <label className="text-xs text-gray-500 font-medium block mb-2">Tiempo buffer entre citas</label>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Precio unitario (€)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0.00" className="input-base" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Antelacion maxima (dias)</label>
            <input type="number" value={maxAdvanceDays} onChange={e => setMaxAdvanceDays(Number(e.target.value))}
              className="input-base" />
          </div>
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Paquete de sesiones</p>
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
          <p className="text-xs text-purple-800">
            Si el servicio se vende como paquete de varias sesiones, configura el numero de sesiones y el precio especial del paquete.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 flex-1">Numero de sesiones</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSessionCount(Math.max(1, sessionCount - 1))}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg">
              −
            </button>
            <span className="w-10 text-center text-sm font-semibold text-gray-900">{sessionCount}</span>
            <button type="button" onClick={() => setSessionCount(sessionCount + 1)}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg">
              +
            </button>
          </div>
        </div>
        {isPackage && (
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">
              Precio del paquete ({sessionCount} sesiones) — deja vacio para usar precio unitario x{sessionCount}
            </label>
            <input type="number" value={packagePrice} onChange={e => setPackagePrice(e.target.value)}
              placeholder={String((parseFloat(price) || 0) * sessionCount)} className="input-base" />
            {packagePrice && price && (
              <p className="text-xs text-purple-600 mt-1">
                Ahorro por paquete: €{((parseFloat(price) * sessionCount) - parseFloat(packagePrice)).toFixed(0)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Formulario clinico</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Requiere anamnesis</p>
            <p className="text-xs text-gray-400">Se activa un formulario al iniciar la consulta</p>
          </div>
          <button type="button" onClick={() => setRequiresIntake(!requiresIntake)}
            className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
              requiresIntake ? "bg-blue-600" : "bg-gray-200")}>
            <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
              requiresIntake ? "translate-x-5" : "translate-x-1")} />
          </button>
        </div>
        {requiresIntake && filteredTemplates.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-2">Template de formulario</label>
            <div className="flex flex-col gap-2">
              {filteredTemplates.map(t => (
                <button key={t.id} type="button" onClick={() => setFormTemplateId(t.id)}
                  className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                    formTemplateId === t.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                  <span className={cn("text-sm font-medium", formTemplateId === t.id ? "text-blue-900" : "text-gray-700")}>
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
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