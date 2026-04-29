"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface MedDetail {
  dosis: string
  via: string
  frecuencia: string
  nombre_otro?: string
}

type MedId = "estradiol"|"estriol"|"progesterona"|"testosterona"|"dhea"|"otro"

const MEDS: Record<MedId, { name: string; vias: string[] }> = {
  estradiol:    { name: "Estradiol sistémico",      vias: ["Oral","Parche","Gel","Spray"] },
  estriol:      { name: "Estriol vaginal",          vias: ["Crema vaginal","Óvulo","Anillo"] },
  progesterona: { name: "Progesterona micronizada", vias: ["Oral","Vaginal"] },
  testosterona: { name: "Testosterona",             vias: ["Tópica","Inyectable","Implante"] },
  dhea:         { name: "DHEA",                     vias: ["Oral","Vaginal","Tópica"] },
  otro:         { name: "Otro",                     vias: [] },
}

const FRECUENCIAS = ["Diaria","Cíclica","Semanal","Mensual"]

interface HormonalMedsValue {
  activos: MedId[]
  detalles: Partial<Record<MedId, MedDetail>>
}

interface Props {
  value?: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}

export function HormonalMedsField({ value, onChange, disabled }: Props) {
  const parsed = (value && typeof value === "object" ? value : { activos: [], detalles: {} }) as HormonalMedsValue
  const [activos, setActivos] = useState<MedId[]>(parsed.activos ?? [])
  const [detalles, setDetalles] = useState<Partial<Record<MedId, MedDetail>>>(parsed.detalles ?? {})

  function commit(newActivos: MedId[], newDetalles: Partial<Record<MedId, MedDetail>>) {
    onChange({ activos: newActivos, detalles: newDetalles })
  }

  function toggleMed(id: MedId) {
    if (activos.includes(id)) {
      const next = activos.filter(a => a !== id)
      const nextDet = { ...detalles }
      delete nextDet[id]
      setActivos(next)
      setDetalles(nextDet)
      commit(next, nextDet)
    } else {
      const next = [...activos, id]
      const nextDet = { ...detalles, [id]: { dosis: "", via: "", frecuencia: "" } }
      setActivos(next)
      setDetalles(nextDet)
      commit(next, nextDet)
    }
  }

  function updateDetalle(id: MedId, field: keyof MedDetail, val: string) {
    const nextDet = { ...detalles, [id]: { ...detalles[id], [field]: val } as MedDetail }
    setDetalles(nextDet)
    commit(activos, nextDet)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Chips de medicamentos */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(MEDS) as [MedId, {name:string;vias:string[]}][]).map(([id, med]) => (
          <button key={id} type="button" disabled={disabled}
            onClick={() => toggleMed(id)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              activos.includes(id)
                ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]"
                : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50")}>
            {med.name}
          </button>
        ))}
      </div>

      {/* Tarjetas de detalle por medicamento activo */}
      {activos.length === 0 && (
        <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          Selecciona un medicamento para agregar detalle
        </div>
      )}

      <div className="flex flex-col gap-3">
        {activos.map(id => {
          const med = MEDS[id]
          const det = detalles[id] ?? { dosis: "", via: "", frecuencia: "" }
          return (
            <div key={id} className="border border-purple-200 rounded-2xl overflow-hidden bg-purple-50/20">
              <div className="flex items-center justify-between px-4 py-2.5 bg-purple-50 border-b border-purple-100">
                <span className="text-xs font-semibold text-purple-900">{med.name}</span>
                {!disabled && (
                  <button type="button" onClick={() => toggleMed(id)}
                    className="text-xs text-purple-400 hover:text-red-500 px-1">
                    × quitar
                  </button>
                )}
              </div>
              <div className="px-4 py-3 flex flex-col gap-3">
                {id === "otro" && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1 uppercase tracking-wide">Nombre del medicamento</label>
                    <input
                      type="text"
                      value={det.nombre_otro ?? ""}
                      onChange={e => updateDetalle(id, "nombre_otro", e.target.value)}
                      disabled={disabled}
                      placeholder="Especificar..."
                      className="input-base text-xs w-full"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1 uppercase tracking-wide">Dosis</label>
                    <input
                      type="text"
                      value={det.dosis}
                      onChange={e => updateDetalle(id, "dosis", e.target.value)}
                      disabled={disabled}
                      placeholder="Ej: 1mg, 100mg..."
                      className="input-base text-xs w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1 uppercase tracking-wide">Vía</label>
                    {med.vias.length > 0 ? (
                      <select
                        value={det.via}
                        onChange={e => updateDetalle(id, "via", e.target.value)}
                        disabled={disabled}
                        className="input-base text-xs w-full">
                        <option value="">Seleccionar</option>
                        {med.vias.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={det.via}
                        onChange={e => updateDetalle(id, "via", e.target.value)}
                        disabled={disabled}
                        placeholder="Vía de administración..."
                        className="input-base text-xs w-full"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5 uppercase tracking-wide">Frecuencia</label>
                  <div className="flex flex-wrap gap-1.5">
                    {FRECUENCIAS.map(f => (
                      <button key={f} type="button" disabled={disabled}
                        onClick={() => updateDetalle(id, "frecuencia", det.frecuencia === f ? "" : f)}
                        className={cn("px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all",
                          det.frecuencia === f
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
