"use client"
import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { getTemplate } from "@/lib/services/form-templates"
import type { FormTemplate, FormSection } from "@/lib/services/form-templates"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const FIELD_TYPE_LABELS: Record<string, string> = {
  textarea: "Texto largo", select: "Selección única", multiselect: "Selección múltiple",
  scale_0_10: "Escala 0-10", body_map: "Mapa corporal", repeating_group: "Grupo repetible",
  radio: "Radio", switch: "Interruptor", text: "Texto corto", range_of_motion: "Rango de movimiento",
  postural_assessment: "Evaluación postural", palpation: "Palpación musculoesquelética",
  vasomotor: "Síntoma vasomotor", symptom_scale: "Escala de síntoma",
  hormonal_meds: "Medicación hormonal", lab_upload: "Subir laboratorios",
  decimal: "Número decimal", number: "Número entero", date: "Fecha",
  section_header: "Encabezado de sección", divider: "Divisor", info_text: "Texto informativo",
  scored_test: "Test con puntaje", measurement: "Medición",
}

const AI_SECTION_CONFIG: Record<string, { label: string; vars: string[] }> = {
  s_dolor: {
    label: "IA — Sugerencia de evaluaciones",
    vars: ["{{motivo_consulta}}", "{{dolor_eva}}", "{{tipo_dolor}}", "{{patron_dolor}}", "{{dolor_agrava}}", "{{dolor_alivia}}", "{{historial_clinico}}", "{{anamnesis}}", "{{sexo}}", "{{edad}}"]
  },
  s_conclusion: {
    label: "IA — Pre-diagnóstico fisioterapéutico",
    vars: ["{{motivo_consulta}}", "{{dolor_eva}}", "{{tipo_dolor}}", "{{postural}}", "{{palpacion}}", "{{articular}}", "{{muscular}}", "{{tests}}", "{{historial_clinico}}", "{{anamnesis}}", "{{sexo}}", "{{edad}}"]
  },
  s_ia_hormonal: {
    label: "IA — Análisis hormonal completo",
    vars: ["{{sexo}}", "{{edad}}", "{{etapa_menopausica}}", "{{ultima_menstruacion}}", "{{regularidad_ciclo}}", "{{historia_ginecologica}}", "{{vasomotores}}", "{{neurocognitivos}}", "{{hormonales_sexualidad}}", "{{metabolicos}}", "{{genitourinario}}", "{{screening_riesgos}}", "{{antecedentes_medicos}}", "{{medicacion}}", "{{estilo_vida}}", "{{laboratorios}}", "{{historial_clinico}}"]
  }
}

export default function EvaluacionDetailPage() {
  const { tid } = useParams<{ tid: string }>()
  const router = useRouter()
  const [tmpl, setTmpl] = useState<FormTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [isAdmin, setIsAdmin] = useState(false)
  const [aiPrompts, setAiPrompts] = useState<Record<string, string>>({})
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null)
  const [savedPrompt, setSavedPrompt] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const data = await getTemplate(tid)
    if (!data) { router.push("/evaluaciones"); return }
    setTmpl(data)
    if (data?.fields?.[0]) setOpenSections(new Set([data.fields[0].id]))

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      setIsAdmin(prof?.role === "admin")
    }

    const promptMap: Record<string, string> = {}
    ;(data.fields as Record<string, unknown>[]).forEach(s => {
      if (s.ai_prompt && typeof s.ai_prompt === "string") {
        promptMap[s.id as string] = s.ai_prompt
      }
    })
    setAiPrompts(promptMap)
    setLoading(false)
  }, [tid, router])

  useEffect(() => { loadData() }, [loadData])

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function saveAiPrompt(sectionId: string) {
    setSavingPrompt(sectionId)
    try {
      const supabase = createClient()
      const { data: tmplData } = await supabase
        .from("specialty_form_templates")
        .select("fields")
        .eq("id", tid)
        .single()

      const fields = (tmplData?.fields as Record<string, unknown>[]).map(s =>
        s.id === sectionId ? { ...s, ai_prompt: aiPrompts[sectionId] } : s
      )

      await supabase
        .from("specialty_form_templates")
        .update({ fields })
        .eq("id", tid)

      setSavedPrompt(sectionId)
      setTimeout(() => setSavedPrompt(null), 2500)
    } finally {
      setSavingPrompt(null)
    }
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!tmpl) return null

  const sp = tmpl.specialty as { name: string; color: string } | undefined
  const totalFields = (tmpl.fields ?? []).reduce((s, sec) => s + (sec.fields?.length ?? 0), 0)

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 truncate">{tmpl.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {sp && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                style={{ background: sp.color + "22", color: sp.color }}>
                {sp.name}
              </span>
            )}
            <span className="text-xs text-gray-400">{(tmpl.fields ?? []).length} secciones · {totalFields} campos</span>
            {tmpl.estimated_minutes && (
              <span className="text-xs text-gray-400">~{tmpl.estimated_minutes} min</span>
            )}
          </div>
        </div>
      </div>

      {tmpl.description && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-600">{tmpl.description}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(tmpl.fields ?? []).map((section: FormSection, idx: number) => {
          const isOpen = openSections.has(section.id)
          const reqFields = section.fields?.filter(f => f.required).length ?? 0
          return (
            <div key={section.id} className="card overflow-hidden">
              <button onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-500">{idx + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{section.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {section.fields?.length ?? 0} campos
                      {reqFields > 0 && ` · ${reqFields} obligatorios`}
                      {section.required && " · seccion obligatoria"}
                    </p>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={cn("transition-transform flex-shrink-0", isOpen ? "rotate-180" : "")}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 pb-4 flex flex-col gap-2 pt-3">
                  {section.description && (
                    <p className="text-xs text-gray-500 italic mb-1">{section.description}</p>
                  )}
                  {(section.fields ?? []).map(field => (
                    <div key={field.key}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-gray-800">{field.label}</p>
                          {field.required && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                              requerido
                            </span>
                          )}
                          {field.audit_required && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                              auditoria
                            </span>
                          )}
                        </div>
                        {field.help_text && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{field.help_text}</p>
                        )}
                        {field.options && field.options.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {field.options.slice(0, 4).map(o => o.label).join(" · ")}
                            {field.options.length > 4 && ` +${field.options.length - 4} mas`}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                        {FIELD_TYPE_LABELS[field.type] ?? field.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Servicios que usan este template</p>
        <p className="text-xs text-gray-400">
          Para asignar este formulario a un servicio, ve al modulo de Servicios y edita el servicio correspondiente.
        </p>
        <button onClick={() => router.push("/servicios")}
          className="mt-3 text-xs text-blue-600 font-medium">
          Ir a Servicios →
        </button>
      </div>

      {isAdmin && Object.keys(aiPrompts).length > 0 && (
        <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
            <h3 className="text-sm font-semibold text-gray-900">Configuración IA</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium border border-purple-200">Solo administradores</span>
          </div>

          <div className="text-xs text-blue-800 bg-blue-50 px-4 py-3 rounded-xl border border-blue-200 leading-relaxed">
            Los prompts definen el contexto clínico enviado a la IA. Las{" "}
            <code className="bg-blue-100 px-1 rounded font-mono">{"{{variables}}"}</code>{" "}
            se reemplazan automáticamente con los datos reales del paciente al ejecutar. Solo edita el contexto clínico — las instrucciones de formato JSON se mantienen fijas.
          </div>

          {Object.entries(aiPrompts).map(([sectionId, prompt]) => {
            const config = AI_SECTION_CONFIG[sectionId]
            if (!config) return null
            return (
              <div key={sectionId} className="card overflow-hidden">
                <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                    <span className="text-xs font-semibold text-purple-900">{config.label}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono">{sectionId}</span>
                </div>
                <div className="px-4 py-4 flex flex-col gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Variables disponibles — toca para insertar en el cursor</p>
                    <div className="flex flex-wrap gap-1.5">
                      {config.vars.map(v => (
                        <button key={v} type="button"
                          onClick={() => {
                            const ta = document.getElementById(`prompt-${sectionId}`) as HTMLTextAreaElement
                            if (!ta) return
                            const start = ta.selectionStart ?? prompt.length
                            const end = ta.selectionEnd ?? prompt.length
                            const next = prompt.substring(0, start) + v + prompt.substring(end)
                            setAiPrompts(prev => ({ ...prev, [sectionId]: next }))
                            setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + v.length }, 0)
                          }}
                          className="px-2 py-1 rounded-md text-xs font-mono bg-gray-100 border border-gray-200 text-gray-700 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-800 transition-all">
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Contexto clínico</p>
                    <textarea
                      id={`prompt-${sectionId}`}
                      value={prompt}
                      onChange={e => setAiPrompts(prev => ({ ...prev, [sectionId]: e.target.value }))}
                      rows={9}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 bg-white resize-y focus:outline-none focus:border-purple-400 leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => {
                        if (confirm("¿Restablecer al prompt guardado en BD? Se perderán los cambios no guardados.")) {
                          loadData()
                        }
                      }}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.33"/>
                      </svg>
                      Restablecer
                    </button>
                    <div className="flex-1" />
                    {savedPrompt === sectionId && (
                      <span className="text-xs text-green-700 flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#27500A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Guardado correctamente
                      </span>
                    )}
                    <button type="button"
                      onClick={() => saveAiPrompt(sectionId)}
                      disabled={savingPrompt === sectionId}
                      className="px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 hover:bg-purple-800 transition-colors">
                      {savingPrompt === sectionId ? (
                        <>
                          <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Guardar prompt
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
