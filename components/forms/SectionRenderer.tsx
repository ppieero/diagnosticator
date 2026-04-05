"use client"
import { useState } from "react"
import type { FormSectionConfig } from "@/types/domain"
import { FieldRenderer } from "./FieldRenderer"
import { cn } from "@/lib/utils"

interface SectionRendererProps {
  section: FormSectionConfig
  answers: Record<string, unknown>
  onChange: (key: string, val: unknown) => void
  isOpen: boolean
  onToggle: () => void
  isCompleted: boolean
  disabled?: boolean
}

export function SectionRenderer({
  section, answers, onChange, isOpen, onToggle, isCompleted, disabled
}: SectionRendererProps) {
  const requiredFields = section.fields.filter(f => f.required)
  const answeredRequired = requiredFields.filter(f => {
    const v = answers[f.key]
    return v !== undefined && v !== null && v !== "" &&
      !(Array.isArray(v) && v.length === 0)
  })
  const progress = requiredFields.length > 0
    ? Math.round((answeredRequired.length / requiredFields.length) * 100)
    : 100

  return (
    <div className={cn(
      "border rounded-2xl overflow-hidden transition-all",
      isOpen ? "border-blue-300 shadow-sm" : "border-gray-200"
    )}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-4 text-left transition-colors",
          isOpen ? "bg-blue-50" : "bg-white hover:bg-gray-50"
        )}
      >
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
          isCompleted
            ? "bg-green-500 text-white"
            : isOpen
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-500"
        )}>
          {isCompleted ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : section.order}
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-semibold",
            isOpen ? "text-blue-900" : "text-gray-800"
          )}>{section.title}</p>
          {section.description && !isOpen && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{section.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {!isCompleted && requiredFields.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{progress}%</span>
            </div>
          )}
          {section.required && !isCompleted && (
            <span className="text-xs text-amber-600 font-medium">requerida</span>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={cn("transition-transform text-gray-400", isOpen ? "rotate-180" : "")}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 py-5 flex flex-col gap-5 bg-white">
          {section.description && (
            <p className="text-xs text-gray-500 -mt-2">{section.description}</p>
          )}
          {section.fields.map(field => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={answers[field.key]}
              onChange={val => onChange(field.key, val)}
              allAnswers={answers}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}