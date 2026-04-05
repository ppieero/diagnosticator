"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  getEvaluation, getFormResponse,
  getTemplateBySpecialtyAndType,
  saveFormResponse, completeEvaluation,
} from "@/lib/services/evaluations"
import { FormEngine } from "@/components/forms/FormEngine"
import type { Evaluation, FormTemplateConfig } from "@/types/domain"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

export default function EvaluationPage() {
  const { id, eid } = useParams<{ id: string; eid: string }>()
  const router = useRouter()
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [template, setTemplate] = useState<FormTemplateConfig | null>(null)
  const [initialAnswers, setInitialAnswers] = useState<Record<string, unknown>>({})
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const ev = await getEvaluation(eid)
      if (!ev) { setLoading(false); return }
      setEvaluation(ev)

      if (ev.specialty_id) {
        const tmpl = await getTemplateBySpecialtyAndType(
          ev.specialty_id,
          (ev.encounter_type as "initial" | "session" | "followup") ?? "initial"
        )
        if (tmpl) {
          setTemplate(tmpl)
          setTemplateId(tmpl.id)
          const saved = await getFormResponse(eid, tmpl.id)
          if (saved?.answers) setInitialAnswers(saved.answers as Record<string, unknown>)
        }
      }
      setLoading(false)
    }
    load()
  }, [eid])

  async function handleSave(answers: Record<string, unknown>, scores: Record<string, number>) {
    if (!templateId || !template) return
    await saveFormResponse({
      template_id: templateId,
      template_version: template.version,
      encounter_id: eid,
      patient_id: id,
      professional_id: userId,
      answers,
      computed_scores: scores,
      body_map_data: (answers.body_map as unknown[]) ?? [],
      status: "in_progress",
    })
  }

  async function handleComplete(answers: Record<string, unknown>, scores: Record<string, number>) {
    if (!templateId || !template) return
    await saveFormResponse({
      template_id: templateId,
      template_version: template.version,
      encounter_id: eid,
      patient_id: id,
      professional_id: userId,
      answers,
      computed_scores: scores,
      body_map_data: (answers.body_map as unknown[]) ?? [],
      status: "completed",
    })
    await completeEvaluation(eid)
    router.push(`/patients/${id}`)
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  if (!evaluation) return (
    <div className="px-4 py-8 text-center text-gray-500">Consulta no encontrada</div>
  )

  const isCompleted = evaluation.status === "completed"

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/patients/${id}`)}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">
            {evaluation.encounter_type === "initial" ? "Evaluación inicial"
              : evaluation.encounter_type === "session" ? "Sesión de seguimiento"
              : "Control"}
          </h2>
          <p className="text-xs text-gray-400">{formatDate(evaluation.started_at)}</p>
        </div>
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded-lg",
          isCompleted ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
        )}>
          {isCompleted ? "Completada" : "En progreso"}
        </span>
      </div>

      {!template && (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500">No hay formulario configurado para esta consulta.</p>
          {evaluation.notes && (
            <p className="text-xs text-gray-400 mt-2">{evaluation.notes}</p>
          )}
        </div>
      )}

      {template && (
        <FormEngine
          template={template}
          initialAnswers={initialAnswers}
          onSave={isCompleted ? undefined : handleSave}
          onComplete={isCompleted ? undefined : handleComplete}
          disabled={isCompleted}
          showCompleteButton={!isCompleted}
        />
      )}
    </div>
  )
}