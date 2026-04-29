"use client"
import { useState, useCallback, useEffect } from "react"
import type { FormTemplateConfig, FormSectionConfig } from "@/types/domain"
import { SectionRenderer } from "./SectionRenderer"
import { computeScore } from "./form-utils"
import { cn } from "@/lib/utils"

interface ClinicalContext {
  patientSex?: string
  patientBirthDate?: string
  anamnesisSnapshot?: Record<string, unknown>
  profile?: Record<string, unknown>
}

interface AISuggestion {
  impression: string
  priority_tests: { name: string; reason: string; priority: "high"|"medium"|"low" }[]
  treatment_focus: string[]
  alerts: string[]
}

interface AIPrediagnosis {
  functional_diagnosis: string
  treatment_plan: string[]
  sessions_recommended: number
  frequency: string
  alerts: string[]
}

interface AIHormonalAnalysis {
  clinical_impression: string
  suspected_patterns: { pattern: string; confidence: "alta"|"media"|"baja"; rationale: string }[]
  priority_labs: { name: string; reason: string; priority: "high"|"medium"|"low"; timing?: string }[]
  treatment_approach: string[]
  lifestyle_recommendations: string[]
  alerts: string[]
  follow_up: string
}

interface FormEngineProps {
  template: FormTemplateConfig
  initialAnswers?: Record<string, unknown>
  onSave?: (answers: Record<string, unknown>, scores: Record<string, number>) => Promise<void>
  onComplete?: (answers: Record<string, unknown>, scores: Record<string, number>) => Promise<void>
  disabled?: boolean
  showCompleteButton?: boolean
  clinicalContext?: ClinicalContext
}

export function FormEngine({
  template, initialAnswers = {}, onSave, onComplete, disabled, showCompleteButton = true, clinicalContext = {}
}: FormEngineProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers)
  const [openSection, setOpenSection] = useState<string>(template.sections[0]?.id ?? "")

  // Re-sincronizar cuando llegan respuestas guardadas de forma asíncrona
  const initialAnswersRef = useState(initialAnswers)[0]
  useEffect(() => {
    if (initialAnswers && Object.keys(initialAnswers).length > 0) {
      setAnswers(initialAnswers)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialAnswers)])
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [aiSugLoading, setAiSugLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion|null>(null)
  const [aiSugError, setAiSugError] = useState<string|null>(null)
  const [aiDxLoading, setAiDxLoading] = useState(false)
  const [aiPrediagnosis, setAiPrediagnosis] = useState<AIPrediagnosis|null>(null)
  const [aiDxError, setAiDxError] = useState<string|null>(null)
  const [aiHormonalLoading, setAiHormonalLoading] = useState(false)
  const [aiHormonalAnalysis, setAiHormonalAnalysis] = useState<AIHormonalAnalysis|null>(null)
  const [aiHormonalError, setAiHormonalError] = useState<string|null>(null)
  const [aiHormonalResult, setAiHormonalResult] = useState<{
    impresion_clinica: string
    etapa_sugerida: string
    sintomas_predominantes: string[]
    riesgos_identificados: string[]
    alertas_contraindicaciones: string[]
    lineas_tratamiento: string[]
    examenes_sugeridos: string[]
    seguimiento_recomendado: string
  }|null>(null)

  const setAnswer = useCallback((key: string, val: unknown) => {
    setAnswers(prev => ({ ...prev, [key]: val }))
  }, [])

  async function runAISuggestion() {
    setAiSugLoading(true); setAiSugError(null)
    try {
      const secDolor = template.sections.find(s => s.id === "s_dolor")
      const customPrompt = (secDolor as Record<string, unknown>)?.ai_prompt as string | undefined

      const resp = await fetch("/api/ai-suggest-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: { biological_sex: clinicalContext.patientSex, birth_date: clinicalContext.patientBirthDate },
          anamnesis: clinicalContext.anamnesisSnapshot ?? {},
          profile: clinicalContext.profile ?? {},
          form_data: answers,
          evaluation_type: template.form_type,
          specialty: template.specialty,
          custom_prompt: customPrompt,
        })
      })
      if (!resp.ok) throw new Error()
      setAiSuggestion(await resp.json())
    } catch { setAiSugError("No se pudo obtener la sugerencia. Intenta nuevamente.") }
    finally { setAiSugLoading(false) }
  }

  async function runAIPrediagnosis() {
    setAiDxLoading(true); setAiDxError(null)
    try {
      const secConclusion = template.sections.find(s => s.id === "s_conclusion")
      const customPrompt = (secConclusion as Record<string, unknown>)?.ai_prompt as string | undefined

      const resp = await fetch("/api/ai-prediagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: { biological_sex: clinicalContext.patientSex, birth_date: clinicalContext.patientBirthDate },
          anamnesis: clinicalContext.anamnesisSnapshot ?? {},
          profile: clinicalContext.profile ?? {},
          evaluation: answers,
          specialty: template.specialty,
          custom_prompt: customPrompt,
        })
      })
      if (!resp.ok) throw new Error()
      setAiPrediagnosis(await resp.json())
    } catch { setAiDxError("No se pudo generar el pre-diagnóstico. Intenta nuevamente.") }
    finally { setAiDxLoading(false) }
  }

  async function runHormonalAI() {
    setAiHormonalLoading(true); setAiHormonalError(null)
    try {
      const secIA = template.sections.find(s => s.id === "s_ia_hormonal")
      const customPrompt = (secIA as Record<string, unknown>)?.ai_prompt as string | undefined

      const resp = await fetch("/api/ai-hormonal-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: { biological_sex: clinicalContext.patientSex, birth_date: clinicalContext.patientBirthDate },
          anamnesis: clinicalContext.anamnesisSnapshot ?? {},
          evaluation: answers,
          historialClinico: clinicalContext.profile ?? {},
          custom_prompt: customPrompt,
        })
      })
      if (!resp.ok) throw new Error()
      setAiHormonalResult(await resp.json())
    } catch { setAiHormonalError("No se pudo generar el análisis. Intenta nuevamente.") }
    finally { setAiHormonalLoading(false) }
  }

  async function runAIHormonalAnalysis() {
    setAiHormonalLoading(true); setAiHormonalError(null)
    try {
      const secIA = template.sections.find(s => s.id === "s_ia_hormonal" || s.id === "s_ia_sugerencia")
      const customPrompt = (secIA as Record<string, unknown>)?.ai_prompt as string | undefined

      const resp = await fetch("/api/ai-hormonal-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: { biological_sex: clinicalContext.patientSex, birth_date: clinicalContext.patientBirthDate },
          anamnesis: clinicalContext.anamnesisSnapshot ?? {},
          evaluation_data: answers,
          custom_prompt: customPrompt,
        })
      })
      if (!resp.ok) throw new Error()
      setAiHormonalAnalysis(await resp.json())
    } catch { setAiHormonalError("No se pudo generar el análisis. Intenta nuevamente.") }
    finally { setAiHormonalLoading(false) }
  }

  function isSectionComplete(section: FormSectionConfig): boolean {
    const required = section.fields.filter(f => f.required)
    // Si no hay campos required, la sección está completa solo si tiene al menos una respuesta
    if (required.length === 0) {
      const hasAnyAnswer = section.fields.some(f => {
        const v = answers[f.key]
        return v !== undefined && v !== null && v !== "" &&
          !(Array.isArray(v) && v.length === 0)
      })
      // Si no tiene fields o tiene respuestas = completa; si tiene fields sin respuestas = incompleta
      return section.fields.length === 0 || hasAnyAnswer
    }
    return required.every(f => {
      const v = answers[f.key]
      return v !== undefined && v !== null && v !== "" &&
        !(Array.isArray(v) && v.length === 0)
    })
  }

  function computeAllScores(): Record<string, number> {
    const scores: Record<string, number> = {}
    template.sections.forEach(section => {
      if (section.scoring?.enabled) {
        scores[section.id] = computeScore(answers, section.fields)
      }
    })
    if (Object.keys(scores).length > 0) {
      scores.total = Object.values(scores).reduce((a, b) => a + b, 0)
    }
    return scores
  }

  function goNextSection() {
    const idx = template.sections.findIndex(s => s.id === openSection)
    if (idx < template.sections.length - 1) {
      setOpenSection(template.sections[idx + 1].id)
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50)
    }
  }

  const requiredSections = template.sections.filter(s => s.required)
  const allRequiredComplete = requiredSections.every(isSectionComplete)
  const completedCount = template.sections.filter(isSectionComplete).length
  const totalProgress = Math.round((completedCount / template.sections.length) * 100)
  const currentIdx = template.sections.findIndex(s => s.id === openSection)
  const isLastSection = currentIdx === template.sections.length - 1

  async function handleSave() {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(answers, computeAllScores())
      setLastSaved(new Date())
    } finally { setSaving(false) }
  }

  async function handleComplete() {
    if (!onComplete) return
    setCompleting(true)
    try {
      await onComplete(answers, computeAllScores())
    } finally { setCompleting(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card px-5 py-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-gray-500 font-medium">{template.name}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {completedCount}/{template.sections.length} secciones
            </span>
          </div>
        </div>
        {lastSaved && (
          <p className="text-xs text-gray-400 flex-shrink-0">
            Guardado {lastSaved.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {onSave && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || disabled}
            className="tap-target px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        )}
      </div>

      {template.sections.map(section => (
        <div key={section.id} className="flex flex-col gap-3">
          <SectionRenderer
            section={section}
            answers={answers}
            onChange={setAnswer}
            isOpen={openSection === section.id}
            onToggle={() => setOpenSection(openSection === section.id ? "" : section.id)}
            isCompleted={isSectionComplete(section)}
            disabled={disabled}
          />
          {section.id === "s_ia_sugerencia" && !disabled && (isSectionComplete(section) || openSection === section.id) && (
            <div className="border border-purple-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide">IA — Análisis hormonal</span>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {!aiHormonalAnalysis && !aiHormonalLoading && (
                  <>
                    <p className="text-xs text-gray-500 leading-relaxed">Basado en la anamnesis hormonal completa y los datos de evaluación — genera un análisis clínico del estado hormonal, patrones sospechados, laboratorios prioritarios y plan de abordaje.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Anamnesis hormonal","Ciclo menstrual","Estado menopáusico","Datos de evaluación"].map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">{t}</span>
                      ))}
                    </div>
                    {aiHormonalError && <p className="text-xs text-red-600">{aiHormonalError}</p>}
                    <button onClick={runAIHormonalAnalysis} className="w-full py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                      Generar análisis hormonal →
                    </button>
                  </>
                )}
                {aiHormonalLoading && (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <div className="w-7 h-7 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"/>
                    <p className="text-xs text-gray-500">Analizando perfil hormonal completo...</p>
                  </div>
                )}
                {aiHormonalAnalysis && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-900">Análisis generado</span>
                      <button onClick={() => setAiHormonalAnalysis(null)} className="text-xs text-gray-400 hover:text-gray-600">Descartar</button>
                    </div>
                    <div className="px-3 py-2.5 bg-purple-50 rounded-xl">
                      <p className="text-xs text-purple-900 leading-relaxed">{aiHormonalAnalysis.clinical_impression}</p>
                    </div>
                    {aiHormonalAnalysis.suspected_patterns.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5">Patrones sospechados</p>
                        <div className="flex flex-col gap-1.5">
                          {aiHormonalAnalysis.suspected_patterns.map((p, i) => (
                            <div key={i} className={`px-3 py-2.5 rounded-xl flex items-start gap-2 ${p.confidence==="alta"?"bg-red-50":p.confidence==="media"?"bg-amber-50":"bg-blue-50"}`}>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${p.confidence==="alta"?"bg-red-500":p.confidence==="media"?"bg-amber-500":"bg-blue-500"}`}/>
                              <div>
                                <p className={`text-xs font-semibold ${p.confidence==="alta"?"text-red-900":p.confidence==="media"?"text-amber-900":"text-blue-900"}`}>{p.pattern} <span className="font-normal opacity-70">(confianza {p.confidence})</span></p>
                                <p className={`text-xs ${p.confidence==="alta"?"text-red-600":p.confidence==="media"?"text-amber-600":"text-blue-600"}`}>{p.rationale}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiHormonalAnalysis.priority_labs.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5">Laboratorios prioritarios</p>
                        <div className="flex flex-col gap-1.5">
                          {aiHormonalAnalysis.priority_labs.map((lab, i) => (
                            <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl ${lab.priority==="high"?"bg-red-50":lab.priority==="medium"?"bg-amber-50":"bg-green-50"}`}>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${lab.priority==="high"?"bg-red-500":lab.priority==="medium"?"bg-amber-500":"bg-green-500"}`}/>
                              <div>
                                <p className={`text-xs font-semibold ${lab.priority==="high"?"text-red-900":lab.priority==="medium"?"text-amber-900":"text-green-900"}`}>{lab.name}</p>
                                <p className={`text-xs ${lab.priority==="high"?"text-red-600":lab.priority==="medium"?"text-amber-600":"text-green-600"}`}>{lab.reason}</p>
                                {lab.timing && <p className="text-xs text-gray-400 mt-0.5">Timing: {lab.timing}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiHormonalAnalysis.treatment_approach.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5">Abordaje terapéutico</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiHormonalAnalysis.treatment_approach.map((t, i) => (
                            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiHormonalAnalysis.lifestyle_recommendations.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5">Estilo de vida</p>
                        <div className="flex flex-col gap-1.5">
                          {aiHormonalAnalysis.lifestyle_recommendations.map((r, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-green-50 rounded-xl">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5"/>
                              <p className="text-xs text-green-900">{r}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiHormonalAnalysis.alerts.length > 0 && (
                      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-200">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <div className="flex flex-col gap-0.5">{aiHormonalAnalysis.alerts.map((a, i) => <p key={i} className="text-xs text-amber-700">{a}</p>)}</div>
                      </div>
                    )}
                    {aiHormonalAnalysis.follow_up && (
                      <div className="px-3 py-2.5 bg-gray-50 rounded-xl">
                        <p className="text-xs font-medium text-gray-600 mb-0.5">Seguimiento sugerido</p>
                        <p className="text-xs text-gray-700">{aiHormonalAnalysis.follow_up}</p>
                      </div>
                    )}
                    <p className="text-xs text-gray-400">Análisis orientativo — el profesional confirma el diagnóstico y plan terapéutico.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {section.id === "s_ia_hormonal" && !disabled && (
            <div className="border border-purple-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide">IA — Análisis clínico hormonal</span>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {!aiHormonalResult && !aiHormonalLoading && (
                  <>
                    <p className="text-xs text-gray-500 leading-relaxed">Analiza historial clínico + anamnesis + toda la evaluación para generar un análisis clínico hormonal completo.</p>
                    {aiHormonalError && <p className="text-xs text-red-600">{aiHormonalError}</p>}
                    <button onClick={runHormonalAI} className="w-full py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                      Generar análisis completo →
                    </button>
                  </>
                )}
                {aiHormonalLoading && (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <div className="w-7 h-7 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"/>
                    <p className="text-xs text-gray-500">Analizando historial clínico completo...</p>
                  </div>
                )}
                {aiHormonalResult && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-900">Análisis generado</span>
                      <button onClick={() => setAiHormonalResult(null)} className="text-xs text-gray-400 hover:text-gray-600">Descartar</button>
                    </div>
                    <div className="px-3 py-2.5 bg-purple-50 rounded-xl">
                      <p className="text-xs font-medium text-purple-900 mb-1">Impresión clínica</p>
                      <p className="text-xs text-purple-800 leading-relaxed">{aiHormonalResult.impresion_clinica}</p>
                    </div>
                    <div className="px-3 py-2.5 bg-blue-50 rounded-xl">
                      <p className="text-xs font-medium text-blue-900 mb-1">Etapa sugerida</p>
                      <p className="text-xs text-blue-800">{aiHormonalResult.etapa_sugerida.replace(/_/g, " ")}</p>
                    </div>
                    {aiHormonalResult.alertas_contraindicaciones.length > 0 && (
                      <div className="px-3 py-2.5 bg-red-50 rounded-xl border border-red-200">
                        <p className="text-xs font-semibold text-red-900 mb-1">Alertas / Contraindicaciones</p>
                        {aiHormonalResult.alertas_contraindicaciones.map((a, i) => <p key={i} className="text-xs text-red-700">{a}</p>)}
                      </div>
                    )}
                    {aiHormonalResult.sintomas_predominantes.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5">Síntomas predominantes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiHormonalResult.sintomas_predominantes.map((s, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiHormonalResult.lineas_tratamiento.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5">Líneas de tratamiento sugeridas</p>
                        <div className="flex flex-col gap-1.5">
                          {aiHormonalResult.lineas_tratamiento.map((l, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-green-50 rounded-xl">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5"/>
                              <p className="text-xs text-green-900">{l}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiHormonalResult.examenes_sugeridos.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1.5">Exámenes sugeridos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiHormonalResult.examenes_sugeridos.map((e, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">{e}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="px-3 py-2 bg-gray-50 rounded-xl">
                      <p className="text-xs font-medium text-gray-700 mb-0.5">Seguimiento recomendado</p>
                      <p className="text-xs text-gray-600">{aiHormonalResult.seguimiento_recomendado}</p>
                    </div>
                    <p className="text-xs text-gray-400">Análisis orientativo — el profesional confirma el diagnóstico.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {section.id === "s_dolor" && !disabled && (isSectionComplete(section) || openSection === section.id) && (
            <div className="border border-purple-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide">IA — Sugerir evaluaciones y tests</span>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {!aiSuggestion && !aiSugLoading && (
                  <>
                    <p className="text-xs text-gray-500 leading-relaxed">Basado en el historial clínico, anamnesis, motivo de consulta y evaluación del dolor — sugiere qué evaluaciones realizar en esta consulta.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Historial clínico","Anamnesis","Motivo de consulta","Evaluación del dolor"].map(t=>(
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">{t}</span>
                      ))}
                    </div>
                    {aiSugError && <p className="text-xs text-red-600">{aiSugError}</p>}
                    <button onClick={runAISuggestion} className="w-full py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                      Sugerir evaluaciones →
                    </button>
                  </>
                )}
                {aiSugLoading && (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <div className="w-7 h-7 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"/>
                    <p className="text-xs text-gray-500">Analizando historial clínico completo...</p>
                  </div>
                )}
                {aiSuggestion && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-900">Sugerencia generada</span>
                      <button onClick={()=>setAiSuggestion(null)} className="text-xs text-gray-400 hover:text-gray-600">Descartar</button>
                    </div>
                    <div className="px-3 py-2.5 bg-purple-50 rounded-xl">
                      <p className="text-xs text-purple-900 leading-relaxed">{aiSuggestion.impression}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {aiSuggestion.priority_tests.map((t,i)=>(
                        <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl ${t.priority==="high"?"bg-red-50":t.priority==="medium"?"bg-amber-50":"bg-green-50"}`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${t.priority==="high"?"bg-red-500":t.priority==="medium"?"bg-amber-500":"bg-green-500"}`}/>
                          <div>
                            <p className={`text-xs font-semibold ${t.priority==="high"?"text-red-900":t.priority==="medium"?"text-amber-900":"text-green-900"}`}>{t.name}</p>
                            <p className={`text-xs ${t.priority==="high"?"text-red-600":t.priority==="medium"?"text-amber-600":"text-green-600"}`}>{t.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {aiSuggestion.treatment_focus.length>0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {aiSuggestion.treatment_focus.map((t,i)=><span key={i} className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">{t}</span>)}
                      </div>
                    )}
                    {aiSuggestion.alerts.length>0 && (
                      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-200">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <div className="flex flex-col gap-0.5">{aiSuggestion.alerts.map((a,i)=><p key={i} className="text-xs text-amber-700">{a}</p>)}</div>
                      </div>
                    )}
                    <p className="text-xs text-gray-400">Sugerencia orientativa — el profesional decide qué realizar.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-3 mt-2">
        {!isLastSection && (
          <button
            type="button"
            onClick={goNextSection}
            className="tap-target flex-1 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Siguiente sección
          </button>
        )}
        {showCompleteButton && onComplete && allRequiredComplete && !disabled && template.sections.some(s => s.id === "s_conclusion") && (
          <div className="w-full flex flex-col gap-3">
            <div className="border border-purple-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide">IA — Generar pre-diagnóstico</span>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {!aiPrediagnosis && !aiDxLoading && (
                  <>
                    <p className="text-xs text-gray-500 leading-relaxed">Basado en el historial clínico, anamnesis y toda la evaluación fisioterapéutica — genera un pre-diagnóstico y plan de tratamiento sugerido.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Historial clínico","Anamnesis","Evaluación completa","Tests realizados"].map(t=>(
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">{t}</span>
                      ))}
                    </div>
                    {aiDxError && <p className="text-xs text-red-600">{aiDxError}</p>}
                    <button onClick={runAIPrediagnosis} className="w-full py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                      Generar pre-diagnóstico →
                    </button>
                  </>
                )}
                {aiDxLoading && (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <div className="w-7 h-7 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"/>
                    <p className="text-xs text-gray-500">Analizando evaluación completa...</p>
                  </div>
                )}
                {aiPrediagnosis && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-900">Pre-diagnóstico generado</span>
                      <button onClick={()=>setAiPrediagnosis(null)} className="text-xs text-gray-400">Descartar</button>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Diagnóstico funcional sugerido</p>
                      <div className="px-3 py-2.5 bg-purple-50 rounded-xl">
                        <p className="text-xs text-purple-900 font-medium">{aiPrediagnosis.functional_diagnosis}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Plan de tratamiento</p>
                      <div className="flex flex-col gap-1.5">
                        {aiPrediagnosis.treatment_plan.map((t,i)=>(
                          <div key={i} className="flex items-start gap-2 px-3 py-2 bg-blue-50 rounded-xl">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"/>
                            <p className="text-xs text-blue-900">{t}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="px-3 py-2.5 bg-gray-50 rounded-xl text-center">
                        <p className="text-xs text-gray-500">Sesiones</p>
                        <p className="text-sm font-semibold text-gray-900">{aiPrediagnosis.sessions_recommended}</p>
                      </div>
                      <div className="px-3 py-2.5 bg-gray-50 rounded-xl text-center">
                        <p className="text-xs text-gray-500">Frecuencia</p>
                        <p className="text-sm font-semibold text-gray-900">{aiPrediagnosis.frequency}</p>
                      </div>
                    </div>
                    {aiPrediagnosis.alerts.length>0 && (
                      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-200">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <div className="flex flex-col gap-0.5">{aiPrediagnosis.alerts.map((a,i)=><p key={i} className="text-xs text-amber-700">{a}</p>)}</div>
                      </div>
                    )}
                    <p className="text-xs text-gray-400">Pre-diagnóstico orientativo — el profesional confirma en el módulo de diagnóstico.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {showCompleteButton && onComplete && (
          <button
            type="button"
            onClick={handleComplete}
            disabled={completing || disabled || !allRequiredComplete}
            className={cn(
              "tap-target flex-1 rounded-xl text-sm font-semibold transition-colors",
              allRequiredComplete
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            {completing ? "Completando..." : allRequiredComplete ? "Completar formulario" : "Completar campos requeridos"}
          </button>
        )}
      </div>

      {!allRequiredComplete && requiredSections.length > 0 && (
        <p className="text-xs text-center text-gray-400">
          {requiredSections.filter(s => !isSectionComplete(s)).map(s => s.title).join(", ")} — pendientes
        </p>
      )}
    </div>
  )
}