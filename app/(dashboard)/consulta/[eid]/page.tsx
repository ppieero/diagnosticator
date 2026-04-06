"use client"
import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getEncounter, getEncounterForms, saveEncounterForm, completeEncounter } from "@/lib/services/encounters"
import { getTemplatesForService } from "@/lib/services/form-templates"
import type { Encounter, EncounterForm } from "@/lib/services/encounters"
import type { FormTemplate } from "@/lib/services/form-templates"
import FormEngine from "@/components/form-engine/FormEngine"
import { cn } from "@/lib/utils"

type Step = "select_form" | "fill_form" | "complete"

export default function ConsultaPage() {
  const { eid } = useParams<{ eid: string }>()
  const router = useRouter()
  const [encounter, setEncounter] = useState<Encounter | null>(null)
  const [availableForms, setAvailableForms] = useState<FormTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null)
  const [existingForm, setExistingForm] = useState<EncounterForm | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [soapNotes, setSoapNotes] = useState("")
  const [step, setStep] = useState<Step>("select_form")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [userId, setUserId] = useState("")

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
    const enc = await getEncounter(eid)
    if (!enc) { router.push("/agenda"); return }
    setEncounter(enc)
    const forms = await getEncounterForms(eid)
    const appt = enc.appointment as { service?: { id: string } } | undefined
    const serviceId = appt?.service?.id
    if (serviceId) {
      const templates = await getTemplatesForService(serviceId)
      setAvailableForms(templates)
      if (templates.length === 1) {
        setSelectedTemplate(templates[0])
        const existing = forms.find(f => f.template_id === templates[0].id)
        if (existing) { setExistingForm(existing); setAnswers(existing.answers ?? {}) }
        setStep("fill_form")
      }
    }
    if (enc.status === "completed") setStep("complete")
    setLoading(false)
  }, [eid, router])

  useEffect(() => { load() }, [load])

  function handleAnswer(key: string, value: unknown) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  async function handleSaveDraft() {
    if (!selectedTemplate) return
    setSaving(true)
    await saveEncounterForm({
      encounter_id: eid,
      template_id: selectedTemplate.id,
      form_type: selectedTemplate.form_type,
      answers,
      completed_by: userId,
    })
    setSaving(false)
  }

  async function handleComplete() {
    if (!selectedTemplate) return
    setCompleting(true)
    await saveEncounterForm({
      encounter_id: eid,
      template_id: selectedTemplate.id,
      form_type: selectedTemplate.form_type,
      answers,
      completed_by: userId,
    })
    const apptId = (encounter?.appointment as { id?: string } | undefined)?.id
    await completeEncounter(eid, apptId, soapNotes)
    setStep("complete")
    setCompleting(false)
  }

  function selectTemplate(tmpl: FormTemplate) {
    setSelectedTemplate(tmpl)
    const existing = existingForm?.template_id === tmpl.id ? existingForm : null
    if (existing) setAnswers(existing.answers ?? {})
    else setAnswers({})
    setStep("fill_form")
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!encounter) return null

  const patientName = (encounter.patient as { full_name: string } | undefined)?.full_name ?? "Paciente"
  const profName = (encounter.professional as { profile?: { full_name: string } } | undefined)?.profile?.full_name ?? ""
  const svcName = (encounter.appointment as { service?: { name: string } } | undefined)?.service?.name ?? ""

  const totalSections = selectedTemplate?.fields?.length ?? 0
  const filledSections = selectedTemplate?.fields?.filter(sec =>
    sec.fields?.some(f => {
      const v = answers[`${sec.id}.${f.key}`]
      return v !== undefined && v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
    })
  ).length ?? 0

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
          <p className="text-base font-semibold text-gray-900">{patientName}</p>
          <p className="text-xs text-gray-400">{svcName} · Sesion #{encounter.session_number}</p>
        </div>
        <span className={cn("text-xs font-medium px-3 py-1 rounded-xl",
          encounter.status === "completed" ? "bg-green-100 text-green-800" :
          encounter.status === "in_progress" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600")}>
          {encounter.status === "completed" ? "Completada" : encounter.status === "in_progress" ? "En curso" : "Pendiente"}
        </span>
      </div>

      {step === "select_form" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Seleccionar formulario de evaluacion
          </p>
          {availableForms.length === 0 ? (
            <div className="card p-6 text-center flex flex-col gap-2">
              <p className="text-sm text-gray-600">Este servicio no tiene formularios asignados.</p>
              <button onClick={() => setStep("fill_form")} className="text-xs text-blue-600 font-medium">
                Continuar sin formulario →
              </button>
            </div>
          ) : (
            availableForms.map(tmpl => (
              <button key={tmpl.id} onClick={() => selectTemplate(tmpl)}
                className="card p-4 text-left hover:shadow-md transition-shadow w-full">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{tmpl.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tmpl.fields?.length ?? 0} secciones
                      {tmpl.estimated_minutes ? ` · ~${tmpl.estimated_minutes} min` : ""}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {step === "fill_form" && selectedTemplate && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{selectedTemplate.name}</p>
              <p className="text-xs text-gray-400">{filledSections}/{totalSections} secciones con datos</p>
            </div>
            {availableForms.length > 1 && (
              <button onClick={() => setStep("select_form")} className="text-xs text-blue-600 font-medium">
                Cambiar formulario
              </button>
            )}
          </div>

          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: totalSections > 0 ? `${(filledSections / totalSections) * 100}%` : "0%" }} />
          </div>

          <FormEngine
            sections={selectedTemplate.fields ?? []}
            answers={answers}
            onChange={handleAnswer}
          />

          <div className="card p-4 flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Notas SOAP / cierre de sesion (opcional)
            </label>
            <textarea value={soapNotes} onChange={e => setSoapNotes(e.target.value)}
              rows={3} placeholder="Subjetivo, objetivo, analisis, plan..."
              className="input-base resize-none" />
          </div>

          <div className="flex gap-2">
            <button onClick={handleSaveDraft} disabled={saving}
              className="flex-1 tap-target rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-medium disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar borrador"}
            </button>
            <button onClick={handleComplete} disabled={completing}
              className="flex-1 tap-target rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50">
              {completing ? "Completando..." : "Completar consulta →"}
            </button>
          </div>
        </div>
      )}

      {step === "complete" && (
        <div className="card p-8 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">Consulta completada</p>
            <p className="text-sm text-gray-500 mt-1">{patientName} · {svcName}</p>
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={() => router.push(`/patients/${encounter.patient_id}`)}
              className="flex-1 tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">
              Ver paciente
            </button>
            <button onClick={() => router.push("/agenda")}
              className="flex-1 tap-target rounded-xl bg-blue-600 text-white text-sm font-semibold">
              Volver a agenda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}