"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createEvaluation, saveFormResponse, completeEvaluation } from "@/lib/services/evaluations"
import { getAnamnesisProfile, upsertAnamnesisProfile, saveAnamnesisSnapshot, getLatestSnapshot } from "@/lib/services/anamnesis"
import type { AnamnesisProfile, AnamnesisSnapshot } from "@/lib/services/anamnesis"
import { FormEngine } from "@/components/forms/FormEngine"
import type { Patient, Specialty, FormTemplateConfig, FormSectionConfig } from "@/types/domain"
import { cn } from "@/lib/utils"

interface TemplateOption {
  id: string
  name: string
  form_type: string
  estimated_minutes?: number
  description?: string
  fields: unknown[]
  version: number
  isPrimary: boolean
}

interface Episode {
  evaluationId: string
  evaluationDate: string
  diagnosisId: string | null
  diagnosisName: string | null
  diagnosisCode: string | null
  treatmentPlanId: string | null
  planType: string | null
  totalSessions: number
  sessionsUsed: number
}

const PLAN_LABELS: Record<string, string> = {
  exercise:"Ejercicio terapéutico", medication:"Medicación",
  therapy:"Terapia manual", diet:"Plan nutricional",
  combined:"Combinado", other:"Otro",
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {day:"2-digit",month:"short",year:"numeric"})
}
function clinicalId(uuid: string, date: string) {
  return `EVA-${new Date(date).getFullYear()}-${uuid.replace(/-/g,"").slice(-4).toUpperCase()}`
}

type Step = "anamnesis" | "select_template" | "select_episode" | "form"

export default function NewEvaluationPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const router = useRouter()
  const urlParams = useSearchParams()

  const appointmentId = urlParams.get("appointment_id") ?? ""
  const specialtyId   = urlParams.get("specialty_id") ?? ""
  const serviceId     = urlParams.get("service_id") ?? ""

  const [patient, setPatient]         = useState<Patient | null>(null)
  const [specialty, setSpecialty]     = useState<Specialty | null>(null)
  const [serviceName, setServiceName] = useState("")
  const [templates, setTemplates]     = useState<TemplateOption[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null)
  const [episodes, setEpisodes]       = useState<Episode[]>([])
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)
  const [step, setStep]               = useState<Step>("anamnesis")
  const [encounterId, setEncounterId] = useState<string | null>(null)
  const [template, setTemplate]       = useState<FormTemplateConfig | null>(null)
  const [userId, setUserId]           = useState("")
  const [loading, setLoading]         = useState(true)
  const [starting, setStarting]       = useState(false)
  const [savingAnam, setSavingAnam]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [snapOpenSec, setSnapOpenSec]   = useState<number|null>(1)
  const [snapDoneSecs, setSnapDoneSecs] = useState<Set<number>>(new Set<number>())

  // Anamnesis
  const [anamProfile, setAnamProfile]   = useState<AnamnesisProfile | null>(null)
  const [profileDraft, setProfileDraft] = useState<AnamnesisProfile>({ patient_id: patientId })
  const [anamChanged, setAnamChanged]   = useState(false)
  const [editProfile, setEditProfile]   = useState(false)
  const [snapshot, setSnapshot]         = useState<AnamnesisSnapshot>({
    patient_id: patientId, pregnancy_status: "not_applicable", main_complaint: "",
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const [patRes, spRes, svcRes, profRes, snapRes] = await Promise.all([
        supabase.from("patients").select("*").eq("id", patientId).single(),
        specialtyId ? supabase.from("specialties").select("*").eq("id", specialtyId).single() : Promise.resolve({data:null}),
        serviceId   ? supabase.from("services").select("name").eq("id", serviceId).single()   : Promise.resolve({data:null}),
        getAnamnesisProfile(patientId),
        getLatestSnapshot(patientId),
      ])

      setPatient(patRes.data as Patient)
      if (spRes.data)  setSpecialty(spRes.data as Specialty)
      if (svcRes.data) setServiceName((svcRes.data as {name:string}).name)
      if (profRes)     { setAnamProfile(profRes); setProfileDraft(profRes) }
      if (snapRes)     setSnapshot(p => ({
        ...p,
        // Medidas — pre-cargar del último snapshot
        height_cm: snapRes.height_cm,
        weight_kg: snapRes.weight_kg,
        pregnancy_status: snapRes.pregnancy_status ?? "not_applicable",
        gestation_months: snapRes.gestation_months,
        // Hábitos y actividad
        activity_level: snapRes.activity_level ?? "",
        dominance: snapRes.dominance ?? "",
        // Deporte
        does_sport: snapRes.does_sport ?? false,
        sports_practiced: snapRes.sports_practiced ?? [],
        sport_frequency: snapRes.sport_frequency ?? "",
        sport_performance: snapRes.sport_performance ?? "",
        // Alimentación
        diet_type: snapRes.diet_type ?? "",
        diet_quality: snapRes.diet_quality ?? "",
        breakfast: snapRes.breakfast ?? [],
        lunch: snapRes.lunch ?? [],
        dinner: snapRes.dinner ?? [],
        // Hidratación
        water_intake: snapRes.water_intake ?? "",
        // Evacuación
        bowel_habit: snapRes.bowel_habit ?? "",
        daily_bowel_movement: snapRes.daily_bowel_movement ?? "",
        constipation_level: snapRes.constipation_level ?? 0,
        // Sueño
        sleep_quality: snapRes.sleep_quality ?? "",
        sleep_hours: snapRes.sleep_hours ?? "",
        wake_refreshed: snapRes.wake_refreshed ?? "",
        // Energía
        energy_level: snapRes.energy_level ?? 5,
        energy_during_day: snapRes.energy_during_day ?? "",
        // Estrés
        stress_level: snapRes.stress_level ?? 5,
        stress_exposure: snapRes.stress_exposure ?? "",
        stress_coping: snapRes.stress_coping ?? [],
        // Ánimo — NO pre-cargar, es del día
        today_mood: "",
        main_complaint: "",
        // Antecedentes snapshot
        personal_history_snapshot: snapRes.personal_history_snapshot ?? [],
      }))

      // Cargar templates del servicio (primary = asignado al servicio, additional = de la especialidad)
      const [svcTmpl, spTmpl] = await Promise.all([
        serviceId
          ? supabase.from("specialty_form_templates").select("id,name,form_type,fields,version,estimated_minutes,description").eq("service_id", serviceId).eq("is_active", true)
          : Promise.resolve({data:[]}),
        specialtyId
          ? supabase.from("specialty_form_templates").select("id,name,form_type,fields,version,estimated_minutes,description").eq("specialty_id", specialtyId).eq("is_active", true).is("service_id", null)
          : Promise.resolve({data:[]}),
      ])

      const primary = (svcTmpl.data ?? []).map(t => ({...t, isPrimary: true, fields: t.fields ?? []}))
      const additional = (spTmpl.data ?? []).map(t => ({...t, isPrimary: false, fields: t.fields ?? []}))
      const all = [...primary, ...additional] as TemplateOption[]
      setTemplates(all)
      if (all.length > 0) setSelectedTemplate(all[0])

      // Episodios previos
      if (specialtyId) {
        const { data: evals } = await supabase
          .from("evaluations").select("id, started_at")
          .eq("patient_id", patientId).eq("specialty_id", specialtyId)
          .eq("status", "completed").order("started_at", {ascending:false})
        const eps: Episode[] = []
        for (const ev of evals ?? []) {
          const { data: dx } = await supabase.from("diagnoses").select("id,diagnosis_name,diagnosis_code").eq("evaluation_id", ev.id).maybeSingle()
          let tp = null
          if (dx) {
            const { data: tpData } = await supabase.from("treatment_plans").select("id,plan_type,status,total_sessions").eq("diagnosis_id", dx.id).eq("status","active").maybeSingle()
            tp = tpData
          }
          const { count } = await supabase.from("evaluations").select("id",{count:"exact"}).eq("patient_id", patientId).eq("specialty_id", specialtyId).eq("encounter_type","session").eq("status","completed")
          eps.push({
            evaluationId: ev.id, evaluationDate: ev.started_at,
            diagnosisId: dx?.id ?? null, diagnosisName: dx?.diagnosis_name ?? null, diagnosisCode: dx?.diagnosis_code ?? null,
            treatmentPlanId: tp?.id ?? null, planType: tp?.plan_type ?? null,
            totalSessions: tp?.total_sessions ?? 0, sessionsUsed: count ?? 0,
          })
        }
        setEpisodes(eps)
      }
      setLoading(false)
    }
    load()
  }, [patientId, specialtyId, serviceId])

  async function handleAnamnesisNext() {
    setSavingAnam(true); setError(null)
    try {
      if (anamChanged) await upsertAnamnesisProfile({...profileDraft, patient_id: patientId})
      await saveAnamnesisSnapshot({...snapshot, patient_id: patientId, recorded_by: userId})
      setStep("select_template")
    } catch { setError("Error al guardar anamnesis") }
    finally { setSavingAnam(false) }
  }

  async function handleTemplateConfirm() {
    if (!selectedTemplate) return
    const isSession = selectedTemplate.form_type === "session"
    if (isSession && episodes.length > 0) {
      setStep("select_episode")
    } else {
      await startEvaluation(selectedTemplate, null)
    }
  }

  async function startEvaluation(tmpl: TemplateOption, episode: Episode | null) {
    setStarting(true); setError(null)
    try {
      const isSession = tmpl.form_type === "session"
      const encounterType = isSession ? "session" : "initial"

      const formConfig: FormTemplateConfig = {
        id: tmpl.id, name: tmpl.name, specialty: specialtyId,
        form_type: tmpl.form_type as FormTemplateConfig["form_type"],
        version: tmpl.version, sections: tmpl.fields as FormSectionConfig[],
        estimated_minutes: tmpl.estimated_minutes,
      }

      const ev = await createEvaluation({
        patient_id: patientId, specialty_id: specialtyId,
        professional_id: userId, performed_by: userId,
        encounter_type: encounterType,
        evaluation_type_id: `${encounterType}_${specialtyId}`,
      })

      const supabase = createClient()
      await supabase.from("evaluations").update({
        appointment_id: appointmentId || undefined,
        session_number: isSession ? (episodes.indexOf(episode!) + 2) : 1,
        professional_id: userId,
      }).eq("id", ev.id)

      if (appointmentId) await supabase.from("appointments").update({status:"in_progress"}).eq("id", appointmentId)

      setEncounterId(ev.id)
      setTemplate(formConfig)
      if (episode) setSelectedEpisode(episode)
      setStep("form")
    } catch { setError("Error al iniciar la evaluación.") }
    finally { setStarting(false) }
  }

  async function handleSave(answers: Record<string, unknown>, scores: Record<string, number>) {
    if (!encounterId || !selectedTemplate || !template) return
    await saveFormResponse({
      template_id: selectedTemplate.id, template_version: selectedTemplate.version,
      encounter_id: encounterId, patient_id: patientId, professional_id: userId,
      answers, computed_scores: scores,
      body_map_data: (answers.body_map as unknown[]) ?? [], status: "in_progress",
    })
  }

  async function handleComplete(answers: Record<string, unknown>, scores: Record<string, number>) {
    if (!encounterId || !selectedTemplate || !template) return
    await saveFormResponse({
      template_id: selectedTemplate.id, template_version: selectedTemplate.version,
      encounter_id: encounterId, patient_id: patientId, professional_id: userId,
      answers, computed_scores: scores,
      body_map_data: (answers.body_map as unknown[]) ?? [], status: "completed",
    })
    await completeEvaluation(encounterId)
    if (selectedTemplate.form_type === "initial") {
      router.push(`/patients/${patientId}/evaluations/${encounterId}/diagnostico`)
    } else {
      router.push(`/patients/${patientId}`)
    }
  }

  if (loading) return <div className="px-4 py-8 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"/></div>

  // ── STEP: FORM ──────────────────────────────────────────────
  if (step === "form" && template) return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep("select_template")} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 truncate">{template.name}</p>
          <p className="text-xs text-gray-400">{patient?.full_name}{encounterId ? ` · ${clinicalId(encounterId, new Date().toISOString())}` : ""}</p>
        </div>
        <span className={cn("text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0",
          selectedTemplate?.form_type === "initial" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
          {selectedTemplate?.form_type === "initial" ? "Evaluación" : "Seguimiento"}
        </span>
      </div>
      {selectedEpisode && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex flex-col gap-1">
          <p className="text-xs font-semibold text-green-800">Episodio · {clinicalId(selectedEpisode.evaluationId, selectedEpisode.evaluationDate)}</p>
          {selectedEpisode.diagnosisCode && <p className="text-xs font-mono text-green-600">{selectedEpisode.diagnosisCode}</p>}
          <p className="text-xs text-green-700">{selectedEpisode.diagnosisName}</p>
          {selectedEpisode.planType && <p className="text-xs text-green-600">{PLAN_LABELS[selectedEpisode.planType]} · {selectedEpisode.sessionsUsed}/{selectedEpisode.totalSessions} ses.</p>}
        </div>
      )}
      <FormEngine template={template} onSave={handleSave} onComplete={handleComplete}/>
    </div>
  )

  // ── STEP: SELECT EPISODE ─────────────────────────────────────
  if (step === "select_episode") return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep("select_template")} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <p className="text-base font-semibold text-gray-900">¿A qué episodio pertenece?</p>
          <p className="text-xs text-gray-400">{serviceName} · {patient?.full_name}</p>
        </div>
      </div>
      {episodes.length === 0 ? (
        <div className="card p-6 text-center flex flex-col gap-2">
          <p className="text-sm text-gray-500">Sin episodios previos en {specialty?.name}</p>
          <button onClick={() => setStep("select_template")} className="text-xs text-blue-600 font-medium">← Volver</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {episodes.map(ep => {
            const pct = ep.totalSessions > 0 ? Math.round((ep.sessionsUsed/ep.totalSessions)*100) : 0
            return (
              <button key={ep.evaluationId} onClick={() => startEvaluation(selectedTemplate!, ep)} disabled={starting}
                className="card p-4 flex flex-col gap-2 text-left hover:border-green-400 transition-colors disabled:opacity-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-400 mb-1">{clinicalId(ep.evaluationId, ep.evaluationDate)} · {fmt(ep.evaluationDate)}</p>
                    {ep.diagnosisCode && <p className="text-xs font-mono text-red-500">{ep.diagnosisCode}</p>}
                    <p className="text-sm font-semibold text-gray-900">{ep.diagnosisName ?? "Sin diagnóstico"}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0 mt-1"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
                {ep.planType && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-green-700 font-medium">{PLAN_LABELS[ep.planType]}</span>
                      <span className="text-green-600">{ep.sessionsUsed}/{ep.totalSessions} ses.</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-green-500" style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3"><p className="text-sm text-red-700">{error}</p></div>}
    </div>
  )

  // ── STEP: SELECT TEMPLATE ────────────────────────────────────
  if (step === "select_template") return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep("anamnesis")} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900">Seleccionar formulario</p>
          <p className="text-xs text-gray-400">{serviceName} · {patient?.full_name}</p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500">No hay formularios configurados para este servicio</p>
          <p className="text-xs text-gray-400 mt-1">Contacta al administrador para asignar un formulario</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {templates.map((tmpl, i) => (
            <button key={tmpl.id} type="button" onClick={() => setSelectedTemplate(tmpl)}
              className={cn("w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors",
                i > 0 ? "border-t border-gray-100" : "",
                selectedTemplate?.id === tmpl.id ? "bg-blue-50" : "hover:bg-gray-50")}>
              <div className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                selectedTemplate?.id === tmpl.id ? "border-blue-600 bg-blue-600" : "border-gray-300")}>
                {selectedTemplate?.id === tmpl.id && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={cn("text-sm font-medium", selectedTemplate?.id === tmpl.id ? "text-blue-900" : "text-gray-900")}>
                    {tmpl.name}
                  </span>
                  {tmpl.isPrimary && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-600 text-white">Asignado</span>
                  )}
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                    tmpl.form_type === "initial" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                    {tmpl.form_type === "initial" ? "Evaluación" : "Seguimiento"}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {tmpl.description ?? ""}
                  {tmpl.estimated_minutes ? ` ~${tmpl.estimated_minutes} min` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3"><p className="text-sm text-red-700">{error}</p></div>}

      <button onClick={handleTemplateConfirm} disabled={!selectedTemplate || starting}
        className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
        {starting ? "Iniciando..." : `Iniciar ${selectedTemplate?.form_type === "session" ? "sesión" : "evaluación"} →`}
      </button>
    </div>
  )

  // ── STEP: ANAMNESIS ──────────────────────────────────────────
  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900">Anamnesis</p>
          <p className="text-xs text-gray-400">{patient?.full_name} · {specialty?.name}{serviceName ? ` · ${serviceName}` : ""}</p>
        </div>
      </div>

      {/* PERFIL — datos estables */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Perfil clínico</p>
            {anamProfile?.updated_at && <p className="text-xs text-gray-400 mt-0.5">Actualizado: {fmt(anamProfile.updated_at)}</p>}
          </div>
          <button onClick={() => setEditProfile(!editProfile)} className="text-xs text-blue-600 font-medium px-3 py-1.5 rounded-lg bg-blue-50">
            {editProfile ? "Listo" : "Editar"}
          </button>
        </div>

        {!editProfile ? (
          <div className="divide-y divide-gray-50">
            <div className="px-4 py-3 flex items-start gap-3">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Alergias</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {((anamProfile?.known_allergies ?? []) as {substance:string;severity:string}[]).length > 0
                  ? ((anamProfile?.known_allergies ?? []) as {substance:string;severity:string}[]).map((a,i) => (
                      <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-lg bg-red-100 text-red-700">⚠ {a.substance}</span>
                    ))
                  : <span className="text-xs text-gray-400 italic">Ninguna</span>}
              </div>
            </div>
            <div className="px-4 py-3 flex items-start gap-3">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Medicación</span>
              <div className="flex-1">
                {((anamProfile?.active_medications ?? []) as {name:string;dose?:string}[]).length > 0
                  ? ((anamProfile?.active_medications ?? []) as {name:string;dose?:string}[]).map((m,i) => (
                      <p key={i} className="text-xs text-gray-700">{m.name}{m.dose ? ` · ${m.dose}` : ""}</p>
                    ))
                  : <span className="text-xs text-gray-400 italic">Ninguna</span>}
              </div>
            </div>
            <div className="px-4 py-3 flex items-start gap-3">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Antecedentes</span>
              <div className="flex-1">
                {((anamProfile?.personal_history ?? []) as {condition:string;status:string}[]).length > 0
                  ? ((anamProfile?.personal_history ?? []) as {condition:string;status:string}[]).map((h,i) => (
                      <p key={i} className="text-xs text-gray-700">{h.condition} · <span className="text-gray-400">{h.status}</span></p>
                    ))
                  : <span className="text-xs text-gray-400 italic">Sin antecedentes</span>}
              </div>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0">Hábitos</span>
              <span className="text-xs text-gray-700">{anamProfile?.smoking_status ?? "—"} · {anamProfile?.alcohol_status ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Tabaquismo</label>
              <select value={profileDraft.smoking_status ?? ""} onChange={e=>{setProfileDraft(p=>({...p,smoking_status:e.target.value}));setAnamChanged(true)}} className="input-base">
                <option value="">Seleccionar</option>
                <option value="never">Nunca</option>
                <option value="former">Ex-fumador</option>
                <option value="current">Fumador activo</option>
                <option value="unknown">Desconocido</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Alcohol</label>
              <select value={profileDraft.alcohol_status ?? ""} onChange={e=>{setProfileDraft(p=>({...p,alcohol_status:e.target.value}));setAnamChanged(true)}} className="input-base">
                <option value="">Seleccionar</option>
                <option value="none">Ninguno</option>
                <option value="occasional">Ocasional</option>
                <option value="moderate">Moderado</option>
                <option value="heavy">Alto</option>
              </select>
            </div>
            <p className="text-xs text-gray-400">Para editar alergias, medicación y antecedentes ve al perfil completo del paciente.</p>
            <button onClick={() => router.push(`/patients/${patientId}/anamnesis`)} className="text-xs text-blue-600 font-medium">
              Ir a anamnesis completa →
            </button>
          </div>
        )}
      </div>

      {/* SNAPSHOT — 10 secciones completas */}
      {(() => {
        const snapSecs = [
          {n:1,title:"Medidas y embarazo",sub:patient?.biological_sex==="male"?"Peso, talla, motivo":"Peso, talla, embarazo, motivo"},
          {n:2,title:"Hábitos y actividad",sub:"Nivel de actividad, dominancia"},
          {n:3,title:"Deporte",sub:"Práctica, frecuencia y rendimiento"},
          {n:4,title:"Alimentación",sub:"Dieta y comidas del día"},
          {n:5,title:"Hidratación",sub:"Consumo de agua"},
          {n:6,title:"Evacuación",sub:"Hábito intestinal"},
          {n:7,title:"Sueño",sub:"Calidad y horas"},
          {n:8,title:"Energía",sub:"Nivel y vitalidad"},
          {n:9,title:"Estrés",sub:"Nivel y afrontamiento"},
          {n:10,title:"Estado de ánimo",sub:"Cómo se siente hoy"},
        ]
        const SP_OPTS=[{v:"walking",l:"Caminata"},{v:"running",l:"Correr"},{v:"gym_weights",l:"Gimnasio"},{v:"crossfit",l:"CrossFit"},{v:"cycling",l:"Ciclismo"},{v:"swimming",l:"Natación"},{v:"soccer",l:"Fútbol"},{v:"yoga",l:"Yoga"},{v:"pilates",l:"Pilates"},{v:"dance",l:"Baile"},{v:"tennis_padel",l:"Tenis/Pádel"},{v:"other",l:"Otro"}]
        const BK_OPTS=[{v:"no_breakfast",l:"No desayuno"},{v:"coffee_tea",l:"Café"},{v:"bread_toast",l:"Pan/tostadas"},{v:"oats_cereal",l:"Avena"},{v:"fruit",l:"Fruta"},{v:"yogurt_dairy",l:"Yogurt"},{v:"eggs",l:"Huevos"}]
        const LN_OPTS=[{v:"home_cooked",l:"Menú casero"},{v:"fast_food",l:"Comida rápida"},{v:"salad",l:"Ensalada"},{v:"rice_pasta",l:"Arroz/pasta"},{v:"chicken_meat",l:"Pollo/carne"},{v:"fish",l:"Pescado"},{v:"legumes",l:"Legumbres"}]
        const DN_OPTS=[{v:"similar_lunch",l:"Similar almuerzo"},{v:"light_meal",l:"Ligera"},{v:"fast_food",l:"Comida rápida"},{v:"snacking",l:"Picoteo"},{v:"no_dinner",l:"No ceno"}]
        const SC_OPTS=[{v:"exercise",l:"Ejercicio"},{v:"breathing_meditation",l:"Respiración"},{v:"sleep",l:"Dormir"},{v:"eating_cravings",l:"Comer"},{v:"talking",l:"Hablar"},{v:"music_leisure",l:"Música"},{v:"therapy",l:"Terapia"},{v:"caffeine_stimulants",l:"Café"},{v:"alcohol",l:"Alcohol"},{v:"tobacco",l:"Tabaco"},{v:"dont_know",l:"No lo manejo"}]
        const PH_OPTS=[{v:"none",l:"Ninguno"},{v:"diabetes",l:"Diabetes"},{v:"hypertension",l:"Hipertensión"},{v:"asthma",l:"Asma"},{v:"allergies",l:"Alergias"},{v:"thyroid",l:"Tiroides"},{v:"high_cholesterol",l:"Colesterol alto"},{v:"gastritis_reflux",l:"Gastritis"},{v:"anxiety_depression",l:"Ansiedad"},{v:"migraines",l:"Migrañas"},{v:"major_injuries",l:"Lesiones"},{v:"surgeries",l:"Cirugías"},{v:"current_meds",l:"Medicación"},{v:"other",l:"Otros"}]

        const sg = (k:string,v:string) => setSnapshot(p=>({...p,[k]:v}))
        const mu = (k:string,v:string) => setSnapshot(p=>{const a=(p[k as keyof typeof p] as string[])??[];return{...p,[k]:a.includes(v)?a.filter((x:string)=>x!==v):[...a,v]}})
        const openSec = snapOpenSec
        const setOpenSec = setSnapOpenSec
        const doneSecs = snapDoneSecs
        const setDoneSecs = setSnapDoneSecs

        const progress = Math.round((doneSecs.size/10)*100)

        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{doneSecs.size}/10 secciones</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{width:`${progress}%`}}/>
                </div>
                <span className="text-xs font-medium text-blue-600">{progress}%</span>
              </div>
            </div>

            {snapSecs.map(({n,title,sub})=>{
              const isDone=doneSecs.has(n)
              const isOpen=openSec===n
              const prevN=n>1?n-1:null
              const nextN=n<10?n+1:null
              return (
                <div key={n} className={cn("card overflow-hidden",isOpen?"border-blue-400":"")}>
                  <button type="button" onClick={()=>setOpenSec(isOpen?null:n)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",isDone?"bg-green-100 text-green-800":isOpen?"bg-blue-600 text-white":"bg-gray-100 text-gray-500 border border-gray-200")}>{isDone?"✓":n}</div>
                      <div><p className="text-sm font-medium text-gray-900">{title}</p><p className="text-xs text-gray-400">{sub}</p></div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("text-gray-400 transition-transform flex-shrink-0",isOpen?"rotate-180":"")}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 flex flex-col gap-4">
                      {n===1 && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Antecedentes (seleccionar los que apliquen)</p>
                          <div className="flex flex-wrap gap-1.5">{PH_OPTS.map(o=>{const a=(snapshot.personal_history_snapshot as string[]??[]);return(<button key={o.v} type="button" onClick={()=>o.v==="none"?setSnapshot(p=>({...p,personal_history_snapshot:["none"]})):mu("personal_history_snapshot",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",a.includes(o.v)?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>)})}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-medium text-gray-500 block mb-1">Peso (kg)</label><input type="number" value={snapshot.weight_kg??""} onChange={e=>setSnapshot(p=>({...p,weight_kg:parseFloat(e.target.value)||undefined}))} placeholder="70" className="input-base"/></div>
                          <div><label className="text-xs font-medium text-gray-500 block mb-1">Talla (cm)</label><input type="number" value={snapshot.height_cm??""} onChange={e=>setSnapshot(p=>({...p,height_cm:parseInt(e.target.value)||undefined}))} placeholder="170" className="input-base"/></div>
                        </div>
                        {patient?.biological_sex !== "male" && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Embarazo actual <span className="text-red-500">*</span></p>
                          <div className="flex flex-wrap gap-2">{[["not_applicable","No aplica"],["no","No"],["yes","Sí"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>setSnapshot(p=>({...p,pregnancy_status:v as AnamnesisSnapshot["pregnancy_status"]}))} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snapshot.pregnancy_status===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div>
                        </div>
                        {snapshot.pregnancy_status==="yes" && <div><label className="text-xs font-medium text-gray-500 block mb-1">Meses de gestación</label><select value={snapshot.gestation_months??""} onChange={e=>setSnapshot(p=>({...p,gestation_months:parseInt(e.target.value)||undefined}))} className="input-base"><option value="">Seleccionar</option>{Array.from({length:10},(_,i)=><option key={i} value={i}>{i} mes{i!==1?"es":""}</option>)}</select></div>}
                        </>)}
                        <div><label className="text-xs font-medium text-gray-500 block mb-1">Motivo de consulta <span className="text-red-500">*</span></label><textarea rows={2} value={snapshot.main_complaint??""} onChange={e=>setSnapshot(p=>({...p,main_complaint:e.target.value}))} placeholder="¿Por qué consulta hoy?" className="input-base resize-none"/></div>
                        <div><label className="text-xs font-medium text-gray-500 block mb-1">Otros antecedentes</label><textarea rows={2} value={(snapshot as Record<string,unknown>).other_history as string??""} onChange={e=>setSnapshot(p=>({...p,other_history:e.target.value}))} placeholder="Cirugías, lesiones, notas..." className="input-base resize-none"/></div>
                      </>)}
                      {n===2 && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de actividad</p><div className="flex flex-wrap gap-1.5">{[["sedentary","Sedentario"],["moderate","Moderado (1–3d)"],["active","Activo (4–5d)"],["very_active","Muy activo (6–7d)"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("activity_level",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).activity_level===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Dominancia</p><div className="flex flex-wrap gap-2">{[["right","Derecha"],["left","Izquierda"],["ambidextrous","Ambidextro"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("dominance",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).dominance===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                      </>)}
                      {n===3 && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">¿Practica deporte?</p><div className="flex gap-2">{[["true","Sí"],["false","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>setSnapshot(p=>({...p,does_sport:v==="true"}))} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",String((snapshot as Record<string,unknown>).does_sport)===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                        {(snapshot as Record<string,unknown>).does_sport && (<>
                          <div><p className="text-xs font-medium text-gray-500 mb-2">Deportes</p><div className="flex flex-wrap gap-1.5">{SP_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("sports_practiced",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",((snapshot as Record<string,unknown>).sports_practiced as string[]??[]).includes(o.v)?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs font-medium text-gray-500 block mb-1">Frecuencia</label><select value={(snapshot as Record<string,unknown>).sport_frequency as string??""} onChange={e=>sg("sport_frequency",e.target.value)} className="input-base"><option value="">Seleccionar</option>{[1,2,3,4,5,6,7].map(i=><option key={i} value={String(i)}>{i}d/sem</option>)}</select></div>
                            <div><label className="text-xs font-medium text-gray-500 block mb-1">Rendimiento</label><select value={(snapshot as Record<string,unknown>).sport_performance as string??""} onChange={e=>sg("sport_performance",e.target.value)} className="input-base"><option value="">Seleccionar</option><option value="low">Bajo</option><option value="fair">Regular</option><option value="good">Bueno</option><option value="very_good">Muy bueno</option><option value="competitive">Competitivo</option></select></div>
                          </div>
                        </>)}
                      </>)}
                      {n===4 && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Tipo de alimentación</p><div className="flex flex-wrap gap-1.5">{[["omnivore","Omnívora"],["vegetarian","Vegetariana"],["vegan","Vegana"],["keto_lowcarb","Keto"],["gluten_free","Sin gluten"],["high_protein","Alta proteína"],["fasting","Ayuno"],["other","Otro"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("diet_type",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).diet_type===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad</p><div className="flex flex-wrap gap-1.5">{[["excellent","Excelente"],["good","Buena"],["fair","Regular"],["bad","Mala"],["very_bad","Muy mala"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("diet_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).diet_quality===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Desayuno</p><div className="flex flex-wrap gap-1.5">{BK_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("breakfast",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",((snapshot as Record<string,unknown>).breakfast as string[]??[]).includes(o.v)?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Almuerzo</p><div className="flex flex-wrap gap-1.5">{LN_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("lunch",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",((snapshot as Record<string,unknown>).lunch as string[]??[]).includes(o.v)?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Cena</p><div className="flex flex-wrap gap-1.5">{DN_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("dinner",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",((snapshot as Record<string,unknown>).dinner as string[]??[]).includes(o.v)?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                      </>)}
                      {n===5 && <div><p className="text-xs font-medium text-gray-500 mb-2">Consumo de agua</p><div className="flex flex-wrap gap-1.5">{[["lt_0_5","< 0.5L"],["0_5_1","0.5–1L"],["1_1_5","1–1.5L"],["1_5_2","1.5–2L"],["2_3","2–3L"],["gt_3","> 3L"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("water_intake",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).water_intake===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>}
                      {n===6 && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Evacuación</p><div className="flex flex-wrap gap-2">{[["normal","Normal"],["constipation","Estreñimiento"],["diarrhea","Diarrea"],["variable","Variable"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("bowel_habit",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).bowel_habit===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">¿Evacua diariamente?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"],["sometimes","A veces"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("daily_bowel_movement",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).daily_bowel_movement===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Constipación abdominal</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Nada</span><input type="range" min="0" max="10" step="1" value={(snapshot as Record<string,unknown>).constipation_level as number??0} onChange={e=>setSnapshot(p=>({...p,constipation_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{(snapshot as Record<string,unknown>).constipation_level as number??0}</span><span className="text-xs text-gray-400">Severa</span></div></div>
                      </>)}
                      {n===7 && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad del sueño</p><div className="flex flex-wrap gap-1.5">{[["very_good","Muy bueno"],["good","Bueno"],["fair","Regular"],["bad","Malo"],["very_bad","Muy malo"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("sleep_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).sleep_quality===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                        <div><label className="text-xs font-medium text-gray-500 block mb-1">Horas de sueño</label><select value={(snapshot as Record<string,unknown>).sleep_hours as string??""} onChange={e=>sg("sleep_hours",e.target.value)} className="input-base"><option value="">Seleccionar</option>{Array.from({length:15},(_,i)=><option key={i} value={i}>{i} h</option>)}</select></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">¿Se despierta renovado?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"],["sometimes","A veces"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("wake_refreshed",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).wake_refreshed===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                      </>)}
                      {n===8 && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de energía</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Muy baja</span><input type="range" min="0" max="10" step="1" value={(snapshot as Record<string,unknown>).energy_level as number??5} onChange={e=>setSnapshot(p=>({...p,energy_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{(snapshot as Record<string,unknown>).energy_level as number??5}</span><span className="text-xs text-gray-400">Muy alta</span></div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">¿Con energía durante el día?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"],["sometimes","A veces"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("energy_during_day",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).energy_during_day===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                      </>)}
                      {n===9 && (<>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de estrés</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Nada</span><input type="range" min="0" max="10" step="1" value={snapshot.stress_level??5} onChange={e=>setSnapshot(p=>({...p,stress_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snapshot.stress_level??5}</span><span className="text-xs text-gray-400">Máximo</span></div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">¿Expuesto a estrés?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"],["sometimes","A veces"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("stress_exposure",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).stress_exposure===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                        <div><p className="text-xs font-medium text-gray-500 mb-2">¿Cómo lo afronta?</p><div className="flex flex-wrap gap-1.5">{SC_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("stress_coping",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",((snapshot as Record<string,unknown>).stress_coping as string[]??[]).includes(o.v)?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                      </>)}
                      {n===10 && <div><p className="text-xs font-medium text-gray-500 mb-2">¿Cómo se siente hoy?</p><div className="flex flex-wrap gap-1.5">{[["calm","Tranquilo"],["happy","Contento"],["motivated","Motivado"],["tired","Cansado"],["anxious","Ansioso"],["stressed","Estresado"],["sad","Triste"],["irritable","Irritable"],["pain_discomfort","Con dolor"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("today_mood",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snapshot as Record<string,unknown>).today_mood===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>}

                      <div className={cn("grid gap-2 mt-2",prevN?"grid-cols-2":"grid-cols-1")}>
                        {prevN && <button type="button" onClick={()=>setOpenSec(prevN)} className="tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">← Anterior</button>}
                        {nextN
                          ? <button type="button" onClick={()=>{setDoneSecs((d:Set<number>)=>new Set([...d,n]));setOpenSec(nextN)}} className="tap-target rounded-xl bg-blue-600 text-white text-sm font-semibold">Siguiente →</button>
                          : null
                        }
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {error && <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3"><p className="text-sm text-red-700">{error}</p></div>}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => {setSnapshot(p=>({...p, main_complaint:"Sin cambios"})); handleAnamnesisNext()}} disabled={savingAnam}
          className="tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium disabled:opacity-50">
          Sin cambios →
        </button>
        <button onClick={handleAnamnesisNext} disabled={savingAnam}
          className="tap-target rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
          {savingAnam ? "Guardando..." : "Continuar →"}
        </button>
      </div>
    </div>
  )
}
