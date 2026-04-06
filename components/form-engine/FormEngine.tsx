"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { FormSection, FormField } from "@/lib/services/form-templates"

interface Props {
  sections: FormSection[]
  answers: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  readonly?: boolean
}

function ScaleField({ field, value, onChange, readonly }: { field: FormField; value: unknown; onChange: (v: number) => void; readonly?: boolean }) {
  const val = typeof value === "number" ? value : -1
  const getColor = (n: number) => {
    if (n <= 3) return "bg-green-500 text-white border-green-500"
    if (n <= 6) return "bg-amber-500 text-white border-amber-500"
    return "bg-red-500 text-white border-red-500"
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 flex-wrap">
        {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} type="button" disabled={readonly} onClick={() => onChange(n)}
            className={cn("w-9 h-9 rounded-lg text-xs font-bold border-2 transition-all",
              val === n ? getColor(n) : "border-gray-200 text-gray-600 hover:border-gray-400")}>
            {n}
          </button>
        ))}
      </div>
      {field.help_text && <p className="text-xs text-gray-400">{field.help_text}</p>}
    </div>
  )
}

function BodyMapField({ value, onChange, readonly }: { value: unknown; onChange: (v: unknown) => void; readonly?: boolean }) {
  const selected = Array.isArray(value) ? value as string[] : []
  const REGIONS = [
    { id: "head", label: "Cabeza", x: 50, y: 4, w: 14 },
    { id: "neck", label: "Cuello", x: 50, y: 13, w: 10 },
    { id: "shoulder_r", label: "Hombro D", x: 30, y: 20, w: 13 },
    { id: "shoulder_l", label: "Hombro I", x: 70, y: 20, w: 13 },
    { id: "chest", label: "Torax", x: 50, y: 22, w: 18 },
    { id: "arm_r", label: "Brazo D", x: 22, y: 30, w: 11 },
    { id: "arm_l", label: "Brazo I", x: 78, y: 30, w: 11 },
    { id: "abdomen", label: "Abdomen", x: 50, y: 33, w: 18 },
    { id: "forearm_r", label: "Antebrazo D", x: 18, y: 42, w: 12 },
    { id: "forearm_l", label: "Antebrazo I", x: 82, y: 42, w: 12 },
    { id: "lumbar", label: "Lumbar", x: 50, y: 43, w: 18 },
    { id: "hand_r", label: "Mano D", x: 14, y: 52, w: 10 },
    { id: "hand_l", label: "Mano I", x: 86, y: 52, w: 10 },
    { id: "hip_r", label: "Cadera D", x: 36, y: 53, w: 13 },
    { id: "hip_l", label: "Cadera I", x: 64, y: 53, w: 13 },
    { id: "thigh_r", label: "Muslo D", x: 36, y: 63, w: 13 },
    { id: "thigh_l", label: "Muslo I", x: 64, y: 63, w: 13 },
    { id: "knee_r", label: "Rodilla D", x: 36, y: 73, w: 13 },
    { id: "knee_l", label: "Rodilla I", x: 64, y: 73, w: 13 },
    { id: "leg_r", label: "Pierna D", x: 36, y: 82, w: 13 },
    { id: "leg_l", label: "Pierna I", x: 64, y: 82, w: 13 },
    { id: "foot_r", label: "Pie D", x: 36, y: 92, w: 13 },
    { id: "foot_l", label: "Pie I", x: 64, y: 92, w: 13 },
  ]
  function toggle(id: string) {
    if (readonly) return
    const next = selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative bg-gray-50 rounded-xl border border-gray-200 overflow-hidden" style={{ paddingTop: "110%" }}>
        <div className="absolute inset-0 p-2">
          {REGIONS.map(r => (
            <button key={r.id} type="button" disabled={readonly} onClick={() => toggle(r.id)}
              className={cn("absolute rounded-md border text-[7px] font-medium transition-all flex items-center justify-center leading-tight text-center",
                selected.includes(r.id)
                  ? "bg-red-400 border-red-500 text-white"
                  : "bg-white border-gray-300 text-gray-500 hover:border-red-300 hover:bg-red-50")}
              style={{ left: `${r.x - r.w/2}%`, top: `${r.y}%`, width: `${r.w}%`, height: "6%" }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const r = REGIONS.find(reg => reg.id === id)
            return (
              <span key={id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-lg">
                {r?.label ?? id}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RenderField({ field, value, onChange, readonly }: {
  field: FormField; value: unknown; onChange: (v: unknown) => void; readonly?: boolean
}) {
  const str = typeof value === "string" ? value : ""
  const arr = Array.isArray(value) ? value as string[] : []

  switch (field.type) {
    case "text":
      return <input value={str} onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder} disabled={readonly} className="input-base" />
    case "textarea":
      return <textarea value={str} onChange={e => onChange(e.target.value)}
        rows={field.rows ?? 3} placeholder={field.placeholder}
        disabled={readonly} className="input-base resize-none" />
    case "select":
      return (
        <select value={str} onChange={e => onChange(e.target.value)} disabled={readonly} className="input-base">
          <option value="">Seleccionar...</option>
          {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    case "radio":
      return (
        <div className="flex flex-col gap-2">
          {field.options?.map(o => (
            <button key={o.value} type="button" disabled={readonly} onClick={() => onChange(o.value)}
              className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                str === o.value ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
              <div className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0",
                str === o.value ? "bg-blue-600 border-blue-600" : "border-gray-400")} />
              <span className={cn("text-sm", str === o.value ? "text-blue-900 font-medium" : "text-gray-700")}>{o.label}</span>
            </button>
          ))}
        </div>
      )
    case "multiselect":
      return (
        <div className="flex flex-col gap-2">
          {field.options?.map(o => {
            const sel = arr.includes(o.value)
            return (
              <button key={o.value} type="button" disabled={readonly}
                onClick={() => onChange(sel ? arr.filter(v => v !== o.value) : [...arr, o.value])}
                className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                  sel ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                  sel ? "bg-blue-600 border-blue-600" : "border-gray-400")}>
                  {sel && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span className={cn("text-sm", sel ? "text-blue-900 font-medium" : "text-gray-700")}>{o.label}</span>
              </button>
            )
          })}
        </div>
      )
    case "switch":
      return (
        <button type="button" disabled={readonly} onClick={() => onChange(!value)}
          className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
            value ? "bg-blue-600" : "bg-gray-200")}>
          <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            value ? "translate-x-5" : "translate-x-1")} />
        </button>
      )
    case "scale_0_10":
      return <ScaleField field={field} value={value} onChange={v => onChange(v)} readonly={readonly} />
    case "body_map":
      return <BodyMapField value={value} onChange={onChange} readonly={readonly} />
    case "range_of_motion":
      return (
        <div className="flex items-center gap-3">
          <input type="number" value={str} onChange={e => onChange(e.target.value)}
            min="0" max="360" placeholder="0" disabled={readonly} className="input-base w-24" />
          <span className="text-sm text-gray-500">{(field as { unit?: string }).unit ?? "°"}</span>
        </div>
      )
    default:
      return <input value={str} onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder} disabled={readonly} className="input-base" />
  }
}

export default function FormEngine({ sections, answers, onChange, readonly }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(sections.map(s => s.id)))

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, idx) => {
        const isOpen = openSections.has(section.id)
        const filledCount = section.fields?.filter(f => {
          const v = answers[`${section.id}.${f.key}`]
          return v !== undefined && v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
        }).length ?? 0
        const totalF = section.fields?.length ?? 0
        const allFilled = filledCount === totalF && totalF > 0
        return (
          <div key={section.id} className="card overflow-hidden">
            <button onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 text-left">
              <div className="flex items-center gap-3">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold",
                  allFilled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                  {allFilled ? "✓" : idx + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{section.title}</p>
                  <p className="text-xs text-gray-400">{filledCount}/{totalF} campos</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={cn("transition-transform flex-shrink-0", isOpen ? "rotate-180" : "")}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 px-4 pb-4 flex flex-col gap-4 pt-3">
                {section.description && <p className="text-xs text-gray-500 italic">{section.description}</p>}
                {section.fields?.map(field => {
                  const fieldKey = `${section.id}.${field.key}`
                  return (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-700">{field.label}</label>
                        {field.required && <span className="text-[10px] text-red-500 font-bold">*</span>}
                      </div>
                      {field.help_text && field.type !== "scale_0_10" && (
                        <p className="text-[10px] text-gray-400">{field.help_text}</p>
                      )}
                      <RenderField field={field} value={answers[fieldKey]}
                        onChange={v => onChange(fieldKey, v)} readonly={readonly} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}