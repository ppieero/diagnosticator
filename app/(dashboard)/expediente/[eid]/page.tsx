"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { FormEngine } from "@/components/forms/FormEngine"
import { cn } from "@/lib/utils"
import type {
  FormTemplateConfig,
  FormSectionConfig,
  Diagnosis,
  TreatmentPlan,
  FormResponse,
  DiagnosisStatus,
  DiagnosisSeverity,
  TreatmentPlanType,
  TreatmentPlanStatus,
  UUID,
} from "@/types/domain"

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface EvaluationDetail {
  id: UUID
  patient_id: UUID
  specialty_id?: string
  started_at: string
  ended_at?: string
  status: string
  soap_notes?: string
  encounter_type: string
  session_number?: number
  notes?: string
  patient: {
    id: UUID
    full_name: string
    birth_date: string
    biological_sex: string
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

interface SpecialtyFormTemplate {
  id: UUID
  name: string
  specialty_id: string
  form_type: string
  version: number
  fields: FormSectionConfig[]
}

type Tab = "resumen" | "evaluacion" | "diagnostico" | "tratamiento"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

function durationMinutes(start: string, end?: string): number | null {
  if (!end) return null
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

const SEVERITY_CONFIG: Record<DiagnosisSeverity, { label: string; bg: string; text: string }> = {
  mild:     { label: "Leve",     bg: "#EAF3DE", text: "#27500A" },
  moderate: { label: "Moderado", bg: "#FAEEDA", text: "#633806" },
  severe:   { label: "Severo",   bg: "#FCEBEB", text: "#791F1F" },
  critical: { label: "Crítico",  bg: "#F7C1C1", text: "#501313" },
}

const STATUS_DX: Record<DiagnosisStatus, { label: string; bg: string; text: string }> = {
  confirmed:    { label: "Confirmado",  bg: "#EAF3DE", text: "#27500A" },
  presumptive:  { label: "Presuntivo",  bg: "#FAEEDA", text: "#633806" },
  under_review: { label: "En revisión", bg: "#E6F1FB", text: "#0C447C" },
  ruled_out:    { label: "Descartado",  bg: "#F1EFE8", text: "#444441" },
}

const PLAN_TYPE_LABELS: Record<TreatmentPlanType, string> = {
  exercise:   "Ejercicio terapéutico",
  medication: "Medicación",
  therapy:    "Terapia manual",
  diet:       "Plan nutricional",
  combined:   "Combinado",
  other:      "Otro",
}

const PLAN_TYPE_COLORS: Record<TreatmentPlanType, { bg: string; text: string }> = {
  exercise:   { bg: "#EAF3DE", text: "#27500A" },
  medication: { bg: "#E6F1FB", text: "#0C447C" },
  therapy:    { bg: "#FAEEDA", text: "#633806" },
  diet:       { bg: "#F0FDF4", text: "#15803D" },
  combined:   { bg: "#FDF4FF", text: "#7E22CE" },
  other:      { bg: "#F1EFE8", text: "#444441" },
}

const PLAN_STATUS: Record<TreatmentPlanStatus, { label: string; bg: string; text: string }> = {
  active:    { label: "Activo",     bg: "#EAF3DE", text: "#27500A" },
  on_hold:   { label: "En espera",  bg: "#FAEEDA", text: "#633806" },
  completed: { label: "Completado", bg: "#E6F1FB", text: "#0C447C" },
  stopped:   { label: "Detenido",   bg: "#FCEBEB", text: "#791F1F" },
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ExpedienteDetailPage() {
  const { eid } = useParams<{ eid: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("resumen")

  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null)
  const [formResponses, setFormResponses] = useState<FormResponse[]>([])
  const [templateData, setTemplateData] = useState<SpecialtyFormTemplate | null>(null)
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // 1. Evaluation
      const { data: evRaw } = await supabase
        .from("evaluations")
        .select("*")
        .eq("id", eid)
        .single()

      if (!evRaw) { 
        setLoading(false); return 
      }
      if (!evRaw) { setLoading(false); return }

      const [patRes, spRes, perfRes] = await Promise.all([
        evRaw.patient_id
          ? supabase.from("patients").select("*").eq("id", evRaw.patient_id).single()
          : Promise.resolve({ data: null }),
        evRaw.specialty_id
          ? supabase.from("specialties").select("*").eq("id", evRaw.specialty_id).single()
          : Promise.resolve({ data: null }),
        evRaw.performed_by
          ? supabase.from("profiles").select("full_name").eq("id", evRaw.performed_by).single()
          : Promise.resolve({ data: null }),
      ])
      const enrichedEv = {
        ...evRaw,
        patient: patRes.data ?? null,
        specialty: spRes.data ?? null,
        performer: perfRes.data ?? null,
      }
      setEvaluation(enrichedEv as unknown as EvaluationDetail)

      // 2. Form responses
      const { data: frRaw } = await supabase
        .from("form_responses")
        .select("*")
        .eq("encounter_id", eid)

      const frs = (frRaw ?? []) as unknown as FormResponse[]
      setFormResponses(frs)

      // 3. Template (si hay form response con template_id)
      if (frs.length > 0 && frs[0].template_id) {
        const { data: tmplRaw } = await supabase
          .from("specialty_form_templates")
          .select("*")
          .eq("id", frs[0].template_id)
          .single()
        if (tmplRaw) setTemplateData(tmplRaw as unknown as SpecialtyFormTemplate)
      }

      // 4. Diagnosis
      const { data: dxRaw } = await supabase
        .from("diagnoses")
        .select("*")
        .eq("evaluation_id", eid)
        .maybeSingle()

      const dx = dxRaw as unknown as Diagnosis | null
      setDiagnosis(dx)

      // 5. Treatment plan
      if (dx?.id) {
        const { data: tpRaw } = await supabase
          .from("treatment_plans")
          .select("*")
          .eq("diagnosis_id", dx.id)
          .maybeSingle()
        setTreatmentPlan(tpRaw as unknown as TreatmentPlan | null)
      }

      setLoading(false)
    }
    load()
  }, [eid])

  const TABS: { val: Tab; label: string }[] = [
    { val: "resumen",     label: "Resumen" },
    { val: "evaluacion",  label: "Evaluación" },
    { val: "diagnostico", label: "Diagnóstico" },
    { val: "tratamiento", label: "Tratamiento" },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="px-4 py-8 text-center text-gray-500">
        Record no encontrado.
      </div>
    )
  }

  const tmplConfig: FormTemplateConfig | null = templateData
    ? {
        id: templateData.id,
        name: templateData.name,
        specialty: templateData.specialty_id,
        form_type: templateData.form_type as FormTemplateConfig["form_type"],
        version: templateData.version ?? 1,
        sections: templateData.fields as FormSectionConfig[],
      }
    : null

  const firstFormResponse = formResponses[0] ?? null

  return (
    <div className="flex flex-col h-full fade-up">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 bg-white border-b border-gray-100">
        <button
          onClick={() => router.push("/expediente")}
          className="flex items-center gap-1.5 text-sm text-blue-600 mb-3 tap-target -ml-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Records
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">
            {evaluation.patient?.full_name ?? "Paciente"}
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-sm text-gray-500">{fmt(evaluation.started_at)}</span>
            {evaluation.specialty && (
              <>
                <span className="text-gray-300">·</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: evaluation.specialty.color + "22", color: evaluation.specialty.color }}
                >
                  {evaluation.specialty.name}
                </span>
              </>
            )}
            {evaluation.performer && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">{evaluation.performer.full_name}</span>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-4 border-b border-gray-200 -mx-4 px-4 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.val}
              onClick={() => setActiveTab(t.val)}
              className={cn(
                "tap-target px-4 py-2 text-sm font-medium border-b-2 flex-shrink-0 transition-colors",
                activeTab === t.val
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "resumen" && (
          <TabResumen
            evaluation={evaluation}
            firstFormResponse={firstFormResponse}
            tmplConfig={tmplConfig}
            diagnosis={diagnosis}
            treatmentPlan={treatmentPlan}
          />
        )}
        {activeTab === "evaluacion" && (
          <TabEvaluacion
            evaluation={evaluation}
            tmplConfig={tmplConfig}
            firstFormResponse={firstFormResponse}
          />
        )}
        {activeTab === "diagnostico" && (
          <TabDiagnostico diagnosis={diagnosis} />
        )}
        {activeTab === "tratamiento" && (
          <TabTratamiento treatmentPlan={treatmentPlan} />
        )}
      </div>
    </div>
  )
}

// ── Tab Resumen ───────────────────────────────────────────────────────────────

function TabResumen({
  evaluation,
  firstFormResponse,
  tmplConfig,
  diagnosis,
  treatmentPlan,
}: {
  evaluation: EvaluationDetail
  firstFormResponse: FormResponse | null
  tmplConfig: FormTemplateConfig | null
  diagnosis: Diagnosis | null
  treatmentPlan: TreatmentPlan | null
}) {
  const scores = firstFormResponse?.computed_scores ?? {}
  const scoreKeys = Object.keys(scores).filter(k => k !== "total")
  const duration = durationMinutes(evaluation.started_at, evaluation.ended_at)

  // Buscar EVA en answers
  const answers = firstFormResponse?.answers ?? {}
  const evaValue: number | null = (() => {
    for (const key of Object.keys(answers)) {
      if (key.toLowerCase().includes("eva") || key.toLowerCase().includes("pain") || key.toLowerCase().includes("dolor")) {
        const v = answers[key]
        if (typeof v === "number") return v
        if (typeof v === "string" && !isNaN(Number(v))) return Number(v)
      }
    }
    return null
  })()

  const mainScore = scores["total"] ?? (scoreKeys.length > 0 ? scores[scoreKeys[0]] : null)

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <p className="text-xs text-gray-500 mb-1">EVA / Dolor</p>
          <p className="text-2xl font-bold text-gray-900">
            {evaValue !== null ? `${evaValue}/10` : "—"}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500 mb-1">Score principal</p>
          <p className="text-2xl font-bold text-gray-900">
            {mainScore !== null && mainScore !== undefined ? mainScore : "—"}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500 mb-1">Duración</p>
          <p className="text-2xl font-bold text-gray-900">
            {duration !== null ? `${duration} min` : "—"}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500 mb-1">N° sesión</p>
          <p className="text-2xl font-bold text-gray-900">
            {evaluation.session_number ?? "—"}
          </p>
        </div>
      </div>

      {/* Flujo clínico */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Flujo clínico</h3>

        {/* Card Evaluación */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27500A" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {tmplConfig?.name ?? "Formulario de evaluación"}
              </p>
              <p className="text-xs text-gray-500">Completada · {fmtShort(evaluation.started_at)}</p>
            </div>
          </div>
        </div>

        {diagnosis ? (
          <>
            {/* Conector */}
            <div className="flex flex-col items-center py-1 gap-0.5">
              <div className="w-px h-3 bg-gray-300" />
              <span className="text-[10px] text-gray-400">generó diagnóstico</span>
              <div className="w-px h-3 bg-gray-300" />
            </div>

            {/* Card Diagnóstico */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#791F1F" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {diagnosis.diagnosis_code && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
                        {diagnosis.diagnosis_code}
                      </span>
                    )}
                    {diagnosis.status && STATUS_DX[diagnosis.status as DiagnosisStatus] && (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: STATUS_DX[diagnosis.status as DiagnosisStatus].bg,
                          color: STATUS_DX[diagnosis.status as DiagnosisStatus].text,
                        }}
                      >
                        {STATUS_DX[diagnosis.status as DiagnosisStatus].label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{diagnosis.diagnosis_name}</p>
                  {diagnosis.severity && SEVERITY_CONFIG[diagnosis.severity] && (
                    <span
                      className="text-xs px-2 py-0.5 rounded mt-1 inline-block"
                      style={{
                        background: SEVERITY_CONFIG[diagnosis.severity].bg,
                        color: SEVERITY_CONFIG[diagnosis.severity].text,
                      }}
                    >
                      {SEVERITY_CONFIG[diagnosis.severity].label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {treatmentPlan && (
              <>
                {/* Conector */}
                <div className="flex flex-col items-center py-1 gap-0.5">
                  <div className="w-px h-3 bg-gray-300" />
                  <span className="text-[10px] text-gray-400">derivó a tratamiento</span>
                  <div className="w-px h-3 bg-gray-300" />
                </div>

                {/* Card Tratamiento */}
                <div className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27500A" strokeWidth="2">
                        <polyline points="9 11 12 14 22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: PLAN_TYPE_COLORS[treatmentPlan.plan_type]?.bg ?? "#F1EFE8",
                            color: PLAN_TYPE_COLORS[treatmentPlan.plan_type]?.text ?? "#444441",
                          }}
                        >
                          {PLAN_TYPE_LABELS[treatmentPlan.plan_type] ?? treatmentPlan.plan_type}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: PLAN_STATUS[treatmentPlan.status]?.bg ?? "#F1EFE8",
                            color: PLAN_STATUS[treatmentPlan.status]?.text ?? "#444441",
                          }}
                        >
                          {PLAN_STATUS[treatmentPlan.status]?.label ?? treatmentPlan.status}
                        </span>
                      </div>
                      {treatmentPlan.total_sessions && (
                        <p className="text-xs text-gray-500 mt-1">
                          {treatmentPlan.total_sessions} sesiones totales
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="mt-2 text-center text-xs text-gray-400 py-4">
            No hay diagnóstico ni plan derivado de esta evaluación.
          </div>
        )}
      </div>

      {/* Botón ver evaluación completa */}
      {evaluation.patient_id && (
        <a
          href={`/patients/${evaluation.patient_id}/evaluations/${evaluation.id}`}
          className="block w-full card py-3 text-center text-sm font-medium text-blue-600 tap-target mt-2"
        >
          Ver evaluación completa
        </a>
      )}
    </div>
  )
}

// ── Tab Evaluación ────────────────────────────────────────────────────────────

function TabEvaluacion({
  evaluation,
  tmplConfig,
  firstFormResponse,
}: {
  evaluation: EvaluationDetail
  tmplConfig: FormTemplateConfig | null
  firstFormResponse: FormResponse | null
}) {
  const scores = firstFormResponse?.computed_scores ?? {}
  const scoreKeys = Object.keys(scores)

  if (!tmplConfig) {
    return (
      <div className="px-4 py-8">
        {evaluation.soap_notes ? (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas SOAP</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{evaluation.soap_notes}</p>
          </div>
        ) : (
          <div className="card p-8 text-center text-gray-400 text-sm">
            Sin formulario registrado para esta evaluación.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Scores resumen */}
      {scoreKeys.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Scores calculados</h3>
          <div className="flex flex-wrap gap-2">
            {scoreKeys.map(key => (
              <div key={key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500 capitalize">{key}</span>
                <span className="text-sm font-bold text-gray-900">{scores[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FormEngine readonly */}
      <FormEngine
        template={tmplConfig}
        initialAnswers={(firstFormResponse?.answers as Record<string, unknown>) ?? {}}
        disabled={true}
        showCompleteButton={false}
      />
    </div>
  )
}

// ── Tab Diagnóstico ───────────────────────────────────────────────────────────

function TabDiagnostico({ diagnosis }: { diagnosis: Diagnosis | null }) {
  if (!diagnosis) {
    return (
      <div className="px-4 py-8">
        <div className="card p-8 text-center text-gray-400 text-sm">
          No se registró diagnóstico para esta evaluación.
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_DX[diagnosis.status as DiagnosisStatus]
  const severityCfg = diagnosis.severity ? SEVERITY_CONFIG[diagnosis.severity as DiagnosisSeverity] : null

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Badge CIE-10 prominente */}
      {diagnosis.diagnosis_code && (
        <div className="card p-4 flex items-center gap-4">
          <div className="text-3xl font-bold text-red-700 font-mono">{diagnosis.diagnosis_code}</div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Código CIE-10</p>
          </div>
        </div>
      )}

      {/* Nombre y chips */}
      <div className="card p-4 space-y-3">
        <h3 className="text-base font-bold text-gray-900">{diagnosis.diagnosis_name}</h3>
        <div className="flex flex-wrap gap-2">
          {statusCfg && (
            <span
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ background: statusCfg.bg, color: statusCfg.text }}
            >
              {statusCfg.label}
            </span>
          )}
          {severityCfg && (
            <span
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ background: severityCfg.bg, color: severityCfg.text }}
            >
              {severityCfg.label}
            </span>
          )}
        </div>
        {diagnosis.diagnosed_at && (
          <p className="text-xs text-gray-400">
            Diagnóstico emitido el {fmtShort(diagnosis.diagnosed_at)}
          </p>
        )}
      </div>

      {/* Fundamento clínico */}
      {diagnosis.rationale && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Fundamento clínico
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{diagnosis.rationale}</p>
        </div>
      )}

      {/* Notas de tratamiento */}
      {diagnosis.treatment_notes && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Notas
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{diagnosis.treatment_notes}</p>
        </div>
      )}

      {/* Pronóstico */}
      {diagnosis.prognosis && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Pronóstico
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{diagnosis.prognosis}</p>
        </div>
      )}

      {/* Seguimiento */}
      {diagnosis.follow_up_date && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Fecha de seguimiento
          </h4>
          <p className="text-sm font-medium text-gray-900">{fmtShort(diagnosis.follow_up_date)}</p>
        </div>
      )}
    </div>
  )
}

// ── Tab Tratamiento ───────────────────────────────────────────────────────────

function TabTratamiento({ treatmentPlan }: { treatmentPlan: TreatmentPlan | null }) {
  if (!treatmentPlan) {
    return (
      <div className="px-4 py-8">
        <div className="card p-8 text-center text-gray-400 text-sm">
          No hay plan de tratamiento registrado para esta evaluación.
        </div>
      </div>
    )
  }

  const planTypeCfg = PLAN_TYPE_COLORS[treatmentPlan.plan_type]
  const statusCfg = PLAN_STATUS[treatmentPlan.status]

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Tipo y estado */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className="text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{ background: planTypeCfg?.bg ?? "#F1EFE8", color: planTypeCfg?.text ?? "#444441" }}
          >
            {PLAN_TYPE_LABELS[treatmentPlan.plan_type] ?? treatmentPlan.plan_type}
          </span>
          <span
            className="text-sm font-medium px-3 py-1.5 rounded-full"
            style={{ background: statusCfg?.bg ?? "#F1EFE8", color: statusCfg?.text ?? "#444441" }}
          >
            {statusCfg?.label ?? treatmentPlan.status}
          </span>
        </div>

        {/* Sesiones */}
        {treatmentPlan.total_sessions && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Sesiones</span>
              <span>{treatmentPlan.total_sessions} totales</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: "0%" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Objetivos */}
      {treatmentPlan.goals && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Objetivos
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{treatmentPlan.goals}</p>
        </div>
      )}

      {/* Instrucciones */}
      {treatmentPlan.instructions && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Instrucciones
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{treatmentPlan.instructions}</p>
        </div>
      )}

      {/* Detalles */}
      <div className="card p-4 space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Detalles
        </h4>
        {treatmentPlan.frequency && (
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Frecuencia</span>
            <span className="text-xs font-medium text-gray-900">{treatmentPlan.frequency}</span>
          </div>
        )}
        {treatmentPlan.duration_weeks && (
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Duración</span>
            <span className="text-xs font-medium text-gray-900">{treatmentPlan.duration_weeks} semanas</span>
          </div>
        )}
        {treatmentPlan.started_at && (
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Inicio</span>
            <span className="text-xs font-medium text-gray-900">{fmtShort(treatmentPlan.started_at)}</span>
          </div>
        )}
        {treatmentPlan.ends_at && (
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Fin previsto</span>
            <span className="text-xs font-medium text-gray-900">{fmtShort(treatmentPlan.ends_at)}</span>
          </div>
        )}
      </div>

      {/* Motivo de detención */}
      {treatmentPlan.stopped_reason && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Motivo de detención
          </h4>
          <p className="text-sm text-gray-700">{treatmentPlan.stopped_reason}</p>
        </div>
      )}
    </div>
  )
}
