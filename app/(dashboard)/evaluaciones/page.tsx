"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getTemplates } from "@/lib/services/form-templates"
import type { FormTemplate } from "@/lib/services/form-templates"
import { cn } from "@/lib/utils"

const FORM_TYPE_LABELS: Record<string, string> = {
  initial: "Evaluacion inicial",
  followup: "Seguimiento",
  discharge: "Alta",
  screening: "Screening",
}

const FIELD_TYPE_ICONS: Record<string, string> = {
  textarea: "📝", select: "▾", multiselect: "☑", scale_0_10: "📊",
  body_map: "🫀", repeating_group: "↕", radio: "◎", switch: "⇌",
  postural_assessment: "⊞", palpation: "✋",
  vasomotor: "🌡", symptom_scale: "📊", hormonal_meds: "💊", lab_upload: "🧪",
  decimal: "0.0", number: "123", date: "📅", section_header: "—", info_text: "ℹ",
  text: "T", range_of_motion: "⟳",
}

export default function EvaluacionesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSpecialty, setFilterSpecialty] = useState("")
  const [specialties, setSpecialties] = useState<{ id: string; name: string; color: string }[]>([])

  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [tRes, spRes] = await Promise.all([
        getTemplates(),
        supabase.from("specialties").select("id, name, color").eq("is_active", true),
      ])
      setTemplates(tRes)
      setSpecialties(spRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filterSpecialty
    ? templates.filter(t => t.specialty_id === filterSpecialty)
    : templates

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Evaluaciones</h2>
          <p className="text-xs text-gray-400 mt-0.5">{templates.length} formularios configurados</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
        <p className="text-xs text-blue-800 font-medium">
          Los formularios de evaluacion se asignan a los servicios. Al iniciar una consulta,
          el profesional podra seleccionar que evaluacion aplicar.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterSpecialty("")}
          className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
            !filterSpecialty ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500")}>
          Todos
        </button>
        {specialties.map(sp => (
          <button key={sp.id} onClick={() => setFilterSpecialty(filterSpecialty === sp.id ? "" : sp.id)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
              filterSpecialty === sp.id ? "text-white border-transparent" : "border-gray-200 text-gray-500")}
            style={filterSpecialty === sp.id ? { background: sp.color, borderColor: sp.color } : {}}>
            {sp.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map(tmpl => {
          const sp = tmpl.specialty as { name: string; color: string } | undefined
          const totalFields = (tmpl.fields ?? []).reduce((s, sec) => s + (sec.fields?.length ?? 0), 0)
          const sections = tmpl.fields ?? []
          return (
            <button key={tmpl.id} onClick={() => router.push(`/evaluaciones/${tmpl.id}`)}
              className="card p-4 text-left hover:shadow-md transition-shadow w-full">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: sp?.color ? sp.color + "22" : "#f3f4f6" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke={sp?.color ?? "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{tmpl.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {sp && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                          style={{ background: sp.color + "22", color: sp.color }}>
                          {sp.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {FORM_TYPE_LABELS[tmpl.form_type] ?? tmpl.form_type}
                      </span>
                      {tmpl.estimated_minutes && (
                        <span className="text-xs text-gray-400">~{tmpl.estimated_minutes} min</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-700">{sections.length} secciones</p>
                  <p className="text-xs text-gray-400">{totalFields} campos</p>
                </div>
              </div>

              {sections.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {sections.slice(0, 6).map(sec => (
                    <span key={sec.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                      {sec.title}
                    </span>
                  ))}
                  {sections.length > 6 && (
                    <span className="text-xs text-gray-400 px-1">+{sections.length - 6} mas</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}