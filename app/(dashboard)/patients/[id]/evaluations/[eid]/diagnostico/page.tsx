"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createDiagnosis, getEncounterDiagnosis } from "@/lib/services/diagnoses"
import type { Diagnosis } from "@/lib/services/diagnoses"
import { cn } from "@/lib/utils"

const ICD10_SUGERIDOS = [
  { code: "M54.5", name: "Lumbalgia" },
  { code: "M54.2", name: "Cervicalgia" },
  { code: "M25.5", name: "Dolor articular" },
  { code: "F32.1", name: "Episodio depresivo moderado" },
  { code: "F41.1", name: "Trastorno de ansiedad generalizada" },
  { code: "E66.0", name: "Obesidad grado I" },
  { code: "E03.9", name: "Hipotiroidismo" },
  { code: "M23.2", name: "Gonalgia" },
  { code: "J30.1", name: "Rinitis alérgica" },
  { code: "K21.0", name: "Reflujo gastroesofágico" },
]

const STATUS_OPTIONS = [
  { value: "presumptive", label: "Presuntivo", desc: "Hipótesis basada en evaluación" },
  { value: "confirmed", label: "Confirmado", desc: "Diagnóstico definitivo" },
  { value: "under_review", label: "En revisión", desc: "Requiere más estudios" },
]

const SEVERITY_OPTIONS = [
  { value: "mild", label: "Leve", bg: "#EAF3DE", text: "#27500A" },
  { value: "moderate", label: "Moderado", bg: "#FAEEDA", text: "#633806" },
  { value: "severe", label: "Severo", bg: "#FCEBEB", text: "#791F1F" },
  { value: "critical", label: "Crítico", bg: "#F7C1C1", text: "#501313" },
]

export default function DiagnosticoPage() {
  const { id: patientId, eid } = useParams<{ id: string; eid: string }>()
  const router = useRouter()

  const [existing, setExisting] = useState<Diagnosis | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState("")
  const [professionalId, setProfessionalId] = useState("")
  const [search, setSearch] = useState("")
  const [prediag, setPrediag] = useState<string | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [showPrediag, setShowPrediag] = useState(false)

  const [diagnosisName, setDiagnosisName] = useState("")
  const [diagnosisCode, setDiagnosisCode] = useState("")
  const [status, setStatus] = useState<Diagnosis["status"]>("presumptive")
  const [severity, setSeverity] = useState<Diagnosis["severity"]>("moderate")
  const [rationale, setRationale] = useState("")
  const [prognosis, setPrognosis] = useState("")
  const [treatmentNotes, setTreatmentNotes] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")

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
      // professional_id en diagnoses → profiles.id (no professionals.id)
      setProfessionalId(user?.id ?? "")
      const dx = await getEncounterDiagnosis(eid)
      if (dx) {
        setExisting(dx)
        setDiagnosisName(dx.diagnosis_name)
        setDiagnosisCode(dx.diagnosis_code ?? "")
        setStatus(dx.status)
        setSeverity(dx.severity ?? "moderate")
        setRationale(dx.rationale)
        setPrognosis(dx.prognosis ?? "")
        setTreatmentNotes(dx.treatment_notes ?? "")
        setFollowUpDate(dx.follow_up_date ?? "")
      }
      setLoading(false)
    }
    load()
  }, [eid])

  async function fetchPrediagnostico() {
    setLoadingAI(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const [evRes, patRes, anamRes, frRes, spRes] = await Promise.all([
        supabase.from("evaluations").select("*, specialty:specialties(name)").eq("id", eid).single(),
        supabase.from("patients").select("*").eq("id", patientId).single(),
        supabase.from("anamnesis").select("*").eq("patient_id", patientId).maybeSingle(),
        supabase.from("form_responses").select("*, template:specialty_form_templates(name)").eq("encounter_id", eid),
        supabase.from("evaluations").select("specialty_id").eq("id", eid).single(),
      ])

      const spName = (evRes.data as { specialty?: { name: string } } | null)?.specialty?.name ?? ""
      const frWithNames = (frRes.data ?? []).map((fr: Record<string, unknown>) => ({
        ...fr,
        template_name: (fr.template as { name: string } | null)?.name ?? "Formulario",
      }))

      const res = await fetch("/api/ai-prediagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: patRes.data,
          anamnesis: anamRes.data,
          evaluation: evRes.data,
          formResponses: frWithNames,
          specialty: spName,
        }),
      })
      const data = await res.json()
      if (data.prediagnostico) {
        setPrediag(data.prediagnostico)
        setShowPrediag(true)
      }
    } catch {
      console.error("Error fetching prediagnóstico")
    } finally {
      setLoadingAI(false)
    }
  }

  const filtered = search
    ? ICD10_SUGERIDOS.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()))
    : []

  async function handleSave() {
    if (!diagnosisName.trim()) { setError("El nombre del diagnóstico es obligatorio"); return }
    if (!rationale.trim()) { setError("El fundamento clínico es obligatorio"); return }
    setSaving(true); setError(null)
    try {
      const dx = await createDiagnosis({
        patient_id: patientId,
        evaluation_id: eid,
        professional_id: professionalId,
        diagnosed_by: userId,
        diagnosis_name: diagnosisName.trim(),
        diagnosis_code: diagnosisCode || undefined,
        status,
        severity,
        rationale: rationale.trim(),
        prognosis: prognosis || undefined,
        treatment_notes: treatmentNotes || undefined,
        follow_up_date: followUpDate || undefined,
      })
      router.push(`/patients/${patientId}/evaluations/${eid}/tratamiento?diagnosis_id=${dx.id}`)
    } catch {
      setError("Error al guardar el diagnóstico")
    } finally {
      setSaving(false)
    }
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
          <h2 className="text-xl font-bold text-gray-900">
            {existing ? "Diagnóstico registrado" : "Nuevo diagnóstico"}
          </h2>
          <p className="text-xs text-gray-400">Basado en la evaluación completada</p>
        </div>
      </div>

      {existing && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-800 font-medium">
            Ya existe un diagnóstico para esta evaluación. Podés continuar al plan de tratamiento.
          </p>
          <button
            onClick={() => router.push(`/patients/${patientId}/evaluations/${eid}/tratamiento?diagnosis_id=${existing.id}`)}
            className="text-xs text-blue-600 font-medium mt-1">
            Ir al plan de tratamiento →
          </button>
        </div>
      )}

      {/* Botón Prediagnóstico IA */}
      <button
        onClick={fetchPrediagnostico}
        disabled={loadingAI}
        className="w-full tap-target rounded-xl flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #534AB7, #185FA5)", color: "white" }}>
        {loadingAI ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Analizando con IA...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            Generar prediagnóstico con IA
          </>
        )}
      </button>

      {/* Panel prediagnóstico IA */}
      {prediag && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowPrediag(!showPrediag)}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ background: "linear-gradient(135deg, #EEEDFE, #E6F1FB)" }}>
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
              <span className="text-sm font-semibold" style={{ color: "#3C3489" }}>Prediagnóstico IA</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#534AB7", color: "white" }}>Beta</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#534AB7" }}>Solo referencia clínica</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={showPrediag ? "rotate-180 transition-transform" : "transition-transform"}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </button>
          {showPrediag && (
            <div className="px-4 py-4">
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                ⚠ Este prediagnóstico es generado por IA como apoyo al juicio clínico del profesional. No reemplaza la evaluación médica.
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                {prediag}
              </pre>
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => {
                    const dx = prediag.match(/CIE-10[:\s]+([A-Z]\d+\.?\d*)/)?.[1] ?? ""
                    const nameMatch = prediag.match(/1\.\s+([^\n(]+)/)?.[1]?.trim() ?? ""
                    if (dx) setDiagnosisCode(dx)
                    if (nameMatch) setDiagnosisName(nameMatch.replace(/\s*\(.*/, "").trim())
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: "#EEEDFE", color: "#3C3489" }}>
                  Usar diagnóstico sugerido
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(prediag ?? "")}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600">
                  Copiar análisis
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Búsqueda CIE-10</p>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setDiagnosisName(e.target.value) }}
          placeholder="Buscar por nombre o código..."
          className="input-base" />
        {filtered.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {filtered.map(s => (
              <button key={s.code} type="button"
                onClick={() => { setDiagnosisName(s.name); setDiagnosisCode(s.code); setSearch(s.name) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left border-b border-gray-100 last:border-0">
                <span className="text-xs font-mono text-blue-600 w-14 flex-shrink-0">{s.code}</span>
                <span className="text-sm text-gray-800">{s.name}</span>
              </button>
            ))}
          </div>
        )}
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Nombre del diagnóstico *</label>
          <input value={diagnosisName} onChange={e => setDiagnosisName(e.target.value)}
            placeholder="Nombre completo..." className="input-base" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Código CIE-10</label>
          <input value={diagnosisCode} onChange={e => setDiagnosisCode(e.target.value)}
            placeholder="Ej: M54.5" className="input-base font-mono" />
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</p>
        <div className="flex flex-col gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setStatus(opt.value as Diagnosis["status"])}
              className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                status === opt.value ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
              <div className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0",
                status === opt.value ? "bg-blue-600 border-blue-600" : "border-gray-400")} />
              <div>
                <p className={cn("text-sm font-medium", status === opt.value ? "text-blue-900" : "text-gray-800")}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-400">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Severidad</p>
        <div className="grid grid-cols-2 gap-2">
          {SEVERITY_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setSeverity(opt.value as Diagnosis["severity"])}
              className={cn("py-2.5 rounded-xl text-xs font-medium border-2 transition-all",
                severity === opt.value ? "border-transparent" : "border-gray-200")}
              style={severity === opt.value ? { background: opt.bg, color: opt.text, borderColor: opt.text } : {}}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fundamento clínico</p>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Razonamiento diagnóstico *</label>
          <textarea value={rationale} onChange={e => setRationale(e.target.value)}
            rows={3} placeholder="Fundamento basado en hallazgos de la evaluación..."
            className="input-base resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Pronóstico</label>
          <textarea value={prognosis} onChange={e => setPrognosis(e.target.value)}
            rows={2} placeholder="Expectativa de evolución y recuperación..."
            className="input-base resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Notas de tratamiento</label>
          <textarea value={treatmentNotes} onChange={e => setTreatmentNotes(e.target.value)}
            rows={2} placeholder="Indicaciones iniciales..." className="input-base resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Fecha de seguimiento</label>
          <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
            className="input-base" />
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
          Omitir por ahora
        </button>
        <button onClick={handleSave} disabled={saving || !diagnosisName || !rationale}
          className="flex-2 tap-target rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50 px-6">
          {saving ? "Guardando..." : "Guardar diagnóstico →"}
        </button>
      </div>
    </div>
  )
}
