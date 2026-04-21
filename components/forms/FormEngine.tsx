"use client"
import { useState, useCallback, useEffect } from "react"
import type { FormTemplateConfig, FormSectionConfig } from "@/types/domain"
import { SectionRenderer } from "./SectionRenderer"
import { computeScore } from "./form-utils"
import { cn } from "@/lib/utils"

interface FormEngineProps {
  template: FormTemplateConfig
  initialAnswers?: Record<string, unknown>
  onSave?: (answers: Record<string, unknown>, scores: Record<string, number>) => Promise<void>
  onComplete?: (answers: Record<string, unknown>, scores: Record<string, number>) => Promise<void>
  disabled?: boolean
  showCompleteButton?: boolean
}

export function FormEngine({
  template, initialAnswers = {}, onSave, onComplete, disabled, showCompleteButton = true
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

  const setAnswer = useCallback((key: string, val: unknown) => {
    setAnswers(prev => ({ ...prev, [key]: val }))
  }, [])

  function isSectionComplete(section: FormSectionConfig): boolean {
    const required = section.fields.filter(f => f.required)
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
        <SectionRenderer
          key={section.id}
          section={section}
          answers={answers}
          onChange={setAnswer}
          isOpen={openSection === section.id}
          onToggle={() => setOpenSection(openSection === section.id ? "" : section.id)}
          isCompleted={isSectionComplete(section)}
          disabled={disabled}
        />
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