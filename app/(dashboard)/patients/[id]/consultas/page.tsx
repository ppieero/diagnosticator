"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface Encounter {
  id: string
  status: string
  encounter_type: string
  session_number: number
  started_at: string
  completed_at?: string
  soap_notes?: string
  specialty_id: string
  specialty?: { name: string; color: string }
  forms?: { id: string; template?: { name: string }; answers: Record<string, unknown> }[]
}

const STATUS_CONFIG = {
  completed:   { label: "Completada",  bg: "bg-green-100",  text: "text-green-800" },
  in_progress: { label: "En curso",    bg: "bg-blue-100",   text: "text-blue-800" },
  cancelled:   { label: "Cancelada",   bg: "bg-gray-100",   text: "text-gray-500" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}
function duration(start: string, end?: string) {
  if (!end) return null
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  return `${mins} min`
}

export default function ConsultasHistorialPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const router = useRouter()
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(true)
  const [patientName, setPatientName] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterSpecialty, setFilterSpecialty] = useState("")
  const [specialties, setSpecialties] = useState<{ id: string; name: string; color: string }[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [patRes, encRes, spRes] = await Promise.all([
        supabase.from("patients").select("full_name").eq("id", patientId).single(),
        supabase.from("evaluations").select("*").eq("patient_id", patientId).order("started_at", { ascending: false }),
        supabase.from("specialties").select("id, name, color").eq("is_active", true),
      ])
      setPatientName(patRes.data?.full_name ?? "")
      setSpecialties(spRes.data ?? [])
      const encs = (encRes.data ?? []) as Encounter[]
      const spMap = Object.fromEntries((spRes.data ?? []).map(s => [s.id, s]))
      for (const enc of encs) {
        enc.specialty = spMap[enc.specialty_id]
        const { data: forms } = await supabase
          .from("encounter_forms")
          .select("id, answers, template:specialty_form_templates(name)")
          .eq("encounter_id", enc.id)
        enc.forms = (forms ?? []) as unknown as Encounter["forms"]
      }
      setEncounters(encs)
      setLoading(false)
    }
    load()
  }, [patientId])

  const filtered = encounters.filter(e => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false
    if (filterSpecialty && e.specialty_id !== filterSpecialty) return false
    return true
  })

  const stats = {
    total: encounters.length,
    completed: encounters.filter(e => e.status === "completed").length,
    inProgress: encounters.filter(e => e.status === "in_progress").length,
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

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
          <h2 className="text-xl font-bold text-gray-900">Historial de consultas</h2>
          <p className="text-xs text-gray-400 mt-0.5">{patientName}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: stats.total, color: "text-gray-800" },
          { label: "Completadas", value: stats.completed, color: "text-green-700" },
          { label: "En curso", value: stats.inProgress, color: "text-blue-700" },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterStatus("all")}
          className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
            filterStatus === "all" ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500")}>
          Todas
        </button>
        <button onClick={() => setFilterStatus("completed")}
          className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
            filterStatus === "completed" ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-500")}>
          Completadas
        </button>
        <button onClick={() => setFilterStatus("in_progress")}
          className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
            filterStatus === "in_progress" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500")}>
          En curso
        </button>
        {specialties.map(sp => (
          <button key={sp.id} onClick={() => setFilterSpecialty(filterSpecialty === sp.id ? "" : sp.id)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
              filterSpecialty === sp.id ? "text-white border-transparent" : "border-gray-200 text-gray-500")}
            style={filterSpecialty === sp.id ? { background: sp.color, borderColor: sp.color } : {}}>
            {sp.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">📋</span>
          <p className="text-sm font-medium text-gray-500">No hay consultas registradas</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(enc => {
          const st = STATUS_CONFIG[enc.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.cancelled
          const sp = enc.specialty
          const isExpanded = expanded === enc.id
          const dur = duration(enc.started_at, enc.completed_at)
          return (
            <div key={enc.id} className="card overflow-hidden">
              <button onClick={() => setExpanded(isExpanded ? null : enc.id)}
                className="w-full flex items-start gap-3 p-4 text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: sp?.color ? sp.color + "22" : "#f3f4f6" }}>
                  <span className="text-sm font-bold" style={{ color: sp?.color ?? "#888" }}>
                    #{enc.session_number}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(enc.started_at)}
                    </p>
                    {sp && (
                      <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                        style={{ background: sp.color + "22", color: sp.color }}>
                        {sp.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatTime(enc.started_at)}
                    {dur && ` · ${dur}`}
                    {enc.forms && enc.forms.length > 0 && ` · ${enc.forms.length} formulario${enc.forms.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={cn("text-xs font-medium px-2 py-1 rounded-lg", st.bg, st.text)}>
                    {st.label}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={cn("text-gray-400 transition-transform", isExpanded ? "rotate-180" : "")}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4 flex flex-col gap-3 pt-3">
                  {enc.soap_notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notas SOAP</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2.5">{enc.soap_notes}</p>
                    </div>
                  )}

                  {enc.forms && enc.forms.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Formularios completados</p>
                      <div className="flex flex-col gap-2">
                        {enc.forms.map(form => {
                          const tmplName = (form.template as { name: string } | undefined)?.name ?? "Formulario"
                          const answerCount = Object.keys(form.answers ?? {}).filter(k => {
                            const v = form.answers[k]
                            return v !== undefined && v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
                          }).length
                          return (
                            <div key={form.id} className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                              <p className="text-xs font-medium text-blue-900">{tmplName}</p>
                              <p className="text-xs text-blue-600 mt-0.5">{answerCount} campos completados</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {enc.status === "in_progress" && (
                    <button onClick={() => router.push(`/consulta/${enc.id}`)}
                      className="tap-target w-full rounded-xl bg-blue-600 text-white text-xs font-semibold">
                      Continuar consulta →
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}