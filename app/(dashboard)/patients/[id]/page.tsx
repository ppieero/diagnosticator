"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getPatient } from "@/lib/services/patients"
import { getPatientDiagnoses } from "@/lib/services/diagnoses"
import type { Patient, Diagnosis, TreatmentPlan, Anamnesis } from "@/types/domain"
import { cn } from "@/lib/utils"

interface Encounter {
  id: string
  status: string
  session_number: number
  started_at: string
  completed_at?: string
  specialty_id: string
  specialty?: { name: string; color: string }
  forms?: { id: string; template?: { name: string }; answers: Record<string, unknown> }[]
  diagnosis?: Diagnosis | null
}

interface PackageItem {
  id: string
  status: string
  sessions_used: number
  total_sessions: number
  payment_mode: string
  service?: { name: string; specialty?: { name: string; color: string } }
  package?: { name: string }
}

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  mild:     { label: "Leve",     bg: "#EAF3DE", text: "#27500A" },
  moderate: { label: "Moderado", bg: "#FAEEDA", text: "#633806" },
  severe:   { label: "Severo",   bg: "#FCEBEB", text: "#791F1F" },
  critical: { label: "Crítico",  bg: "#F7C1C1", text: "#501313" },
}

const STATUS_DX: Record<string, { label: string; bg: string; text: string }> = {
  confirmed:    { label: "Confirmado",  bg: "#EAF3DE", text: "#27500A" },
  presumptive:  { label: "Presuntivo",  bg: "#FAEEDA", text: "#633806" },
  under_review: { label: "En revisión", bg: "#E6F1FB", text: "#0C447C" },
  ruled_out:    { label: "Descartado",  bg: "#F1EFE8", text: "#444441" },
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  exercise:   "Ejercicio terapéutico",
  medication: "Medicación",
  therapy:    "Terapia manual",
  diet:       "Plan nutricional",
  combined:   "Combinado",
  other:      "Otro",
}

const PLAN_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: "Activo",     bg: "#EAF3DE", text: "#27500A" },
  on_hold:   { label: "En espera",  bg: "#FAEEDA", text: "#633806" },
  completed: { label: "Completado", bg: "#E6F1FB", text: "#0C447C" },
  stopped:   { label: "Detenido",   bg: "#F1EFE8", text: "#444441" },
}

function calcAge(birthDate?: string): number | null {
  if (!birthDate) return null
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000)
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

type Tab = "todo" | "evaluaciones" | "diagnosticos" | "tratamientos" | "paquetes"

const TABS: { val: Tab; label: string }[] = [
  { val: "todo",          label: "Todo" },
  { val: "evaluaciones",  label: "Evalua." },
  { val: "diagnosticos",  label: "Diagnós." },
  { val: "tratamientos",  label: "Trata." },
  { val: "paquetes",      label: "Paquetes" },
]

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null)
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [packages, setPackages] = useState<PackageItem[]>([])
  const [catalogPackages, setCatalogPackages] = useState<{ id: string; name: string; price: number }[]>([])
  const [catalogServices, setCatalogServices] = useState<{ id: string; name: string; price: number; specialty?: { name: string; color: string } }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("todo")
  const [expandedEnc, setExpandedEnc] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [pat, dxRes, spRes] = await Promise.all([
        getPatient(id),
        getPatientDiagnoses(id),
        supabase.from("specialties").select("id, name, color").eq("is_active", true),
      ])

      setPatient(pat)
      setDiagnoses(dxRes)

      const spMap = Object.fromEntries((spRes.data ?? []).map(s => [s.id, s]))

      const [encRes, anamRes, pkgRes, catPkgRes, catSvcRes] = await Promise.all([
        supabase.from("evaluations").select("*").eq("patient_id", id).order("started_at", { ascending: false }),
        supabase.from("anamnesis").select("*").eq("patient_id", id).maybeSingle(),
        supabase.from("patient_service_packages")
          .select("*, service:services(name, specialty:specialties(name, color)), package:packages(name)")
          .eq("patient_id", id)
          .order("purchased_at", { ascending: false }),
        supabase.from("packages").select("id, name, price").eq("is_active", true),
        supabase.from("services")
          .select("id, name, price, specialty:specialties(name, color)")
          .eq("is_active", true)
          .eq("session_count", 1),
      ])

      setAnamnesis(anamRes.data as Anamnesis | null)
      setPackages((pkgRes.data ?? []) as unknown as PackageItem[])
      setCatalogPackages(catPkgRes.data ?? [])
      setCatalogServices((catSvcRes.data ?? []) as unknown as typeof catalogServices)

      const encs = ((encRes.data ?? []) as Encounter[]).map(e => ({
        ...e,
        specialty: spMap[e.specialty_id],
      }))

      for (const enc of encs) {
        const { data: forms } = await supabase
          .from("form_responses")
          .select("id, answers, template:specialty_form_templates(name)")
          .eq("encounter_id", enc.id)
        enc.forms = (forms ?? []) as unknown as Encounter["forms"]
        enc.diagnosis = dxRes.find(d => d.evaluation_id === enc.id) ?? null
      }

      setEncounters(encs)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!patient) return null

  const patAge = calcAge(patient.birth_date)
  const initials = patient.full_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
  const sexLabel = patient.biological_sex === "male" ? "M" : patient.biological_sex === "female" ? "F" : ""
  const activeDx = diagnoses.filter(d => d.status !== "ruled_out")
  const allPlans = diagnoses.flatMap(d => (d.treatment_plans ?? []).map(tp => ({ ...tp, diagnosis: d })))
  const activePlans = allPlans.filter(p => p.status === "active")
  const activePackages = packages.filter(p => p.status === "active")
  const completedEnc = encounters.filter(e => e.status === "completed").length

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-blue-800">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">{patient.full_name}</p>
            <p className="text-xs text-gray-400">
              {patAge ? `${patAge} años` : ""}
              {sexLabel ? ` · ${sexLabel}` : ""}
              {patient.birth_date ? ` · ${fmt(patient.birth_date)}` : ""}
            </p>
          </div>
        </div>
        <button onClick={() => router.push(`/patients/${id}/edit`)}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      {/* Badges activos */}
      {(activeDx.length > 0 || activePlans.length > 0 || activePackages.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {activeDx.slice(0, 2).map(d => (
            <span key={d.id} className="text-xs font-medium px-2.5 py-1 rounded-xl"
              style={{ background: "#FCEBEB", color: "#791F1F" }}>
              {d.diagnosis_name}
            </span>
          ))}
          {activePlans.length > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-green-100 text-green-800">
              {activePlans.length} plan{activePlans.length > 1 ? "es" : ""} activo{activePlans.length > 1 ? "s" : ""}
            </span>
          )}
          {activePackages.length > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-blue-100 text-blue-800">
              {activePackages.length} paquete{activePackages.length > 1 ? "s" : ""} activo{activePackages.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Sesiones",   value: completedEnc,          color: "text-gray-900" },
          { label: "Diagnóst.",  value: diagnoses.length,       color: "text-red-700" },
          { label: "Planes",     value: allPlans.length,        color: "text-green-700" },
          { label: "Paquetes",   value: activePackages.length,  color: "text-blue-700" },
        ].map(s => (
          <div key={s.label} className="card p-2 text-center">
            <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Datos personales */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos personales</p>
        </div>
        {[
          { label: "Documento",  value: patient.document_type && patient.document_number ? `${patient.document_type.toUpperCase()} · ${patient.document_number}` : undefined },
          { label: "Teléfono",   value: patient.phone },
          { label: "Email",      value: patient.email },
          { label: "Dirección",  value: patient.address },
          { label: "Notas",      value: patient.notes },
        ].filter(r => r.value).map((row, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{row.label}</span>
            <span className="text-xs text-gray-700 flex-1">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Antecedentes clínicos */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Antecedentes clínicos</p>
        </div>
        {!anamnesis ? (
          <div className="px-4 py-4 flex items-center justify-between">
            <span className="text-xs text-gray-400">Sin anamnesis registrada</span>
          </div>
        ) : (
          <>
            {anamnesis.main_complaint && (
              <div className="flex items-start gap-3 px-4 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Motivo</span>
                <span className="text-xs text-gray-700 flex-1">{anamnesis.main_complaint}</span>
              </div>
            )}
            {(anamnesis.height_cm || anamnesis.weight_kg) && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0">Talla / Peso</span>
                <span className="text-xs text-gray-700">
                  {anamnesis.height_cm ? `${anamnesis.height_cm} cm` : "—"}
                  {" · "}
                  {anamnesis.weight_kg ? `${anamnesis.weight_kg} kg` : "—"}
                </span>
              </div>
            )}
            {anamnesis.known_allergies && (anamnesis.known_allergies as unknown[]).length > 0 && (
              <div className="flex items-start gap-3 px-4 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Alergias</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {(anamnesis.known_allergies as { substance: string; severity: string }[]).map((a, i) => (
                    <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-lg bg-red-100 text-red-700">
                      ⚠ {a.substance}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {anamnesis.active_medications && (anamnesis.active_medications as unknown[]).length > 0 && (
              <div className="flex items-start gap-3 px-4 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Medicación</span>
                <div className="flex flex-col gap-0.5 flex-1">
                  {(anamnesis.active_medications as { name: string; dose?: string }[]).map((m, i) => (
                    <span key={i} className="text-xs text-gray-700">
                      {m.name}{m.dose ? ` · ${m.dose}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {anamnesis.personal_history && (anamnesis.personal_history as unknown[]).length > 0 && (
              <div className="flex items-start gap-3 px-4 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Antecedentes</span>
                <div className="flex flex-col gap-0.5 flex-1">
                  {(anamnesis.personal_history as { condition: string; status: string }[]).map((h, i) => (
                    <span key={i} className="text-xs text-gray-700">
                      {h.condition}{h.status === "active" ? " (activo)" : h.status === "chronic" ? " (crónico)" : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(anamnesis.smoking_status !== "never" || anamnesis.alcohol_status !== "none") && (
              <div className="flex items-center gap-3 px-4 py-2">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0">Hábitos</span>
                <div className="flex gap-2 flex-wrap">
                  {anamnesis.smoking_status && anamnesis.smoking_status !== "never" && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700">
                      Tabaco: {{ former: "ex-fumador", current: "fumador", unknown: "desconocido" }[anamnesis.smoking_status] ?? anamnesis.smoking_status}
                    </span>
                  )}
                  {anamnesis.alcohol_status && anamnesis.alcohol_status !== "none" && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-yellow-100 text-yellow-700">
                      Alcohol: {{ occasional: "ocasional", moderate: "moderado", heavy: "frecuente", unknown: "desconocido" }[anamnesis.alcohol_status] ?? anamnesis.alcohol_status}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => router.push(`/agenda/nueva?patient_id=${id}`)}
          className="tap-target rounded-xl bg-blue-600 text-white text-xs font-semibold">
          + Nueva cita
        </button>
        <button onClick={() => router.push(`/pagos/nuevo?patient_id=${id}`)}
          className="tap-target rounded-xl border border-gray-300 text-gray-700 text-xs font-medium">
          Registrar pago
        </button>
      </div>

      {/* Historia clínica — tabs */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historia clínica</p>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {TABS.map(({ val, label }) => (
            <button key={val} onClick={() => setTab(val)}
              className={cn("flex-1 py-2 rounded-lg text-[10px] font-medium transition-all",
                tab === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}>
              {label}
            </button>
          ))}
        </div>

        {/* TAB TODO */}
        {tab === "todo" && (
          <div className="flex flex-col gap-3">
            {encounters.length === 0 && (
              <div className="card p-8 text-center flex flex-col gap-2">
                <p className="text-sm text-gray-400">Sin historia clínica registrada</p>
                <p className="text-xs text-gray-400">Inicia una consulta desde la agenda</p>
              </div>
            )}
            {encounters.map(enc => {
              const sp = enc.specialty
              const dx = enc.diagnosis
              const plans = dx?.treatment_plans ?? []
              const isExp = expandedEnc === enc.id
              return (
                <div key={enc.id} className="card overflow-hidden">
                  <button onClick={() => setExpandedEnc(isExp ? null : enc.id)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: sp?.color ? sp.color + "22" : "#f3f4f6" }}>
                      <span className="text-xs font-bold" style={{ color: sp?.color ?? "#888" }}>
                        #{enc.session_number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{fmt(enc.started_at)}</p>
                        {sp && (
                          <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                            style={{ background: sp.color + "22", color: sp.color }}>
                            {sp.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {dx && <span className="text-xs text-red-600">● {dx.diagnosis_name}</span>}
                        {plans.some(p => p.status === "active") && (
                          <span className="text-xs text-green-700">● Plan activo</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-lg",
                        enc.status === "completed" ? "bg-green-100 text-green-800" :
                        enc.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                        "bg-gray-100 text-gray-500")}>
                        {enc.status === "completed" ? "Completada" :
                         enc.status === "in_progress" ? "En curso" : "Cancelada"}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={cn("text-gray-400 transition-transform", isExp ? "rotate-180" : "")}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </button>

                  {isExp && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">

                      {/* Evaluación */}
                      {(enc.forms?.length ?? 0) > 0 && (
                        <div className="px-4 py-3 flex flex-col gap-2">
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Evaluación</p>
                          {enc.forms?.map(form => (
                            <div key={form.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              <p className="text-xs font-medium text-blue-900 flex-1">
                                {(form.template as { name: string } | undefined)?.name ?? "Formulario"}
                              </p>
                              <p className="text-xs text-blue-500">
                                {Object.values(form.answers ?? {}).filter(v => v !== "" && v !== null && v !== undefined).length} campos
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Diagnóstico */}
                      {dx && (
                        <div className="px-4 py-3 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-px h-3 bg-gray-300 ml-2" />
                            <p className="text-[10px] text-gray-400 italic">generó diagnóstico</p>
                          </div>
                          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Diagnóstico</p>
                          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                {dx.diagnosis_code && (
                                  <p className="text-xs text-red-400 font-mono">{dx.diagnosis_code}</p>
                                )}
                                <p className="text-sm font-semibold text-red-900">{dx.diagnosis_name}</p>
                              </div>
                              <div className="flex flex-col gap-1 items-end flex-shrink-0">
                                <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                                  style={{ background: STATUS_DX[dx.status]?.bg, color: STATUS_DX[dx.status]?.text }}>
                                  {STATUS_DX[dx.status]?.label}
                                </span>
                                {dx.severity && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                                    style={{ background: SEVERITY_CONFIG[dx.severity]?.bg, color: SEVERITY_CONFIG[dx.severity]?.text }}>
                                    {SEVERITY_CONFIG[dx.severity]?.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            {dx.rationale && <p className="text-xs text-red-700">{dx.rationale}</p>}
                            {dx.prognosis && <p className="text-xs text-red-500 italic">{dx.prognosis}</p>}
                          </div>
                        </div>
                      )}

                      {/* Plan de tratamiento */}
                      {plans.length > 0 && (
                        <div className="px-4 py-3 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-px h-3 bg-gray-300 ml-2" />
                            <p className="text-[10px] text-gray-400 italic">derivó a tratamiento</p>
                          </div>
                          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Plan de tratamiento</p>
                          {plans.map(plan => (
                            <div key={plan.id} className="bg-green-50 border border-green-100 rounded-xl p-3 flex flex-col gap-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs text-green-600 font-medium">{PLAN_TYPE_LABELS[plan.plan_type]}</p>
                                  <p className="text-sm font-semibold text-green-900">{plan.goals}</p>
                                </div>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-lg flex-shrink-0"
                                  style={{ background: PLAN_STATUS[plan.status]?.bg, color: PLAN_STATUS[plan.status]?.text }}>
                                  {PLAN_STATUS[plan.status]?.label}
                                </span>
                              </div>
                              {plan.instructions && <p className="text-xs text-green-700">{plan.instructions}</p>}
                              <div className="flex gap-3 text-xs text-green-600 flex-wrap">
                                {plan.total_sessions && <span>{plan.total_sessions} sesiones</span>}
                                {plan.frequency && <span>{plan.frequency}</span>}
                                {plan.duration_weeks && <span>{plan.duration_weeks} sem.</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {enc.status === "in_progress" && (
                        <div className="px-4 py-3">
                          <button onClick={() => router.push(`/patients/${id}/evaluations/${enc.id}`)}
                            className="w-full tap-target rounded-xl bg-blue-600 text-white text-xs font-semibold">
                            Continuar consulta →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* TAB EVALUACIONES */}
        {tab === "evaluaciones" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">{encounters.length} evaluaciones · {completedEnc} completadas</p>
            {encounters.length === 0 && (
              <div className="card p-8 text-center">
                <p className="text-sm text-gray-400">Sin evaluaciones</p>
                <p className="text-xs text-gray-400 mt-1">Inicia una consulta desde la agenda</p>
              </div>
            )}
            {encounters.map(enc => {
              const sp = enc.specialty
              const dx = enc.diagnosis
              return (
                <div key={enc.id} className="card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {sp && (
                          <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                            style={{ background: sp.color + "22", color: sp.color }}>
                            {sp.name}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">Sesión #{enc.session_number}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {fmt(enc.started_at)} · {fmtTime(enc.started_at)}
                      </p>
                      {enc.completed_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {Math.round((new Date(enc.completed_at).getTime() - new Date(enc.started_at).getTime()) / 60000)} min
                        </p>
                      )}
                    </div>
                    <span className={cn("text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0",
                      enc.status === "completed" ? "bg-green-100 text-green-800" :
                      enc.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-500")}>
                      {enc.status === "completed" ? "Completada" :
                       enc.status === "in_progress" ? "En curso" : "Cancelada"}
                    </span>
                  </div>
                  {(enc.forms?.length ?? 0) > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {enc.forms?.map(form => (
                        <div key={form.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                          <p className="text-xs text-blue-800 flex-1">
                            {(form.template as { name: string } | undefined)?.name ?? "Formulario"}
                          </p>
                          <p className="text-xs text-blue-500">
                            {Object.values(form.answers ?? {}).filter(v => v !== "" && v !== null && v !== undefined).length} campos
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {dx ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-800 flex-1">
                        {dx.diagnosis_code && <span className="font-mono">{dx.diagnosis_code} — </span>}
                        {dx.diagnosis_name}
                      </p>
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{ background: STATUS_DX[dx.status]?.bg, color: STATUS_DX[dx.status]?.text }}>
                        {STATUS_DX[dx.status]?.label}
                      </span>
                    </div>
                  ) : enc.status === "completed" && (
                    <div className="px-3 py-2 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-400">Sin diagnóstico registrado</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* TAB DIAGNOSTICOS */}
        {tab === "diagnosticos" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">
              {diagnoses.length} diagnósticos · generados durante consultas
            </p>
            {diagnoses.length === 0 && (
              <div className="card p-8 text-center">
                <p className="text-sm text-gray-400">Sin diagnósticos</p>
                <p className="text-xs text-gray-400 mt-1">Se registran al completar el flujo clínico en una consulta</p>
              </div>
            )}
            {diagnoses.map(dx => (
              <div key={dx.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {dx.diagnosis_code && (
                      <p className="text-xs text-red-400 font-mono mb-0.5">{dx.diagnosis_code}</p>
                    )}
                    <p className="text-sm font-semibold text-gray-900">{dx.diagnosis_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(dx.diagnosed_at)}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                      style={{ background: STATUS_DX[dx.status]?.bg, color: STATUS_DX[dx.status]?.text }}>
                      {STATUS_DX[dx.status]?.label}
                    </span>
                    {dx.severity && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                        style={{ background: SEVERITY_CONFIG[dx.severity]?.bg, color: SEVERITY_CONFIG[dx.severity]?.text }}>
                        {SEVERITY_CONFIG[dx.severity]?.label}
                      </span>
                    )}
                  </div>
                </div>
                {dx.rationale && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-500 font-medium mb-0.5">Fundamento clínico</p>
                    <p className="text-xs text-gray-700">{dx.rationale}</p>
                  </div>
                )}
                {dx.prognosis && (
                  <p className="text-xs text-gray-500 italic">{dx.prognosis}</p>
                )}
                {dx.encounter && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      Evaluación del {fmt(dx.encounter.started_at)}
                      {dx.encounter.specialty ? ` · ${dx.encounter.specialty.name}` : ""}
                    </p>
                  </div>
                )}
                {(dx.treatment_plans?.length ?? 0) > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-gray-400 font-medium">Planes derivados</p>
                    {dx.treatment_plans?.map(tp => (
                      <div key={tp.id} className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        <p className="text-xs text-green-800 flex-1">{PLAN_TYPE_LABELS[tp.plan_type]}</p>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{ background: PLAN_STATUS[tp.status]?.bg, color: PLAN_STATUS[tp.status]?.text }}>
                          {PLAN_STATUS[tp.status]?.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {dx.follow_up_date && (
                  <p className="text-xs text-gray-400">Seguimiento: {fmt(dx.follow_up_date)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB TRATAMIENTOS */}
        {tab === "tratamientos" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">
              {allPlans.length} planes · {activePlans.length} activo{activePlans.length !== 1 ? "s" : ""}
            </p>
            {allPlans.length === 0 && (
              <div className="card p-8 text-center">
                <p className="text-sm text-gray-400">Sin planes de tratamiento</p>
                <p className="text-xs text-gray-400 mt-1">Se crean al registrar un diagnóstico durante la consulta</p>
              </div>
            )}
            {allPlans.map(({ diagnosis: planDx, ...plan }) => (
              <div key={plan.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-600 font-medium mb-0.5">{PLAN_TYPE_LABELS[plan.plan_type]}</p>
                    <p className="text-sm font-semibold text-gray-900">{plan.goals}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-lg flex-shrink-0"
                    style={{ background: PLAN_STATUS[plan.status]?.bg, color: PLAN_STATUS[plan.status]?.text }}>
                    {PLAN_STATUS[plan.status]?.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-700 flex-1">
                    {planDx.diagnosis_code && <span className="font-mono">{planDx.diagnosis_code} — </span>}
                    {planDx.diagnosis_name}
                  </p>
                </div>
                {plan.instructions && <p className="text-xs text-gray-600">{plan.instructions}</p>}
                <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                  {plan.total_sessions && <span>{plan.total_sessions} sesiones</span>}
                  {plan.frequency && <span>{plan.frequency}</span>}
                  {plan.duration_weeks && <span>{plan.duration_weeks} sem.</span>}
                  {plan.started_at && <span>Inicio: {fmt(plan.started_at)}</span>}
                  {plan.ends_at && <span>Fin: {fmt(plan.ends_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB PAQUETES */}
        {tab === "paquetes" && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Paquetes activos</p>
              {activePackages.length === 0 && (
                <div className="card p-5 text-center mb-2">
                  <p className="text-sm text-gray-400">Sin paquetes activos</p>
                </div>
              )}
              {packages.filter(p => p.status === "active").map(pkg => {
                const pct = pkg.total_sessions > 0 ? (pkg.sessions_used / pkg.total_sessions) * 100 : 0
                const name = (pkg.package as { name: string } | undefined)?.name ??
                  (pkg.service as { name: string } | undefined)?.name ?? "Servicio"
                const sp = (pkg.service as { specialty?: { name: string; color: string } } | undefined)?.specialty
                return (
                  <div key={pkg.id} className="card p-4 flex flex-col gap-2 mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        {sp && <p className="text-xs text-gray-400">{sp.name}</p>}
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-green-100 text-green-800">Activo</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{pkg.sessions_used} de {pkg.total_sessions} sesiones</span>
                      <span className="text-teal-600 font-medium">{pkg.total_sessions - pkg.sessions_used} restantes</span>
                    </div>
                  </div>
                )
              })}
              {packages.filter(p => p.status !== "active").length > 0 && (
                <>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2 mt-2">Anteriores</p>
                  {packages.filter(p => p.status !== "active").map(pkg => {
                    const name = (pkg.package as { name: string } | undefined)?.name ??
                      (pkg.service as { name: string } | undefined)?.name ?? "Servicio"
                    return (
                      <div key={pkg.id} className="card p-3 flex items-center justify-between gap-2 mb-2 opacity-60">
                        <p className="text-sm text-gray-700">{name}</p>
                        <span className="text-xs text-gray-400 capitalize">{pkg.status}</span>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Asignar nuevo</p>
              <div className="card overflow-hidden">
                {catalogPackages.length > 0 && (
                  <>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500">Paquetes del catálogo</p>
                    </div>
                    {catalogPackages.map(pkg => (
                      <button key={pkg.id}
                        onClick={() => router.push(`/patients/${id}/paquetes?assign=package&pkg_id=${pkg.id}`)}
                        className="w-full flex items-center gap-3 px-4 py-3 border-t border-gray-100 hover:bg-gray-50 text-left">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="3" width="15" height="13"/>
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                            <circle cx="5.5" cy="18.5" r="2.5"/>
                            <circle cx="18.5" cy="18.5" r="2.5"/>
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-900 flex-1 truncate">{pkg.name}</p>
                        <span className="text-xs text-blue-600 font-medium flex-shrink-0">+ Asignar</span>
                      </button>
                    ))}
                  </>
                )}
                {catalogServices.length > 0 && (
                  <>
                    <div className="px-4 py-2 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500">Servicios sueltos</p>
                    </div>
                    {catalogServices.slice(0, 6).map(svc => {
                      const sp = svc.specialty as { name: string; color: string } | undefined
                      return (
                        <button key={svc.id}
                          onClick={() => router.push(`/patients/${id}/paquetes?assign=service&svc_id=${svc.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-3 border-t border-gray-100 hover:bg-gray-50 text-left">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: sp?.color ? sp.color + "22" : "#f3f4f6" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                              stroke={sp?.color ?? "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="16"/>
                              <line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{svc.name}</p>
                            {sp && <p className="text-xs text-gray-400">{sp.name}</p>}
                          </div>
                          <span className="text-xs text-blue-600 font-medium flex-shrink-0">+ Asignar</span>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
