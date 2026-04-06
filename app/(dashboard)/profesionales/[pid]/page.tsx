"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getProfessional, updateProfessional, updateProfile, saveSchedule } from "@/lib/services/professionals"
import type { ProfessionalFull, ScheduleDay } from "@/lib/services/professionals"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
]

const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = i % 2 === 0 ? "00" : "30"
  return `${String(h).padStart(2, "0")}:${m}`
})

const COLORS = [
  "#185FA5","#0F6E56","#993C1D","#534AB7",
  "#3B6D11","#854F0B","#993556","#5F5E5A",
  "#A32D2D","#0C447C","#085041","#712B13",
]

const DURATIONS = [
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
]

const TABS = ["Datos", "Horario", "Servicios"]

export default function ProfesionalDetailPage() {
  const { pid } = useParams<{ pid: string }>()
  const router = useRouter()
  const [prof, setProf] = useState<ProfessionalFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [services, setServices] = useState<{ id: string; name: string; specialty_id: string }[]>([])

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [bio, setBio] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#185FA5")
  const [slotDuration, setSlotDuration] = useState(60)
  const [isActive, setIsActive] = useState(true)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [schedule, setSchedule] = useState<ScheduleDay[]>(
    DAYS.map(d => ({
      professional_id: pid,
      day_of_week: d.value,
      start_time: "09:00",
      end_time: "18:00",
      slot_duration_minutes: 60,
      is_active: false,
    }))
  )

  useEffect(() => {
    async function load() {
      const data = await getProfessional(pid)
      if (!data) { router.push("/profesionales"); return }
      setProf(data)
      const profile = data.profile as { full_name: string; email?: string; phone?: string }
      setFullName(profile?.full_name ?? "")
      setEmail(profile?.email ?? "")
      setPhone(profile?.phone ?? "")
      setLicenseNumber(data.license_number ?? "")
      setBio(data.bio ?? "")
      setDescription(data.description ?? "")
      setColor(data.color ?? "#185FA5")
      setSlotDuration(data.slot_duration ?? 60)
      setIsActive(data.is_active)
      setSelectedServices(data.services_ids ?? [])

      if (data.schedule && data.schedule.length > 0) {
        setSchedule(DAYS.map(d => {
          const saved = data.schedule!.find(s => s.day_of_week === d.value)
          return saved
            ? { ...saved }
            : { professional_id: pid, day_of_week: d.value, start_time: "09:00", end_time: "18:00", slot_duration_minutes: 60, is_active: false }
        }))
      }

      const supabase = createClient()
      const { data: srvs } = await supabase
        .from("services")
        .select("id, name, specialty_id")
        .eq("is_active", true)
        .order("name")
      setServices(srvs ?? [])
      setLoading(false)
    }
    load()
  }, [pid, router])

  async function handleSave() {
    if (!prof) return
    setSaving(true)
    try {
      await updateProfile(prof.user_id, { full_name: fullName, email, phone })
      await updateProfessional(prof.id, {
        license_number: licenseNumber,
        bio, description, color,
        slot_duration: slotDuration,
        is_active: isActive,
        services_ids: selectedServices,
      })
      await saveSchedule(prof.id, schedule)
      router.push("/profesionales")
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function updateScheduleDay(idx: number, field: string, value: string | number | boolean) {
    setSchedule(prev => prev.map((d, i) =>
      i === idx ? { ...d, [field]: value } : d
    ))
  }

  function toggleService(id: string) {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const filteredServices = services.filter(s =>
    !prof?.specialty_id || s.specialty_id === prof.specialty_id
  )

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!prof) return null

  const profile = prof.profile as { full_name: string }

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
            style={{ background: color }}>
            {fullName?.charAt(0).toUpperCase() ?? "P"}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{fullName}</p>
            <p className="text-xs text-gray-400">
              {(prof.specialty as { name: string })?.name}
            </p>
          </div>
        </div>
        <button
          onClick={() => updateProfessional(prof.id, { is_active: !isActive }).then(() => setIsActive(!isActive))}
          className={cn("text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors",
            isActive ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-gray-50 text-gray-500"
          )}>
          {isActive ? "Activo" : "Inactivo"}
        </button>
      </div>

      <div className="flex gap-1 border border-gray-200 rounded-xl p-0.5">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={cn("flex-1 py-2 text-xs font-medium rounded-lg transition-colors",
              activeTab === i ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"
            )}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <div className="flex flex-col gap-4">
          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos personales</p>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nombre completo</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} className="input-base" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Telefono</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input-base" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">N° de licencia / colegiado</label>
              <input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)}
                placeholder="Ej: 12345" className="input-base" />
            </div>
          </div>

          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Perfil clinico</p>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Bio corta (resumen)</label>
              <input value={bio} onChange={e => setBio(e.target.value)}
                placeholder="Especialista en..." className="input-base" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Descripcion completa</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={3} placeholder="Descripcion para los pacientes..." className="input-base resize-none" />
            </div>
          </div>

          <div className="card p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color identificador</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn("w-9 h-9 rounded-xl transition-all",
                    color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"
                  )}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="flex flex-col gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-800">
              Los horarios configurados aqui determinan los slots disponibles en la agenda.
              Las zonas fuera del horario apareceran en amarillo y no permitiran agendar citas.
            </p>
          </div>

          <div className="card p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Duracion de cada slot</p>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button key={d.value} type="button" onClick={() => setSlotDuration(d.value)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                    slotDuration === d.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  )}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {schedule.map((day, idx) => {
              const dayLabel = DAYS.find(d => d.value === day.day_of_week)?.label
              return (
                <div key={day.day_of_week} className={cn(
                  "border rounded-2xl overflow-hidden",
                  day.is_active ? "border-blue-300" : "border-gray-200"
                )}>
                  <div className={cn("flex items-center justify-between px-4 py-3",
                    day.is_active ? "bg-blue-50" : "bg-white")}>
                    <div className="flex items-center gap-3">
                      <button type="button"
                        onClick={() => updateScheduleDay(idx, "is_active", !day.is_active)}
                        className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
                          day.is_active ? "bg-blue-600" : "bg-gray-200")}>
                        <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                          day.is_active ? "translate-x-5" : "translate-x-1")} />
                      </button>
                      <span className={cn("text-sm font-semibold",
                        day.is_active ? "text-blue-900" : "text-gray-500")}>{dayLabel}</span>
                    </div>
                    {day.is_active && (
                      <span className="text-xs text-gray-500">{day.start_time} – {day.end_time}</span>
                    )}
                  </div>
                  {day.is_active && (
                    <div className="px-4 pb-3 pt-2 grid grid-cols-2 gap-3 bg-white">
                      <div>
                        <label className="text-xs text-gray-400 font-medium block mb-1">Inicio</label>
                        <select value={day.start_time}
                          onChange={e => updateScheduleDay(idx, "start_time", e.target.value)}
                          className="input-base text-sm">
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 font-medium block mb-1">Fin</label>
                        <select value={day.end_time}
                          onChange={e => updateScheduleDay(idx, "end_time", e.target.value)}
                          className="input-base text-sm">
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 2 && (
        <div className="flex flex-col gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800">
              Selecciona los servicios que ofrece este profesional.
              Solo se muestran servicios de su especialidad.
            </p>
          </div>
          {filteredServices.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-sm text-gray-400">No hay servicios configurados para esta especialidad.</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {filteredServices.map(sv => {
              const selected = selectedServices.includes(sv.id)
              return (
                <button key={sv.id} type="button" onClick={() => toggleService(sv.id)}
                  className={cn("flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left",
                    selected ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white")}>
                  <span className={cn("text-sm font-medium", selected ? "text-blue-900" : "text-gray-800")}>
                    {sv.name}
                  </span>
                  <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                    selected ? "bg-blue-600 border-blue-600" : "border-gray-300")}>
                    {selected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  )
}