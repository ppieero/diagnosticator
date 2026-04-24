"use client"
import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"

interface FindingDetail { side: string; sev: number; note: string }
interface SectionState { status: "none"|"normal"|"findings"; findings: Record<string,FindingDetail>; open: boolean }
interface PosturalState { [secId: string]: SectionState }

const SECTIONS = [
  { id:"cervical", title:"Columna cervical", findings:["Antepulsión cefálica","Retropulsión cefálica","Rotación derecha","Rotación izquierda","Inclinación derecha","Inclinación izquierda","Rectificación cervical","Asimetría facial","Altura orejas desniveladas"] },
  { id:"dorsal",   title:"Columna dorsal",   findings:["Hipercifosis","Rectificación dorsal","Escoliosis dorsal","Asimetría escapular","Gibosidad costal"] },
  { id:"lumbar",   title:"Columna lumbar",   findings:["Hiperlordosis","Rectificación lumbar","Escoliosis lumbar","Anteversión pélvica","Retroversión pélvica","Espondilolistesis"] },
  { id:"cadera",   title:"Cadera",           findings:["Inclinación pélvica","Rotación pélvica","Coxa vara","Coxa valga","Asimetría altura ilíaca"] },
  { id:"rodilla",  title:"Rodilla",          findings:["Genu valgum","Genu varum","Genu recurvatum","Genu flexum","Rotación tibial interna","Rotación tibial externa"], conflicts:[["Genu valgum","Genu varum"]] },
  { id:"tobillo",  title:"Tobillo y pie",    findings:["Pronación","Supinación","Pie plano","Pie cavo","Hallux valgus","Dedos en garra","Base sustentación aumentada","Base sustentación disminuida"], conflicts:[["Pronación","Supinación"],["Pie plano","Pie cavo"]] },
  { id:"hombro",   title:"Hombro y escápula",findings:["Hombro elevado","Hombro descendido","Escápula ascendida","Escápula descendida","Rotación interna hombro","Antepulsión hombro","Retropulsión hombro","Discinesia escapular","Línea intermamilar desalineada"] },
  { id:"codo",     title:"Codo",             findings:["Cúbito valgo","Cúbito varo","Hiperextensión codo","Flexo de codo"] },
  { id:"muneca",   title:"Muñeca",           findings:["Desviación radial","Desviación cubital","Hiperextensión muñeca","Flexo de muñeca"] },
] as const

type SectionId = typeof SECTIONS[number]["id"]
const SIDES = ["Bilateral","Derecho","Izquierdo"]

function initState(value?: unknown): PosturalState {
  const base: PosturalState = {}
  SECTIONS.forEach(s => { base[s.id] = { status:"none", findings:{}, open:false } })
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as PosturalState
    SECTIONS.forEach(s => { if (v[s.id]) base[s.id] = { status:"none", findings:{}, open:false, ...v[s.id] } })
  }
  return base
}

interface Props { value?: unknown; onChange: (v: unknown) => void; disabled?: boolean }

export function PosturalAssessmentField({ value, onChange, disabled }: Props) {
  const [ps, setPs] = useState<PosturalState>(() => initState(value))
  const [filterOnly, setFilterOnly] = useState(false)
  const [saved, setSaved] = useState(false)

  const commit = useCallback((next: PosturalState) => {
    setPs(next); onChange(next)
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }, [onChange])

  function setStatus(id: string, status: "none"|"normal"|"findings") {
    commit({ ...ps, [id]: { ...ps[id], status, findings: status !== "findings" ? {} : ps[id].findings, open: status === "findings" } })
  }

  function toggleFinding(secId: string, finding: string) {
    const f = { ...ps[secId].findings }
    if (f[finding]) delete f[finding]
    else f[finding] = { side: "Bilateral", sev: 5, note: "" }
    commit({ ...ps, [secId]: { ...ps[secId], findings: f } })
  }

  function setSide(secId: string, finding: string, side: string) {
    const f = { ...ps[secId].findings }
    if (f[finding]) f[finding] = { ...f[finding], side }
    commit({ ...ps, [secId]: { ...ps[secId], findings: f } })
  }

  function setSev(secId: string, finding: string, sev: number) {
    const f = { ...ps[secId].findings }
    if (f[finding]) f[finding] = { ...f[finding], sev }
    commit({ ...ps, [secId]: { ...ps[secId], findings: f } })
  }

  function toggleOpen(id: string) {
    if (ps[id].status === "normal") return
    commit({ ...ps, [id]: { ...ps[id], open: !ps[id].open } })
  }

  function markAllNormal() {
    if (!confirm("¿Marcar todas las secciones como Normal?")) return
    const next = { ...ps }
    SECTIONS.forEach(s => { next[s.id] = { status: "normal", findings: {}, open: false } })
    commit(next)
  }

  function getConflict(secId: string): string[] | null {
    const sec = SECTIONS.find(s => s.id === secId) as { conflicts?: string[][] } | undefined
    if (!sec?.conflicts) return null
    const sel = Object.keys(ps[secId].findings)
    for (const pair of sec.conflicts) {
      if (pair.every(p => sel.includes(p))) return pair
    }
    return null
  }

  const completed = SECTIONS.filter(s => {
    const st = ps[s.id]
    return st.status === "normal" || (st.status === "findings" && Object.keys(st.findings).length > 0)
  }).length
  const pct = Math.round((completed / SECTIONS.length) * 100)
  const visible = filterOnly ? SECTIONS.filter(s => ps[s.id].status === "findings") : SECTIONS

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{completed} / {SECTIONS.length} secciones</span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">Guardado</span>}
            <span className="text-xs font-medium text-blue-700">{pct}%</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{width:`${pct}%`}}/>
        </div>
        <div className="flex gap-2">
          {!disabled && (
            <button type="button" onClick={markAllNormal}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium">
              Marcar todo normal
            </button>
          )}
          <button type="button" onClick={() => setFilterOnly(!filterOnly)}
            className={cn("text-xs px-3 py-1.5 rounded-lg border font-medium",
              filterOnly ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 bg-white text-gray-700")}>
            {filterOnly ? "Ver todas" : "Ver solo hallazgos"}
          </button>
        </div>
      </div>

      {visible.length === 0 && filterOnly && (
        <div className="text-center py-8 text-sm text-gray-400">Sin hallazgos registrados aún</div>
      )}

      {visible.map(sec => {
        const st = ps[sec.id]
        const selFindings = Object.keys(st.findings)
        const conflict = getConflict(sec.id)
        return (
          <div key={sec.id} className={cn("border rounded-2xl overflow-hidden transition-colors",
            st.status==="normal" ? "border-green-400" : st.status==="findings" ? "border-blue-400" : "border-gray-200")}>
            <button type="button" onClick={() => toggleOpen(sec.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left bg-white hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{sec.title}</p>
                {st.status==="findings" && selFindings.length>0 && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {selFindings.slice(0,2).join(" · ")}{selFindings.length>2?` +${selFindings.length-2}`:""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {st.status==="normal" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">Normal</span>}
                {st.status==="findings" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{selFindings.length} hallazgo{selFindings.length!==1?"s":""}</span>}
                {st.status==="none" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sin evaluar</span>}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={cn("text-gray-400 transition-transform", st.open ? "rotate-180" : "")}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>

            {!disabled && (
              <div className="flex gap-2 px-4 pb-3 bg-white">
                {(["normal","findings","none"] as const).map(s => (
                  <button key={s} type="button" onClick={() => setStatus(sec.id, s)}
                    className={cn("flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
                      s==="normal" ? st.status==="normal" ? "bg-green-600 text-white border-green-600" : "bg-green-50 text-green-800 border-green-300" :
                      s==="findings" ? st.status==="findings" ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-800 border-blue-300" :
                      "bg-gray-50 text-gray-600 border-gray-200")}>
                    {s==="normal"?"Normal":s==="findings"?"Con hallazgos":"Limpiar"}
                  </button>
                ))}
              </div>
            )}

            {st.open && st.status==="findings" && (
              <div className="border-t border-gray-100 px-4 py-4 bg-white flex flex-col gap-4">
                {conflict && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <p className="text-xs text-amber-800">Revisar: opciones opuestas — {conflict.join(" y ")}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Hallazgos</p>
                  <div className="flex flex-wrap gap-2">
                    {sec.findings.map((f: string) => (
                      <button key={f} type="button" disabled={disabled} onClick={() => toggleFinding(sec.id, f)}
                        className={cn("px-3 py-2 rounded-full text-xs font-medium border transition-all",
                          st.findings[f] ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                {selFindings.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Detalle</p>
                    {selFindings.map(f => {
                      const d = st.findings[f]
                      return (
                        <div key={f} className="bg-gray-50 rounded-xl p-3 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-900">{f}</p>
                            {!disabled && (
                              <button type="button" onClick={() => toggleFinding(sec.id, f)}
                                className="text-xs text-gray-400 hover:text-red-500 px-2 py-0.5">Quitar</button>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-14 flex-shrink-0">Lado</span>
                            <div className="flex gap-1 flex-wrap">
                              {SIDES.map(side => (
                                <button key={side} type="button" disabled={disabled} onClick={() => setSide(sec.id, f, side)}
                                  className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                    d.side===side ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100")}>
                                  {side}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-14 flex-shrink-0">Severidad</span>
                            <span className="text-xs text-gray-400">0</span>
                            <input type="range" min="0" max="10" step="1" value={d.sev} disabled={disabled}
                              onChange={e => setSev(sec.id, f, parseInt(e.target.value))}
                              className="flex-1"/>
                            <span className="text-xs text-gray-400">10</span>
                            <span className="text-sm font-semibold text-gray-900 w-5 text-center">{d.sev}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
