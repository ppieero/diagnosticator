"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createTreatmentPlan } from "@/lib/services/diagnoses"
import { cn } from "@/lib/utils"

const PLAN_TYPES = [
  { value: "exercise", label: "Ejercicio terapéutico", desc: "Ejercicios, movilización, fortalecimiento" },
  { value: "therapy", label: "Terapia manual", desc: "Masoterapia, TENS, ultrasonido, manipulación" },
  { value: "medication", label: "Medicación", desc: "Fármacos, suplementos, infiltraciones" },
  { value: "diet", label: "Plan nutricional", desc: "Dieta, hábitos alimentarios" },
  { value: "combined", label: "Combinado", desc: "Múltiples modalidades de tratamiento" },
  { value: "other", label: "Otro", desc: "Otro tipo de intervención" },
]

const FREQUENCIES = ["1x semana", "2x semana", "3x semana", "Diario", "Interdiario", "1x mes", "Según evolución"]

export default function TratamientoPage() {
  const { id: patientId, eid } = useParams<{ id: string; eid: string }>()
  const router = useRouter()
  const params = useSearchParams()
  const diagnosisId = params.get("diagnosis_id") ?? ""

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState("")
  const [professionalId, setProfessionalId] = useState("")

  const [planType, setPlanType] = useState<"exercise"|"medication"|"therapy"|"diet"|"combined"|"other">("exercise")
  const [goals, setGoals] = useState("")
  const [instructions, setInstructions] = useState("")
  const [totalSessions, setTotalSessions] = useState("")
  const [frequency, setFrequency] = useState("")
  const [durationWeeks, setDurationWeeks] = useState("")
  const [startedAt, setStartedAt] = useState(new Date().toISOString().split("T")[0])
  const [endsAt, setEndsAt] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data: prof } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user?.id ?? "")
        .maybeSingle()
      // treatment_plans.professional_id → profiles.id
      setProfessionalId(user?.id ?? "")
    }
    load()
  }, [])

  async function handleSave() {
    if (!goals.trim()) { setError("Los objetivos son obligatorios"); return }
    if (!diagnosisId) { setError("No se encontró el diagnóstico asociado"); return }
    setSaving(true); setError(null)
    try {
      await createTreatmentPlan({
        diagnosis_id: diagnosisId,
        encounter_id: eid,
        patient_id: patientId,
        professional_id: professionalId,
        plan_type: planType,
        goals: goals.trim(),
        instructions: instructions || undefined,
        total_sessions: totalSessions ? parseInt(totalSessions) : undefined,
        frequency: frequency || undefined,
        duration_weeks: durationWeeks ? parseInt(durationWeeks) : undefined,
        status: "active",
        started_at: startedAt || undefined,
        ends_at: endsAt || undefined,
      })
      router.push(`/patients/${patientId}`)
    } catch {
      setError("Error al guardar el plan de tratamiento")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Plan de tratamiento</h2>
          <p className="text-xs text-gray-400">Basado en el diagnóstico registrado</p>
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de intervención</p>
        <div className="flex flex-col gap-2">
          {PLAN_TYPES.map(pt => (
            <button key={pt.value} type="button" onClick={() => setPlanType(pt.value as typeof planType)}
              className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                planType === pt.value ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300")}>
              <div className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0",
                planType === pt.value ? "bg-green-600 border-green-600" : "border-gray-400")} />
              <div>
                <p className={cn("text-sm font-medium", planType === pt.value ? "text-green-900" : "text-gray-800")}>
                  {pt.label}
                </p>
                <p className="text-xs text-gray-400">{pt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Objetivos y parámetros</p>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Objetivos del tratamiento *</label>
          <textarea value={goals} onChange={e => setGoals(e.target.value)}
            rows={3} placeholder="Objetivos clínicos medibles..." className="input-base resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Instrucciones y técnicas</label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
            rows={3} placeholder="Técnicas específicas, indicaciones, contraindicaciones..."
            className="input-base resize-none" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Sesiones</label>
            <input type="number" value={totalSessions} onChange={e => setTotalSessions(e.target.value)}
              placeholder="0" min="1" className="input-base" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Semanas</label>
            <input type="number" value={durationWeeks} onChange={e => setDurationWeeks(e.target.value)}
              placeholder="0" min="1" className="input-base" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Frecuencia</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} className="input-base">
              <option value="">Seleccionar</option>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Fecha inicio</label>
            <input type="date" value={startedAt} onChange={e => setStartedAt(e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Fecha fin estimada</label>
            <input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="input-base" />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => router.push(`/patients/${patientId}`)}
          className="flex-1 tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">
          Omitir
        </button>
        <button onClick={handleSave} disabled={saving || !goals}
          className="flex-2 tap-target rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50 px-6">
          {saving ? "Guardando..." : "Crear plan →"}
        </button>
      </div>
    </div>
  )
}
