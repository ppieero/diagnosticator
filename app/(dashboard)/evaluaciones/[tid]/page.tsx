"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getTemplate } from "@/lib/services/form-templates"
import type { FormTemplate, FormSection } from "@/lib/services/form-templates"
import { cn } from "@/lib/utils"

const FIELD_TYPE_LABELS: Record<string, string> = {
  textarea: "Texto largo", select: "Seleccion unica", multiselect: "Seleccion multiple",
  scale_0_10: "Escala 0-10", body_map: "Mapa corporal", repeating_group: "Grupo repetible",
  radio: "Radio", switch: "Interruptor", text: "Texto corto", range_of_motion: "Rango de movimiento",
}

export default function EvaluacionDetailPage() {
  const { tid } = useParams<{ tid: string }>()
  const router = useRouter()
  const [tmpl, setTmpl] = useState<FormTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    getTemplate(tid).then(data => {
      if (!data) router.push("/evaluaciones")
      setTmpl(data)
      if (data?.fields?.[0]) setOpenSections(new Set([data.fields[0].id]))
      setLoading(false)
    })
  }, [tid, router])

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!tmpl) return null

  const sp = tmpl.specialty as { name: string; color: string } | undefined
  const totalFields = (tmpl.fields ?? []).reduce((s, sec) => s + (sec.fields?.length ?? 0), 0)

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
          <p className="text-base font-semibold text-gray-900 truncate">{tmpl.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {sp && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                style={{ background: sp.color + "22", color: sp.color }}>
                {sp.name}
              </span>
            )}
            <span className="text-xs text-gray-400">{(tmpl.fields ?? []).length} secciones · {totalFields} campos</span>
            {tmpl.estimated_minutes && (
              <span className="text-xs text-gray-400">~{tmpl.estimated_minutes} min</span>
            )}
          </div>
        </div>
      </div>

      {tmpl.description && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-600">{tmpl.description}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(tmpl.fields ?? []).map((section: FormSection, idx: number) => {
          const isOpen = openSections.has(section.id)
          const reqFields = section.fields?.filter(f => f.required).length ?? 0
          return (
            <div key={section.id} className="card overflow-hidden">
              <button onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-500">{idx + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{section.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {section.fields?.length ?? 0} campos
                      {reqFields > 0 && ` · ${reqFields} obligatorios`}
                      {section.required && " · seccion obligatoria"}
                    </p>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={cn("transition-transform flex-shrink-0", isOpen ? "rotate-180" : "")}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 pb-4 flex flex-col gap-2 pt-3">
                  {section.description && (
                    <p className="text-xs text-gray-500 italic mb-1">{section.description}</p>
                  )}
                  {(section.fields ?? []).map(field => (
                    <div key={field.key}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-gray-800">{field.label}</p>
                          {field.required && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                              requerido
                            </span>
                          )}
                          {field.audit_required && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                              auditoria
                            </span>
                          )}
                        </div>
                        {field.help_text && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{field.help_text}</p>
                        )}
                        {field.options && field.options.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {field.options.slice(0, 4).map(o => o.label).join(" · ")}
                            {field.options.length > 4 && ` +${field.options.length - 4} mas`}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                        {FIELD_TYPE_LABELS[field.type] ?? field.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Servicios que usan este template</p>
        <p className="text-xs text-gray-400">
          Para asignar este formulario a un servicio, ve al modulo de Servicios y edita el servicio correspondiente.
        </p>
        <button onClick={() => router.push("/servicios")}
          className="mt-3 text-xs text-blue-600 font-medium">
          Ir a Servicios →
        </button>
      </div>
    </div>
  )
}