"use client"
import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { UUID } from "@/types/domain"

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface EvaluationRecord {
  id: UUID
  started_at: string
  ended_at?: string
  status: string
  specialty_id?: string
  patient: {
    id: UUID
    full_name: string
    biological_sex: string
    birth_date: string
  } | null
  specialty: {
    id: UUID
    name: string
    color: string
  } | null
  performer: {
    full_name: string
  } | null
}

interface FormResponseRow {
  id: UUID
  encounter_id: UUID
}

interface DiagnosisRow {
  id: UUID
  evaluation_id: UUID
  diagnosis_code?: string
}

interface TreatmentPlanRow {
  id: UUID
  diagnosis_id: UUID
  status: string
}

interface EnrichedRecord {
  evaluation: EvaluationRecord
  hasFormResponse: boolean
  diagnosis: DiagnosisRow | null
  activePlan: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  if (isToday) return `Hoy · ${time}`
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 1) return `Ayer · ${time}`
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) + ` · ${time}`
}

function periodFilter(iso: string, period: string): boolean {
  if (period === "all") return true
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
  const cutoff = Date.now() - days * 86400000
  return new Date(iso).getTime() >= cutoff
}

function getBadge(hasForm: boolean, hasDx: boolean, hasPlan: boolean): { label: string; bg: string; text: string } {
  if (hasForm && hasDx && hasPlan) return { label: "Completo", bg: "#EAF3DE", text: "#27500A" }
  if (hasForm && hasDx) return { label: "Diagnóstico", bg: "#FAEEDA", text: "#633806" }
  return { label: "Parcial", bg: "#F1EFE8", text: "#444441" }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ExpedientePage() {
  const router = useRouter()
  const [records, setRecords] = useState<EnrichedRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState("")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")
  const [periodFilter2, setPeriodFilter2] = useState("all")
  const [professionalFilter, setProfessionalFilter] = useState("all")

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // 1. Evaluations completadas + specialties en paralelo
      // (no hay FK registrada entre evaluations y specialties en PostgREST,
      //  por eso se carga la tabla completa y se hace el join en cliente)
      const [evalsRes, specsRes] = await Promise.all([
        supabase
          .from("evaluations")
          .select(`
            *,
            patient:patients(id, full_name, biological_sex, birth_date),
            performed_by
          `)
          .eq("status", "completed")
          .order("started_at", { ascending: false }),
        supabase
          .from("specialties")
          .select("id, name, color"),
      ])

      if (evalsRes.error || !evalsRes.data) { setLoading(false); return }

      // Mapa specialty_id → specialty
      const specMap = new Map<string, { id: string; name: string; color: string }>()
      for (const s of (specsRes.data ?? [])) {
        specMap.set(s.id as string, { id: s.id as string, name: s.name as string, color: s.color as string })
      }

      const evalsRaw = evalsRes.data
      const evals = evalsRaw.map(ev => ({
        ...ev,
        specialty: ev.specialty_id ? (specMap.get(ev.specialty_id as string) ?? null) : null,
      })) as unknown as EvaluationRecord[]

      const evalIds = evals.map(e => e.id)

      if (evalIds.length === 0) { setLoading(false); return }

      // 2. Form responses + diagnoses en paralelo
      const [frRes, dxRes] = await Promise.all([
        supabase
          .from("form_responses")
          .select("id, encounter_id")
          .in("encounter_id", evalIds),
        supabase
          .from("diagnoses")
          .select("id, evaluation_id, diagnosis_code")
          .in("evaluation_id", evalIds),
      ])

      const formResponses: FormResponseRow[] = (frRes.data ?? []) as FormResponseRow[]
      const diagnoses: DiagnosisRow[] = (dxRes.data ?? []) as DiagnosisRow[]

      // 3. Treatment plans agrupados por diagnosis_ids
      const diagnosisIds = diagnoses.map(d => d.id)
      let treatmentPlans: TreatmentPlanRow[] = []
      if (diagnosisIds.length > 0) {
        const { data: tpRaw } = await supabase
          .from("treatment_plans")
          .select("id, diagnosis_id, status")
          .in("diagnosis_id", diagnosisIds)
        treatmentPlans = (tpRaw ?? []) as TreatmentPlanRow[]
      }

      // 4. Indexar
      const frByEval = new Set(formResponses.map(f => f.encounter_id))
      const dxByEval = new Map<UUID, DiagnosisRow>()
      for (const d of diagnoses) dxByEval.set(d.evaluation_id, d)
      const activePlanByDx = new Set<UUID>()
      for (const tp of treatmentPlans) {
        if (tp.status === "active") activePlanByDx.add(tp.diagnosis_id)
      }

      const enriched: EnrichedRecord[] = evals.map(ev => {
        const dx = dxByEval.get(ev.id) ?? null
        return {
          evaluation: ev,
          hasFormResponse: frByEval.has(ev.id),
          diagnosis: dx,
          activePlan: dx ? activePlanByDx.has(dx.id) : false,
        }
      })

      setRecords(enriched)
      setLoading(false)
    }
    load()
  }, [])

  // Listas de filtros
  const specialties = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of records) {
      if (r.evaluation.specialty) {
        map.set(r.evaluation.specialty.id, r.evaluation.specialty.name)
      }
    }
    return Array.from(map.entries())
  }, [records])

  const professionals = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) {
      if (r.evaluation.performer?.full_name) set.add(r.evaluation.performer.full_name)
    }
    return Array.from(set)
  }, [records])

  // Filtrado client-side
  const filtered = useMemo(() => {
    return records.filter(r => {
      const name = r.evaluation.patient?.full_name ?? ""
      if (search && !name.toLowerCase().includes(search.toLowerCase())) return false
      if (specialtyFilter !== "all" && r.evaluation.specialty?.id !== specialtyFilter) return false
      if (periodFilter2 !== "all" && !periodFilter(r.evaluation.started_at, periodFilter2)) return false
      if (professionalFilter !== "all" && r.evaluation.performer?.full_name !== professionalFilter) return false
      return true
    })
  }, [records, search, specialtyFilter, periodFilter2, professionalFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 py-5 fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Records Clínicos</h1>
        <span
          className="text-sm font-semibold px-3 py-1 rounded-full"
          style={{ background: "#E6F1FB", color: "#0C447C" }}
        >
          {filtered.length} records
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 mb-5">
        <input
          type="text"
          placeholder="Buscar paciente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-base"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <select
            value={specialtyFilter}
            onChange={e => setSpecialtyFilter(e.target.value)}
            className="input-base flex-shrink-0 w-auto text-sm"
            style={{ minWidth: 130 }}
          >
            <option value="all">Especialidad</option>
            {specialties.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={periodFilter2}
            onChange={e => setPeriodFilter2(e.target.value)}
            className="input-base flex-shrink-0 w-auto text-sm"
            style={{ minWidth: 130 }}
          >
            <option value="all">Todo el tiempo</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 3 meses</option>
          </select>
          <select
            value={professionalFilter}
            onChange={e => setProfessionalFilter(e.target.value)}
            className="input-base flex-shrink-0 w-auto text-sm"
            style={{ minWidth: 130 }}
          >
            <option value="all">Profesional</option>
            {professionals.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No se encontraron records con los filtros seleccionados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(r => (
            <RecordCard key={r.evaluation.id} record={r} onTap={() => router.push(`/expediente/${r.evaluation.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── RecordCard ────────────────────────────────────────────────────────────────

function RecordCard({ record, onTap }: { record: EnrichedRecord; onTap: () => void }) {
  const { evaluation, hasFormResponse, diagnosis, activePlan } = record
  const patient = evaluation.patient
  const specialty = evaluation.specialty
  const performer = evaluation.performer

  const initials = patient ? getInitials(patient.full_name) : "?"
  const badge = getBadge(hasFormResponse, diagnosis !== null, activePlan)
  const avatarColor = specialty?.color ?? "#4B5563"

  return (
    <button
      onClick={onTap}
      className={cn("card tap-target w-full text-left p-4 transition-all active:scale-[0.98]")}
      style={{ cursor: "pointer" }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
          style={{ background: avatarColor }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-900 truncate text-sm">
              {patient?.full_name ?? "Paciente desconocido"}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {fmtDate(evaluation.started_at)}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {specialty?.name ?? "Sin especialidad"}
            {performer?.full_name ? ` · ${performer.full_name}` : ""}
          </div>

          {/* Flujo clínico visual */}
          <div className="flex items-center gap-2 mt-3">
            {/* Punto 1: evaluación (siempre verde) */}
            <div className="relative group">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-xs bg-gray-800 text-white px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                Evaluación
              </span>
            </div>

            {/* Línea */}
            <div className={cn("h-px flex-1 max-w-[32px]", diagnosis ? "bg-gray-400" : "bg-gray-200")} />

            {/* Punto 2: diagnóstico */}
            <div className="relative group">
              <div
                className={cn("w-3 h-3 rounded-full", diagnosis ? "bg-red-500" : "bg-gray-200")}
              />
              {diagnosis && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-xs bg-gray-800 text-white px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                  {diagnosis.diagnosis_code ? `CIE-10: ${diagnosis.diagnosis_code}` : "Diagnóstico"}
                </span>
              )}
            </div>

            {/* Línea */}
            <div className={cn("h-px flex-1 max-w-[32px]", activePlan ? "bg-gray-400" : "bg-gray-200")} />

            {/* Punto 3: plan de tratamiento */}
            <div className="relative group">
              <div
                className={cn("w-3 h-3 rounded-full", activePlan ? "bg-green-800" : "bg-gray-200")}
              />
              {activePlan && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-xs bg-gray-800 text-white px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                  Plan activo
                </span>
              )}
            </div>

            {/* Badge */}
            <span
              className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: badge.bg, color: badge.text }}
            >
              {badge.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
