"use client"
import type { FormFieldConfig, BodyMapMarker } from "@/types/domain"
import { PosturalAssessmentField } from "./fields/PosturalAssessmentField"
import { PalpationField } from "./fields/PalpationField"
import { evaluateConditions, evaluateClinicalAlert } from "./form-utils"
import { Scale0To10 } from "./fields/Scale0To10"
import { RepeatingGroup } from "./fields/RepeatingGroup"
import { ScoredTestField } from "./fields/ScoredTestField"
import { BodyMapField } from "./fields/BodyMapField"
import { LabUploadField } from "./fields/LabUploadField"
import { cn } from "@/lib/utils"

interface FieldRendererProps {
  field: FormFieldConfig
  value: unknown
  onChange: (val: unknown) => void
  allAnswers: Record<string, unknown>
  disabled?: boolean
}

export function FieldRenderer({ field, value, onChange, allAnswers, disabled }: FieldRendererProps) {
  const visible = evaluateConditions(field.visibility_conditions, allAnswers)
  if (!visible) return null

  const showAlert = field.clinical_alert
    ? evaluateClinicalAlert(field.clinical_alert.condition, value)
    : false

  const alertColors = {
    info:    "bg-blue-50 border-blue-300 text-blue-800",
    warning: "bg-amber-50 border-amber-300 text-amber-800",
    danger:  "bg-red-50 border-red-300 text-red-800",
  }

  return (
    <div className="flex flex-col gap-1.5">
      {field.type !== "section_header" && field.type !== "divider" && field.type !== "info_text" && (
        <div className="flex items-baseline gap-1">
          <label className="text-sm font-medium text-gray-700">{field.label}</label>
          {field.required && <span className="text-red-500 text-sm">*</span>}
          {field.unit && <span className="text-xs text-gray-400">({field.unit})</span>}
        </div>
      )}

      {field.help_text && (
        <p className="text-xs text-gray-400 -mt-1">{field.help_text}</p>
      )}

      <FieldInput field={field} value={value} onChange={onChange} allAnswers={allAnswers} disabled={disabled} />

      {showAlert && field.clinical_alert && (
        <div className={cn("border rounded-lg px-3 py-2 text-xs font-medium mt-1", alertColors[field.clinical_alert.severity])}>
          {field.clinical_alert.severity === "danger" ? "🚨" : field.clinical_alert.severity === "warning" ? "⚠️" : "ℹ️"}{" "}
          {field.clinical_alert.message}
        </div>
      )}
    </div>
  )
}

function FieldInput({ field, value, onChange, allAnswers, disabled }: FieldRendererProps) {
  const base = "input-base disabled:opacity-60 disabled:cursor-not-allowed"

  switch (field.type) {
    case "text":
    case "phone":
      return (
        <input
          type={field.type === "phone" ? "tel" : "text"}
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={base}
          inputMode={field.type === "phone" ? "tel" : "text"}
        />
      )

    case "textarea":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={field.rows ?? 3}
          className={cn(base, "resize-none")}
        />
      )

    case "number":
    case "decimal":
      return (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={e => onChange(field.type === "decimal" ? parseFloat(e.target.value) : parseInt(e.target.value))}
          placeholder={field.placeholder}
          disabled={disabled}
          min={field.min}
          max={field.max}
          step={field.type === "decimal" ? "0.1" : "1"}
          className={base}
          inputMode="decimal"
        />
      )

    case "date":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={base}
        />
      )

    case "select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={base}
        >
          <option value="">{field.placeholder ?? "Seleccionar..."}</option>
          {(field.options ?? []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )

    case "multiselect": {
      const selected = (value as string[]) ?? []
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map(opt => {
            const active = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (active) onChange(selected.filter(v => v !== opt.value))
                  else onChange([...selected, opt.value])
                }}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all min-h-[44px]",
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )
    }

    case "radio": {
      const opts = field.options ?? []
      return (
        <div className={cn("flex gap-2", opts.length > 3 ? "flex-col" : "flex-wrap")}>
          {opts.map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all min-h-[44px] flex-1",
                value === opt.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )
    }

    case "switch":
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!value)}
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
            value ? "bg-blue-600" : "bg-gray-200"
          )}
        >
          <span className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            value ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      )

    case "scale_0_10":
    case "vas_pain":
      return (
        <Scale0To10
          value={value as number}
          onChange={onChange}
          disabled={disabled}
        />
      )

    case "body_map":
      return (
        <BodyMapField
          value={value as BodyMapMarker[]}
          onChange={onChange}
          disabled={disabled}
        />
      )

    case "lab_upload":
      return (
        <LabUploadField
          value={value as import("@/types/domain").LabUpload}
          onChange={onChange}
          formResponseId={field.config?.form_response_id as string}
          patientId={field.config?.patient_id as string}
          disabled={disabled}
        />
      )

    case "scored_test":
      if (!field.test_key) return <p className="text-xs text-red-500">test_key requerido</p>
      return (
        <ScoredTestField
          testKey={field.test_key}
          value={value as Record<string, number>}
          onChange={onChange}
          disabled={disabled}
        />
      )

    case "repeating_group":
      return (
        <RepeatingGroup
          field={field}
          value={(value as Record<string, unknown>[]) ?? []}
          onChange={onChange}
          allAnswers={allAnswers}
          disabled={disabled}
        />
      )

    case "section_header":
      return (
        <div className="pt-2 pb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{field.label}</p>
        </div>
      )

    case "divider":
      return <hr className="border-gray-200 my-1" />

    case "info_text":
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-800">{field.label}</p>
        </div>
      )

    case "measurement":
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={(value as number) ?? ""}
            onChange={e => onChange(parseFloat(e.target.value))}
            disabled={disabled}
            min={field.min}
            max={field.max}
            step="0.1"
            className={cn(base, "flex-1")}
            inputMode="decimal"
            placeholder="0"
          />
          {field.unit && (
            <span className="text-sm text-gray-500 font-medium w-10">{field.unit}</span>
          )}
        </div>
      )

    case "lab_upload":
      return (
        <LabUploadField
          value={value as import("@/types/domain").LabUpload}
          onChange={onChange}
          formResponseId={field.config?.form_response_id as string}
          patientId={field.config?.patient_id as string}
          disabled={disabled}
        />
      )

    case "range_of_motion":
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={(value as number) ?? ""}
            onChange={e => onChange(parseInt(e.target.value))}
            disabled={disabled}
            min={field.min ?? 0}
            max={field.max ?? 360}
            step="1"
            className={cn(base, "flex-1")}
            inputMode="numeric"
            placeholder="0"
          />
          <span className="text-sm text-gray-500 font-medium">°</span>
        </div>
      )

    case "postural_assessment":
      return (
        <PosturalAssessmentField
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case "palpation":
      return (
        <PalpationField
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={base}
        />
      )
  }
}
