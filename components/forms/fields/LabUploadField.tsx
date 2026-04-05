"use client"
import { useState, useRef } from "react"
import type { LabUpload, LabExtractedValue, LabAlert } from "@/types/domain"
import { cn } from "@/lib/utils"

interface LabUploadFieldProps {
  value?: LabUpload | null
  onChange: (val: LabUpload | null) => void
  formResponseId?: string
  patientId?: string
  disabled?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  normal:   "bg-green-100 text-green-800 border-green-300",
  high:     "bg-red-100 text-red-800 border-red-300",
  low:      "bg-blue-100 text-blue-800 border-blue-300",
  critical: "bg-red-200 text-red-900 border-red-500",
  unknown:  "bg-gray-100 text-gray-600 border-gray-300",
}

const STATUS_LABELS: Record<string, string> = {
  normal: "Normal", high: "Alto", low: "Bajo", critical: "Crítico", unknown: "—"
}

const ALERT_COLORS: Record<string, string> = {
  info:    "bg-blue-50 border-blue-300 text-blue-800",
  warning: "bg-amber-50 border-amber-300 text-amber-800",
  danger:  "bg-red-50 border-red-400 text-red-900",
}

const ALERT_ICONS: Record<string, string> = {
  info: "ℹ️", warning: "⚠️", danger: "🚨"
}

type UploadState = "idle" | "uploading" | "analyzing" | "done" | "error"

export function LabUploadField({
  value, onChange, formResponseId, patientId, disabled
}: LabUploadFieldProps) {
  const [state, setState] = useState<UploadState>(value ? "done" : "idle")
  const [error, setError] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<LabExtractedValue[]>(value?.ai_extracted_values ?? [])
  const [showRawNotes, setShowRawNotes] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file) return
    const allowed = ["application/pdf","image/jpeg","image/png","image/webp"]
    if (!allowed.includes(file.type)) {
      setError("Formato no permitido. Use PDF, JPG, PNG o WEBP.")
      return
    }

    setError(null)
    setState("uploading")

    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("form_response_id", formResponseId ?? "temp")
      fd.append("patient_id", patientId ?? "temp")

      setState("analyzing")
      const res = await fetch("/api/lab-analysis", { method: "POST", body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Error al procesar el laboratorio")
        setState("error")
        return
      }

      setEditingValues(data.analysis.extracted_values ?? [])
      onChange(data.lab_upload)
      setState("done")
    } catch (err) {
      console.error(err)
      setError("Error de conexión. Intente nuevamente.")
      setState("error")
    }
  }

  function updateValue(idx: number, field: keyof LabExtractedValue, val: unknown) {
    const next = editingValues.map((v, i) =>
      i === idx ? { ...v, [field]: val } : v
    )
    setEditingValues(next)
    if (value) onChange({ ...value, ai_extracted_values: next })
  }

  function reset() {
    onChange(null)
    setState("idle")
    setError(null)
    setEditingValues([])
  }

  // Estado IDLE — dropzone
  if (state === "idle" || state === "error") {
    return (
      <div className="flex flex-col gap-3">
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault() }}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f && !disabled) handleFile(f)
          }}
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors",
            disabled ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400 hover:bg-blue-50",
            state === "error" ? "border-red-300 bg-red-50" : "border-gray-300"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Subir laboratorio</p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPG o PNG · Máx 10MB</p>
            <p className="text-xs text-blue-600 mt-2 font-medium">
              ✨ Claude analizará automáticamente los valores
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // Estado CARGANDO / ANALIZANDO
  if (state === "uploading" || state === "analyzing") {
    return (
      <div className="border-2 border-blue-200 rounded-2xl p-8 flex flex-col items-center gap-4 bg-blue-50">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-blue-900">
            {state === "uploading" ? "Subiendo archivo..." : "Claude está analizando el laboratorio..."}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {state === "analyzing" ? "Extrayendo valores y generando pre-análisis clínico" : ""}
          </p>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    )
  }

  // Estado DONE — resultados
  const alerts = (value?.ai_alerts ?? []) as LabAlert[]
  const clinicalNotes = value?.ai_clinical_notes ?? ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{value?.file_name}</p>
            <p className="text-xs text-gray-400">
              {value?.lab_name && `${value.lab_name} · `}
              {editingValues.length} valores extraídos
            </p>
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Cambiar archivo
          </button>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alertas IA</p>
          {alerts.map((alert, i) => (
            <div key={i} className={cn("border rounded-xl px-4 py-3 text-xs font-medium", ALERT_COLORS[alert.severity])}>
              {ALERT_ICONS[alert.severity]} <span className="font-bold">{alert.analyte}:</span> {alert.message}
            </div>
          ))}
        </div>
      )}

      {editingValues.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Valores extraídos — editables
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 text-gray-500 font-medium">Analito</th>
                  <th className="text-left py-2 pr-3 text-gray-500 font-medium">Valor</th>
                  <th className="text-left py-2 pr-3 text-gray-500 font-medium">Unidad</th>
                  <th className="text-left py-2 pr-3 text-gray-500 font-medium">Referencia</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {editingValues.map((v, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{v.name}</td>
                    <td className="py-2 pr-3">
                      {!disabled ? (
                        <input
                          type="text"
                          value={String(v.value ?? "")}
                          onChange={e => updateValue(i, "value", e.target.value)}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs"
                        />
                      ) : (
                        <span className="font-semibold">{String(v.value)}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-500">{v.unit}</td>
                    <td className="py-2 pr-3 text-gray-400">
                      {v.reference_min != null && v.reference_max != null
                        ? `${v.reference_min} – ${v.reference_max}`
                        : "—"}
                    </td>
                    <td className="py-2">
                      {!disabled ? (
                        <select
                          value={v.status}
                          onChange={e => updateValue(i, "status", e.target.value)}
                          className={cn("text-xs px-2 py-1 rounded-lg border font-medium", STATUS_COLORS[v.status])}
                        >
                          {Object.entries(STATUS_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={cn("px-2 py-1 rounded-lg border text-xs font-medium", STATUS_COLORS[v.status])}>
                          {STATUS_LABELS[v.status]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {clinicalNotes && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pre-análisis clínico IA
            </p>
            <button
              type="button"
              onClick={() => setShowRawNotes(!showRawNotes)}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              {showRawNotes ? "Ocultar" : "Ver"}
            </button>
          </div>
          {showRawNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">{clinicalNotes}</p>
              <p className="text-xs text-amber-600 mt-3 font-medium italic">
                ⚠ Pre-análisis generado por IA — sujeto a revisión y criterio clínico profesional
              </p>
            </div>
          )}
        </div>
      )}

      {!value?.approved_at && !disabled && (
        <button
          type="button"
          onClick={() => {
            if (value) onChange({ ...value, approved_at: new Date().toISOString() })
          }}
          className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          ✓ Aprobar análisis IA
        </button>
      )}

      {value?.approved_at && (
        <div className="flex items-center gap-2 text-xs text-green-700 font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Análisis aprobado por el especialista
        </div>
      )}
    </div>
  )
}