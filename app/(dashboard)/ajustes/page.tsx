"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getProfessionalSchedule, saveScheduleDay } from "@/lib/services/availability"
import { getOrCreateProfessional } from "@/lib/services/appointments"
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

const DURATIONS = [
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
]

const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = i % 2 === 0 ? "00" : "30"
  return `${String(h).padStart(2, "0")}:${m}`
})

interface DaySchedule {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_minutes: number
  is_active: boolean
  editing?: boolean
}

export default function AjustesPage() {
  const router = useRouter()
  const [professionalId, setProfessionalId] = useState("")
  const [schedule, setSchedule] = useState<DaySchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: specs } = await supabase.from("specialties").select("id").limit(1).single()
      const profId = await getOrCreateProfessional(user.id, specs?.id ?? "")
      setProfessionalId(profId)
      const saved = await getProfessionalSchedule(profId)
      const merged = DAYS.map(d => {
        const existing = saved.find(s => s.day_of_week === d.value)
        return existing
          ? { ...existing, editing: false }
          : { day_of_week: d.value, start_time: "09:00", end_time: "18:00", slot_duration_minutes: 60, is_active: false, editing: false }
      })
      setSchedule(merged)
      setLoading(false)
    }
    load()
  }, [])

  async function handleToggle(idx: number) {
    const updated = schedule.map((d, i) =>
      i === idx ? { ...d, is_active: !d.is_active, editing: true } : d
    )
    setSchedule(updated)
  }

  async function handleSave(idx: number) {
    const day = schedule[idx]
    setSaving(idx)
    try {
      await saveScheduleDay({ ...day, professional_id: professionalId })
      const supabase = createClient()
      const saved = await getProfessionalSchedule(professionalId)
      const merged = DAYS.map(d => {
        const existing = saved.find(s => s.day_of_week === d.value)
        return existing
          ? { ...existing, editing: false }
          : { day_of_week: d.value, start_time: "09:00", end_time: "18:00", slot_duration_minutes: 60, is_active: false, editing: false }
      })
      setSchedule(merged)
    } finally {
      setSaving(null)
    }
  }

  function updateDay(idx: number, field: string, value: string | number | boolean) {
    setSchedule(prev => prev.map((d, i) =>
      i === idx ? { ...d, [field]: value, editing: true } : d
    ))
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Horario de atencion</h2>
          <p className="text-xs text-gray-400 mt-0.5">Configura los dias y horas en que atiendes</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
        <p className="text-xs text-blue-800">
          Solo se mostraran slots disponibles en los dias y horarios configurados aqui.
          Si un dia no esta activo, no aparecera en la agenda para agendar citas.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {schedule.map((day, idx) => {
          const dayLabel = DAYS.find(d => d.value === day.day_of_week)?.label
          return (
            <div key={day.day_of_week} className={cn(
              "border rounded-2xl overflow-hidden transition-all",
              day.is_active ? "border-blue-300" : "border-gray-200"
            )}>
              <div className={cn(
                "flex items-center justify-between px-4 py-3",
                day.is_active ? "bg-blue-50" : "bg-white"
              )}>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => handleToggle(idx)}
                    className={cn(
                      "relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
                      day.is_active ? "bg-blue-600" : "bg-gray-200"
                    )}>
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                      day.is_active ? "translate-x-5" : "translate-x-1"
                    )} />
                  </button>
                  <span className={cn(
                    "text-sm font-semibold",
                    day.is_active ? "text-blue-900" : "text-gray-500"
                  )}>{dayLabel}</span>
                </div>
                {day.is_active && !day.editing && (
                  <span className="text-xs text-gray-500">
                    {day.start_time} - {day.end_time} · {day.slot_duration_minutes} min
                  </span>
                )}
              </div>

              {day.is_active && (
                <div className="px-4 pb-4 pt-2 flex flex-col gap-3 bg-white">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Inicio</label>
                      <select value={day.start_time}
                        onChange={e => updateDay(idx, "start_time", e.target.value)}
                        className="input-base text-sm">
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Fin</label>
                      <select value={day.end_time}
                        onChange={e => updateDay(idx, "end_time", e.target.value)}
                        className="input-base text-sm">
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Duracion de cada cita</label>
                    <div className="flex gap-2 flex-wrap">
                      {DURATIONS.map(d => (
                        <button key={d.value} type="button"
                          onClick={() => updateDay(idx, "slot_duration_minutes", d.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                            day.slot_duration_minutes === d.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                          )}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => handleSave(idx)} disabled={saving === idx}
                    className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50">
                    {saving === idx ? "Guardando..." : "Guardar horario"}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}