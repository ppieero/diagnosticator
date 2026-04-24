"use client"
import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"

const SEGMENTS = {
  spine: {
    label: "Columna",
    areas: ["Cervical","Torácica","Lumbar"] as const,
    structs: {
      "Cervical": ["Trapecio superior","Elevador escápula","ECM","Escalenos","Suboccipitales","Esplenio cabeza","Romboides cervical"],
      "Torácica": ["Trapecio medio","Trapecio inferior","Romboides mayor","Serrato anterior","Erector espinal torácico","Intercostales"],
      "Lumbar": ["Erector espinal lumbar","Cuadrado lumbar","Psoas","Multífidos","Glúteo mayor","Piriforme"]
    } as Record<string,string[]>
  },
  ue: {
    label: "Ext. Superior",
    areas: ["Hombro","Codo","Muñeca"] as const,
    structs: {
      "Hombro": ["Deltoides anterior","Deltoides medio","Deltoides posterior","Supraespinoso","Infraespinoso","Subescapular","Redondo menor","Pectoral mayor","Pectoral menor"],
      "Codo": ["Bíceps braquial","Tríceps braquial","Braquial","Epicóndilo extensores","Epitróclea flexores","Lig. colateral medial","Lig. colateral lateral"],
      "Muñeca": ["Flexores muñeca","Extensores muñeca","Abductor pulgar","Pronador redondo","Supinador","Tendón de Quervain"]
    } as Record<string,string[]>
  },
  le: {
    label: "Ext. Inferior",
    areas: ["Cadera","Rodilla","Tobillo"] as const,
    structs: {
      "Cadera": ["Glúteo medio","Glúteo menor","TFL","Banda iliotibial","Iliopsoas","Aductores","Isquiotibiales proximal"],
      "Rodilla": ["Cuádriceps distal","Tendón rotuliano","Lig. colateral medial","Lig. colateral lateral","Cintilla iliotibial","Pata de ganso","Isquiotibiales distal"],
      "Tobillo": ["Gastrocnemio","Sóleo","Tendón de Aquiles","Tibial anterior","Peroneos","Flexor largo dedos","Fascia plantar"]
    } as Record<string,string[]>
  }
}

type SegId = keyof typeof SEGMENTS
const FINDINGS = ["Espasmo","Contractura","Acortamiento","Inf. muscular","Inf. tendinosa"]
const FINDING_CLS: Record<string,string> = {
  "Espasmo":        "bg-red-50 border-red-400 text-red-800",
  "Contractura":    "bg-amber-50 border-amber-400 text-amber-800",
  "Acortamiento":   "bg-purple-50 border-purple-400 text-purple-800",
  "Inf. muscular":  "bg-amber-50 border-amber-400 text-amber-800",
  "Inf. tendinosa": "bg-red-50 border-red-400 text-red-800",
}

interface StructData { right: string[]; left: string[]; notes: string }
type PalpData = Record<string, StructData>

function initData(value?: unknown): PalpData {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as PalpData
  return {}
}

interface Props { value?: unknown; onChange: (v: unknown) => void; disabled?: boolean }

export function PalpationField({ value, onChange, disabled }: Props) {
  const [data, setData] = useState<PalpData>(() => initData(value))
  const [seg, setSeg] = useState<SegId|null>(null)
  const [area, setArea] = useState<string|null>(null)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Record<string,boolean>>({})
  const [saved, setSaved] = useState(false)

  const commit = useCallback((next: PalpData) => {
    setData(next); onChange(next)
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }, [onChange])

  function getStruct(struct: string, d: PalpData): StructData {
    return d[struct] ?? { right: [], left: [], notes: "" }
  }

  function toggleFinding(struct: string, side: "right"|"left", finding: string) {
    const next = { ...data }
    const s = { ...getStruct(struct, next) }
    const arr = [...s[side]]
    const idx = arr.indexOf(finding)
    if (idx >= 0) arr.splice(idx, 1); else arr.push(finding)
    s[side] = arr
    next[struct] = s
    commit(next)
  }

  function setNotes(struct: string, notes: string) {
    commit({ ...data, [struct]: { ...getStruct(struct, data), notes } })
  }

  function copyRL(structs: string[]) {
    const next = { ...data }
    structs.forEach(s => { const d = getStruct(s, next); next[s] = { ...d, left: [...d.right] } })
    commit(next)
  }

  function copyLR(structs: string[]) {
    const next = { ...data }
    structs.forEach(s => { const d = getStruct(s, next); next[s] = { ...d, right: [...d.left] } })
    commit(next)
  }

  function clearVisible(structs: string[]) {
    const next = { ...data }
    structs.forEach(s => { next[s] = { right: [], left: [], notes: "" } })
    commit(next)
  }

  function getVisible(): Record<string, string[]> {
    if (!seg) return {}
    const q = search.toLowerCase()
    const result: Record<string,string[]> = {}
    const areas = area ? [area] : [...SEGMENTS[seg].areas]
    areas.forEach(a => {
      const list = SEGMENTS[seg].structs[a] ?? []
      const filtered = q ? list.filter(s => s.toLowerCase().includes(q)) : list
      if (filtered.length) result[a] = filtered
    })
    return result
  }

  function hasFindings(struct: string) {
    const d = data[struct]
    return !!d && (d.right.length > 0 || d.left.length > 0 || !!d.notes)
  }

  const vis = getVisible()
  const allVisible = Object.values(vis).flat()
  const evaluatedCount = Object.values(data).filter(d => d.right.length>0||d.left.length>0||d.notes).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{evaluatedCount} estructura{evaluatedCount!==1?"s":""} evaluada{evaluatedCount!==1?"s":""}</span>
        {saved && <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">Guardado</span>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(SEGMENTS) as [SegId, {label:string}][]).map(([id, s]) => (
          <button key={id} type="button" disabled={disabled}
            onClick={() => { setSeg(id); setArea(null); setSearch("") }}
            className={cn("py-2.5 rounded-xl border text-xs font-semibold transition-all",
              seg===id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}>
            {s.label}
          </button>
        ))}
      </div>

      {seg && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" disabled={disabled} onClick={() => setArea(null)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              !area ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200")}>
            Todas
          </button>
          {[...SEGMENTS[seg].areas].map(a => (
            <button key={a} type="button" disabled={disabled} onClick={() => setArea(a)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                area===a ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200")}>
              {a}
            </button>
          ))}
        </div>
      )}

      {seg && (
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar músculo o estructura..."
          className="input-base text-sm"/>
      )}

      {seg && allVisible.length > 0 && !disabled && (
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{scrollbarWidth:"none"}}>
          {[
            {l:"Copiar D→I", fn:()=>copyRL(allVisible)},
            {l:"Copiar I→D", fn:()=>copyLR(allVisible)},
            {l:"Limpiar", fn:()=>clearVisible(allVisible)},
            {l:"Expandir todo", fn:()=>{const e:Record<string,boolean>={};Object.keys(vis).forEach(a=>e[a]=true);setExpanded(e)}},
            {l:"Colapsar todo", fn:()=>setExpanded({})},
          ].map(({l,fn}) => (
            <button key={l} type="button" onClick={fn}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50">
              {l}
            </button>
          ))}
        </div>
      )}

      {!seg && (
        <div className="text-center py-8 text-sm text-gray-400 bg-gray-50 rounded-2xl">
          Selecciona un segmento para comenzar
        </div>
      )}

      {Object.entries(vis).map(([areaName, structs]) => {
        const isExp = expanded[areaName] !== false
        const withFindings = structs.filter(s => hasFindings(s)).length
        return (
          <div key={areaName} className="border border-gray-200 rounded-2xl overflow-hidden">
            <button type="button" onClick={() => setExpanded(prev => ({...prev,[areaName]:!isExp}))}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left">
              <span className="text-sm font-semibold text-gray-900">{areaName}</span>
              <div className="flex items-center gap-2">
                {withFindings > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {withFindings} con hallazgos
                  </span>
                )}
                <span className="text-xs text-gray-400">{structs.length}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={cn("text-gray-400 transition-transform", isExp?"rotate-180":"")}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>

            {isExp && structs.map(struct => {
              const d = data[struct] ?? { right: [], left: [], notes: "" }
              const hasFi = d.right.length>0||d.left.length>0||!!d.notes
              return (
                <div key={struct} className={cn("border-t border-gray-100 px-4 py-3", hasFi?"bg-blue-50/30":"bg-white")}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-900">{struct}</span>
                    {hasFi && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Con hallazgos</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(["right","left"] as const).map(side => (
                      <div key={side} className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{side==="right"?"Derecho":"Izquierdo"}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {FINDINGS.map(f => (
                            <button key={f} type="button" disabled={disabled} onClick={() => toggleFinding(struct, side, f)}
                              className={cn("px-2 py-1.5 rounded-full text-xs font-medium border transition-all",
                                d[side].includes(f) ? FINDING_CLS[f]+" border-[1.5px]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <textarea rows={1} placeholder="Notas clínicas..." disabled={disabled}
                    value={d.notes} onChange={e => setNotes(struct, e.target.value)}
                    className="input-base text-xs mt-2 resize-none w-full"/>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
