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

type Step = "anamnesis" | "select_type" | "fill_form" | "complete"

const SESSION_TYPES = [
  { id: "evaluation", label: "Evaluacion completa", desc: "Primera consulta o reevaluacion", color: "#185FA5", bg: "#E6F1FB", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2 14 8 20 8 M16 13 8 13" },
  { id: "treatment", label: "Sesion de tratamiento", desc: "Aplicar tecnicas y ejercicios", color: "#3B6D11", bg: "#EAF3DE", icon: "M23 4 23 10 17 10 M20.49 15a9 9 0 1 1-2.12-9.36L23 10" },
  { id: "followup", label: "Seguimiento", desc: "Control de evolucion", color: "#854F0B", bg: "#FAEEDA", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { id: "note", label: "Solo nota clinica", desc: "Registrar sin formulario adicional", color: "#534AB7", bg: "#EEEDFE", icon: "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M12 8 12 12 M12 16 12.01 16" },
]

export default function ConsultaPage() {
  const { eid } = useParams<{ eid: string }>()
  const router = useRouter()
  const [encounter, setEncounter] = useState<Encounter | null>(null)
  const [availableForms, setAvailableForms] = useState<FormTemplate[]>([])
  const [anamnesisTemplate, setAnamnesisTemplate] = useState<FormTemplate | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null)
  const [sessionType, setSessionType] = useState("evaluation")
  const [anamnesisAnswers, setAnamnesisAnswers] = useState<Record<string, unknown>>({})
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({})
  const [soapNotes, setSoapNotes] = useState("")
  const [step, setStep] = useState<Step>("anamnesis")
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
    if (enc.status === "completed") { setStep("complete"); setLoading(false); return }

    const appt = enc.appointment as { service?: { id: string; specialty_id?: string } } | undefined
    const serviceId = appt?.service?.id
    const specialtyId = enc.specialty_id

    const [svcForms, existingForms] = await Promise.all([
      serviceId ? getTemplatesForService(serviceId) : Promise.resolve([]),
      getEncounterForms(eid),
    ])
    setAvailableForms(svcForms)

    if (specialtyId) {
      const { data: anamTmpl } = await supabase
        .from("specialty_form_templates")
        .select("*")
        .eq("specialty_id", specialtyId)
        .like("name", "Anamnesis%")
        .single()
      if (anamTmpl) setAnamnesisTemplate(anamTmpl as unknown as FormTemplate)

      const existingAnam = existingForms.find(f =>
        (anamTmpl && f.template_id === anamTmpl.id)
      )
      if (existingAnam) {
        setAnamnesisAnswers(existingAnam.answers ?? {})
        setStep("select_type")
      }
    }
    setLoading(false)
  }, [eid, router])

  useEffect(() => { load() }, [load])

  async function handleSaveAnamnesis() {
    if (!anamnesisTemplate) { setStep("select_type"); return }
    setSaving(true)
    await saveEncounterForm({
      encounter_id: eid,
      template_id: anamnesisTemplate.id,
      form_type: anamnesisTemplate.form_type,
      answers: anamnesisAnswers,
      completed_by: userId,
    })
    setSaving(false)
    setStep("select_type")
  }

  async function handleSelectType() {
    if (sessionType === "note") {
      setStep("fill_form")
      return
    }
    if (availableForms.length === 0) { setStep("fill_form"); return }
    const match = availableForms.find(f => {
      if (sessionType === "evaluation") return f.form_type === "initial" || f.form_type === "evaluation"
      if (sessionType === "followup") return f.form_type === "followup"
      return true
    }) ?? availableForms[0]
    setSelectedTemplate(match)
    setStep("fill_form")
  }

  async function handleComplete() {
    setCompleting(true)
    if (selectedTemplate && sessionType !== "note") {
      await saveEncounterForm({
        encounter_id: eid,
        template_id: selectedTemplate.id,
        form_type: selectedTemplate.form_type,
        answers: formAnswers,
        completed_by: userId,
      })
    }
    const apptId = (encounter?.appointment as { id?: string } | undefined)?.id
    await completeEncounter(eid, apptId, soapNotes)
    setStep("complete")
    setCompleting(false)
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!encounter) return null

  const patientName = (encounter.patient as { full_name: string } | undefined)?.full_name ?? "Paciente"
  const svcName = (encounter.appointment as { service?: { name: string } } | undefined)?.service?.name ?? ""

  const stepLabels: Record<Step, string> = {
    anamnesis: "1 de 2", select_type: "2 de 2", fill_form: "Formulario", complete: "Completada"
  }

  const totalAnamSections = anamnesisTemplate?.fields?.length ?? 0
  const filledAnamSections = anamnesisTemplate?.fields?.filter(sec =>
    sec.fields?.some(f => {
      const v = anamnesisAnswers[`${sec.id}.${f.key}`]
      return v !== undefined && v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
    })
  ).length ?? 0

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => step === "anamnesis" ? router.back() : setStep(step === "fill_form" ? "select_type" : "anamnesis")}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900">{patientName}</p>
          <p className="text-xs text-gray-400">{svcName} · Sesion #{encounter.session_number}</p>
        </div>
        {step !== "complete" && (
          <span className="text-xs font-medium px-3 py-1 rounded-xl bg-blue-100 text-blue-800">
            {stepLabels[step]}
          </span>
        )}
      </div>

      {step !== "complete" && step !== "anamnesis" && (
        <div className="flex gap-1">
          {["anamnesis","select_type","fill_form"].map((s, i) => (
            <div key={s} className={cn("h-1 flex-1 rounded-full transition-all",
              ["anamnesis","select_type","fill_form"].indexOf(step) >= i ? "bg-blue-500" : "bg-gray-200")} />
          ))}
        </div>
      )}

      {step === "anamnesis" && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Anamnesis y motivo de consulta</p>
            <p className="text-xs text-gray-400 mt-0.5">Datos basicos requeridos al inicio de cada sesion</p>
          </div>
          {anamnesisTemplate ? (
            <>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: totalAnamSections > 0 ? `${(filledAnamSections / totalAnamSections) * 100}%` : "0%" }} />
              </div>
              <FormEngine
                sections={anamnesisTemplate.fields ?? []}
                answers={anamnesisAnswers}
                onChange={(key, value) => setAnamnesisAnswers(prev => ({ ...prev, [key]: value }))}
              />
            </>
          ) : (
            <div className="card p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Motivo de consulta</p>
              <textarea
                value={String(anamnesisAnswers["motivo"] ?? "")}
                onChange={e => setAnamnesisAnswers(prev => ({ ...prev, motivo: e.target.value }))}
                rows={4} placeholder="Describa el motivo de la consulta de hoy..."
                className="input-base resize-none" />
            </div>
          )}
          <button onClick={handleSaveAnamnesis} disabled={saving}
            className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? "Guardando..." : "Continuar →"}
          </button>
        </div>
      )}

      {step === "select_type" && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">¿Que se hara en esta sesion?</p>
            <p className="text-xs text-gray-400 mt-0.5">Selecciona el tipo de atencion</p>
          </div>
          <div className="flex flex-col gap-2">
            {SESSION_TYPES.map(type => (
              <button key={type.id} type="button" onClick={() => setSessionType(type.id)}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                  sessionType === type.id ? "border-blue-600" : "border-gray-200 hover:border-gray-300")}
                style={sessionType === type.id ? { borderColor: type.color, background: type.bg } : {}}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: type.bg }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke={type.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {type.id === "evaluation" && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></>}
                    {type.id === "treatment" && <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>}
                    {type.id === "followup" && <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>}
                    {type.id === "note" && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: sessionType === type.id ? type.color : "" }}>
                    {type.label}
                  </p>
                  <p className="text-xs text-gray-400">{type.desc}</p>
                </div>
                {sessionType === type.id && (
                  <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={type.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
          {availableForms.length > 0 && sessionType !== "note" && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 font-medium mb-2">Formularios disponibles para este servicio</p>
              <div className="flex flex-wrap gap-2">
                {availableForms.map(f => (
                  <span key={f.id} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg">
                    {f.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleSelectType}
            className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold">
            Iniciar sesion →
          </button>
        </div>
      )}

      {step === "fill_form" && (
        <div className="flex flex-col gap-4">
          {sessionType === "note" ? (
            <div className="card p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nota clinica</p>
              <textarea value={soapNotes} onChange={e => setSoapNotes(e.target.value)}
                rows={6} placeholder="Subjetivo, objetivo, analisis, plan de tratamiento..."
                className="input-base resize-none" />
            </div>
          ) : selectedTemplate ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{selectedTemplate.name}</p>
                {availableForms.length > 1 && (
                  <button onClick={() => setStep("select_type")} className="text-xs text-blue-600 font-medium">
                    Cambiar
                  </button>
                )}
              </div>
              <FormEngine
                sections={selectedTemplate.fields ?? []}
                answers={formAnswers}
                onChange={(key, value) => setFormAnswers(prev => ({ ...prev, [key]: value }))}
              />
              <div className="card p-4 flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Notas de cierre (SOAP)
                </label>
                <textarea value={soapNotes} onChange={e => setSoapNotes(e.target.value)}
                  rows={3} placeholder="Subjetivo, objetivo, analisis, plan..."
                  className="input-base resize-none" />
              </div>
            </>
          ) : (
            <div className="card p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {SESSION_TYPES.find(t => t.id === sessionType)?.label}
              </p>
              <textarea value={soapNotes} onChange={e => setSoapNotes(e.target.value)}
                rows={6} placeholder="Registra los detalles de la sesion..."
                className="input-base resize-none" />
            </div>
          )}
          <button onClick={handleComplete} disabled={completing}
            className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50">
            {completing ? "Completando..." : "Completar consulta →"}
          </button>
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