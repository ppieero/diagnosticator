"use client"
import { useState } from "react"
import type { FormFieldConfig } from "@/types/domain"
import { FieldRenderer } from "../FieldRenderer"

interface RepeatingGroupProps {
  field: FormFieldConfig
  value: Record<string, unknown>[]
  onChange: (val: Record<string, unknown>[]) => void
  allAnswers: Record<string, unknown>
  disabled?: boolean
}

export function RepeatingGroup({ field, value = [], onChange, allAnswers, disabled }: RepeatingGroupProps) {
  const items = value.length > 0 ? value : []
  const minItems = field.min_items ?? 0

  function addItem() {
    if (field.max_items && items.length >= field.max_items) return
    onChange([...items, {}])
  }

  function removeItem(idx: number) {
    if (items.length <= minItems) return
    onChange(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, key: string, val: unknown) {
    const next = items.map((item, i) =>
      i === idx ? { ...item, [key]: val } : item
    )
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => (
        <div key={idx} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {field.item_label ?? "Ítem"} {idx + 1}
            </span>
            {items.length > minItems && !disabled && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Eliminar
              </button>
            )}
          </div>
          {(field.fields ?? []).map((subField) => (
            <FieldRenderer
              key={subField.key}
              field={subField}
              value={item[subField.key]}
              onChange={(val) => updateItem(idx, subField.key, val)}
              allAnswers={{ ...allAnswers, ...item }}
              disabled={disabled}
            />
          ))}
        </div>
      ))}
      {(!field.max_items || items.length < field.max_items) && !disabled && (
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {field.add_label ?? "Añadir"}
        </button>
      )}
    </div>
  )
}