"use client"
import { useState, useMemo } from "react"
import type { AnamnesisSnapshot } from "@/lib/services/anamnesis"
import type { Patient } from "@/types/domain"
import { cn } from "@/lib/utils"

interface Props {
  snapshot: AnamnesisSnapshot
  setSnapshot: React.Dispatch<React.SetStateAction<AnamnesisSnapshot>>
  patient: Patient | null
  onComplete?: () => void
}

const CONTRACEPTIVES = [
  { v: "ninguno", l: "Ninguno" }, { v: "pildora", l: "Píldora" },
  { v: "diu_hormonal", l: "DIU hormonal" }, { v: "diu_cobre", l: "DIU cobre" },
  { v: "implante", l: "Implante" }, { v: "inyectable", l: "Inyectable" },
  { v: "parche", l: "Parche" }, { v: "anillo", l: "Anillo" },
  { v: "barrera", l: "Barrera" }, { v: "ligadura", l: "Ligadura" },
]

function imcLabel(imc: number): { label: string; color: string } {
  if (imc < 18.5) return { label: "Bajo peso",   color: "text-blue-700 bg-blue-50 border-blue-200" }
  if (imc < 25)   return { label: "Normal",       color: "text-green-700 bg-green-50 border-green-200" }
  if (imc < 30)   return { label: "Sobrepeso",    color: "text-amber-700 bg-amber-50 border-amber-200" }
  return             { label: "Obesidad",          color: "text-red-700 bg-red-50 border-red-200" }
}

export function AnamnesisHormonal({ snapshot, setSnapshot, patient: _patient, onComplete }: Props) {
  const [openSec, setOpenSec] = useState<number | null>(1)
  const [doneSecs, setDoneSecs] = useState<Set<number>>(new Set<number>())

  const sg = (k: string, v: unknown) =>
    setSnapshot(p => ({ ...p, [k]: v } as AnamnesisSnapshot))

  const mu = (k: string, v: string) =>
    setSnapshot(p => {
      const a = ((p as unknown as Record<string, unknown>)[k] as string[]) ?? []
      return { ...p, [k]: a.includes(v) ? a.filter((x: string) => x !== v) : [...a, v] } as AnamnesisSnapshot
    })

  const snap = snapshot as unknown as Record<string, unknown>
  const total = 2
  const progress = Math.round((doneSecs.size / total) * 100)

  const imc = useMemo(() => {
    if (snapshot.weight_kg && snapshot.height_cm && snapshot.height_cm > 0) {
      const h = snapshot.height_cm / 100
      return Math.round((snapshot.weight_kg / (h * h)) * 10) / 10
    }
    return null
  }, [snapshot.weight_kg, snapshot.height_cm])

  const cycleAbsent = snap.regularidad_ciclo === "ausente"

  const sections = [
    { n: 1, title: "Antropometría y estado menopáusico", sub: "Peso, talla, IMC, ciclo menstrual" },
    { n: 2, title: "Historia ginecológica", sub: "Gestaciones, anticonceptivos, estado menopáusico" },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{doneSecs.size}/{total} secciones</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-medium text-purple-600">{progress}%</span>
        </div>
      </div>

      {sections.map(({ n, title, sub }) => {
        const isDone = doneSecs.has(n)
        const isOpen = openSec === n
        const prevN = n > 1 ? n - 1 : null
        const nextN = n < total ? n + 1 : null
        return (
          <div key={n} className={cn("card overflow-hidden", isOpen ? "border-purple-400" : "")}>
            <button type="button" onClick={() => setOpenSec(isOpen ? null : n)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div className="flex items-center gap-3">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                  isDone ? "bg-green-100 text-green-800" : isOpen ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500 border border-gray-200")}>
                  {isDone ? "✓" : n}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{title}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("text-gray-400 transition-transform flex-shrink-0", isOpen ? "rotate-180" : "")}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-4 flex flex-col gap-4">
                {n === 1 && (<>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Peso (kg)</label>
                      <input type="number" value={snapshot.weight_kg ?? ""} onChange={e => setSnapshot(p => ({ ...p, weight_kg: parseFloat(e.target.value) || undefined }))} placeholder="60" className="input-base" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Talla (cm)</label>
                      <input type="number" value={snapshot.height_cm ?? ""} onChange={e => setSnapshot(p => ({ ...p, height_cm: parseInt(e.target.value) || undefined }))} placeholder="165" className="input-base" />
                    </div>
                  </div>

                  {imc !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">IMC:</span>
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", imcLabel(imc).color)}>
                        {imc} — {imcLabel(imc).label}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Circunferencia abdominal (cm)</label>
                    <input type="number" value={snap.waist_cm as number ?? ""} onChange={e => sg("waist_cm", parseFloat(e.target.value) || undefined)} placeholder="80" className="input-base" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Edad de menarquia (años)</label>
                    <input type="number" min="8" max="20" value={snap.menarquia_edad as number ?? ""} onChange={e => sg("menarquia_edad", parseInt(e.target.value) || undefined)} placeholder="12" className="input-base" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Última menstruación</label>
                    <input type="date" value={snap.ultima_menstruacion as string ?? ""} onChange={e => sg("ultima_menstruacion", e.target.value)} className="input-base" />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Etapa menopáusica</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ["premenopausia", "Premenopausia"],
                        ["perimenopausia_temprana", "Perimenopausia temprana"],
                        ["perimenopausia_tardia", "Perimenopausia tardía"],
                        ["menopausia", "Menopausia"],
                        ["postmenopausia", "Postmenopausia"],
                      ].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => sg("etapa_menopausica", v)}
                          className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",
                            snap.etapa_menopausica === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Regularidad del ciclo</p>
                    <div className="flex flex-wrap gap-2">
                      {[["regular", "Regular"], ["irregular", "Irregular"], ["ausente", "Ausente"]].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => sg("regularidad_ciclo", v)}
                          className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",
                            snap.regularidad_ciclo === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!cycleAbsent && (<>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Duración promedio del ciclo (días)</label>
                      <input type="number" min="15" max="60" value={snap.duracion_ciclo as number ?? ""} onChange={e => sg("duracion_ciclo", parseInt(e.target.value) || undefined)} placeholder="28" className="input-base" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Flujo menstrual</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[["leve", "Leve"], ["moderado", "Moderado"], ["abundante", "Abundante"]].map(([v, l]) => (
                          <button key={v} type="button" onClick={() => sg("flujo_menstrual", v)}
                            className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",
                              snap.flujo_menstrual === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>)}

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Amenorrea</p>
                    <div className="flex gap-2">
                      {[["si", "Sí"], ["no", "No"]].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => sg("amenorrea", v)}
                          className={cn("px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                            snap.amenorrea === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </>)}

                {n === 2 && (<>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Gestaciones</label><input type="number" min="0" value={snap.gestaciones as number ?? ""} onChange={e => sg("gestaciones", parseInt(e.target.value) || 0)} placeholder="0" className="input-base" /></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Partos</label><input type="number" min="0" value={snap.partos as number ?? ""} onChange={e => sg("partos", parseInt(e.target.value) || 0)} placeholder="0" className="input-base" /></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Cesáreas</label><input type="number" min="0" value={snap.cesareas as number ?? ""} onChange={e => sg("cesareas", parseInt(e.target.value) || 0)} placeholder="0" className="input-base" /></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Abortos</label><input type="number" min="0" value={snap.abortos as number ?? ""} onChange={e => sg("abortos", parseInt(e.target.value) || 0)} placeholder="0" className="input-base" /></div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Anticonceptivos actuales</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CONTRACEPTIVES.map(o => (
                        <button key={o.v} type="button" onClick={() => mu("anticonceptivos", o.v)}
                          className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",
                            (snap.anticonceptivos as string[] ?? []).includes(o.v) ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Estado menopáusico confirmado</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[["premenopausia", "Premenopausia"], ["perimenopausia", "Perimenopausia"], ["postmenopausia", "Postmenopausia"], ["no_aplica", "No aplica"]].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => sg("estado_menopausico_confirmado", v)}
                          className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",
                            snap.estado_menopausico_confirmado === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </>)}

                <div className={cn("grid gap-2 mt-2", prevN ? "grid-cols-2" : "grid-cols-1")}>
                  {prevN && <button type="button" onClick={() => setOpenSec(prevN)} className="tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">← Anterior</button>}
                  {nextN && <button type="button" onClick={() => { setDoneSecs(d => new Set([...d, n])); setOpenSec(nextN) }} className="tap-target rounded-xl bg-purple-600 text-white text-sm font-semibold">Continuar →</button>}
                  {!nextN && onComplete && (
                    <button type="button" onClick={() => { setDoneSecs(d => new Set([...d, n])); onComplete() }} className="tap-target rounded-xl bg-purple-600 text-white text-sm font-semibold">Continuar →</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
