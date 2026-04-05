"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  createEvaluation,
  getTemplateBySpecialtyAndType,
  saveFormResponse,
  completeEvaluation,
} from "@/lib/services/evaluations"
import { FormEngine } from "@/components/forms/FormEngine"
import type { Patient, Specialty, FormTemplateConfig } from "@/types/domain"
import { cn } from "@/lib/utils"

const ENCOUNTER_TYPES = [
  { value: "initial",  label: "Evaluación inicial", icon: "📋", desc: "Primera consulta del paciente" },
  { value: "session",  label: "Sesión de seguimiento", icon: "🔄", desc: "Sesión de tratamiento" },
  { value: "followup", label: "Control", icon: "📌", desc: "Control de evolución" },
]

type Step = "select" | "form"

export default function NewEvaluationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("")
  const [selectedType, setSelectedType] = useState<"initial" | "session" | "followup">("initial")
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [step, setStep] = useState<Step>("select")
  const [template, setTemplate] = useState<FormTemplateConfig | null>(null)
  const [encounterId, setEncounterId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data: p } = await supabase.from("patients").select("*").eq("id", id).single()
      setPatient(p as Patient)
      const { data: specs } = await supabase.from("specialties").select("*").eq("is_active", true)
      setSpecialties((specs ?? []) as Specialty[])
      if (specs?.[0]) setSelectedSpecialty(specs[0].id)
    }
    load()
  }, [id])

  async function handleStart() {
    if (!selectedSpecialty) return
    setLoading(true)
    setError(null)
    try {
      const tmpl = await getTemplateBySpecialtyAndType(selectedSpecialty, selectedType)
      if (!tmpl) {
        setError("No hay formulario configurado para esta especialidad y tipo de consulta.")
        setLoading(false)
        return
      }
      const ev = await createEvaluation({
        patient_id: id,
        specialty_id: selectedSpecialty,
        professional_id: userId,
        encounter_type: selectedType,
        evaluation_type_id: `${selectedType}_${selectedSpecialty}`,
        chief_complaint: chiefComplaint || undefined,
      })
      setEncounterId(ev.id)
      setTemplateId(tmpl.id)
      setTemplate(tmpl)
      setStep("form")
    } catch (err) {
      console.error(err)
      setError("Error al crear la consulta. Intente nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(answers: Record<string, unknown>, scores: Record<string, number>) {
    if (!encounterId || !templateId) return
    await saveFormResponse({
      template_id: templateId,
      template_version: template?.version ?? 1,
      encounter_id: encounterId,
      patient_id: id,
      professional_id: userId,
      answers,
      computed_scores: scores,
      body_map_data: (answers.body_map as unknown[]) ?? [],
      status: "in_progress",
    })
  }

  async function handleComplete(answers: Record<string, unknown>, scores: Record<string, number>) {
    if (!encounterId || !templateId) return
    await saveFormResponse({
      template_id: templateId,
      template_version: template?.version ?? 1,
      encounter_id: encounterId,
      patient_id: id,
      professional_id: userId,
      answers,
      computed_scores: scores,
      body_map_data: (answers.body_map as unknown[]) ?? [],
      status: "completed",
    })
    await completeEvaluation(encounterId)
    router.push(`/patients/${id}`)
  }

  if (step === "form" && template) {
    return (
      <div className="px-4 py-5 fade-up flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep("select")}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{template.name}</h2>
            <p className="text-xs text-gray-400">{patient?.full_name}</p>
          </div>
        </div>
        <FormEngine
          template={template}
          onSave={handleSave}
          onComplete={handleComplete}
        />
      </div>
    )
  }

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Nueva consulta</h2>
        <p className="text-sm text-gray-500 mt-0.5">{patient?.full_name}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Especialidad</label>
        <div className="flex flex-col gap-2">
          {specialties.map(sp => (
            <button
              key={sp.id}
              type="button"
              onClick={() => setSelectedSpecialty(sp.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                selectedSpecialty === sp.id
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: sp.color }} />
              <span className={cn(
                "text-sm font-medium",
                selectedSpecialty === sp.id ? "text-blue-900" : "text-gray-700"
              )}>{sp.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Tipo de consulta</label>
        <div className="flex flex-col gap-2">
          {ENCOUNTER_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setSelectedType(t.value as "initial" | "session" | "followup")}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                selectedType === t.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-lg">{t.icon}</span>
              <div>
                <p className={cn(
                  "text-sm font-medium",
                  selectedType === t.value ? "text-blue-900" : "text-gray-700"
                )}>{t.label}</p>
                <p className="text-xs text-gray-400">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Motivo de consulta (opcional)</label>
        <textarea
          value={chiefComplaint}
          onChange={e => setChiefComplaint(e.target.value)}
          placeholder="Breve descripción del motivo..."
          rows={3}
          className="input-base resize-none"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading || !selectedSpecialty}
        className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Iniciando consulta..." : "Iniciar consulta →"}
      </button>
    </div>
  )
}