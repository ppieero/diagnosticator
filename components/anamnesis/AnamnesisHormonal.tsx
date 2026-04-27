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
  {v:"ninguno",l:"Ninguno"},{v:"pildora",l:"Píldora"},{v:"diu_hormonal",l:"DIU hormonal"},
  {v:"diu_cobre",l:"DIU cobre"},{v:"implante",l:"Implante"},{v:"inyectable",l:"Inyectable"},
  {v:"parche",l:"Parche"},{v:"anillo",l:"Anillo"},{v:"barrera",l:"Barrera"},{v:"ligadura",l:"Ligadura"},
]

function imcLabel(imc: number): { label: string; color: string } {
  if (imc < 18.5) return { label: "Bajo peso", color: "text-blue-700 bg-blue-50 border-blue-200" }
  if (imc < 25)   return { label: "Normal", color: "text-green-700 bg-green-50 border-green-200" }
  if (imc < 30)   return { label: "Sobrepeso", color: "text-amber-700 bg-amber-50 border-amber-200" }
  return { label: "Obesidad", color: "text-red-700 bg-red-50 border-red-200" }
}

export function AnamnesisHormonal({ snapshot, setSnapshot, patient, onComplete }: Props) {
  const [openSec, setOpenSec] = useState<number | null>(1)
  const [doneSecs, setDoneSecs] = useState<Set<number>>(new Set<number>())

  const sg = (k: string, v: unknown) => setSnapshot(p => ({ ...p, [k]: v } as AnamnesisSnapshot))
  const mu = (k: string, v: string) => setSnapshot(p => {
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

  const cycleAbsent = snap.cycle_regularity === "ausente"

  const sections = [
    { n: 1, title: "Antropometría y estado menopáusico", sub: "Peso, talla, IMC, ciclo menstrual" },
    { n: 2, title: "Historia ginecológica", sub: "Gestaciones, anticonceptivos, motivo consulta" },
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
                <div><p className="text-sm font-medium text-gray-900">{title}</p><p className="text-xs text-gray-400">{sub}</p></div>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("text-gray-400 transition-transform flex-shrink-0", isOpen ? "rotate-180" : "")}><polyline points="6 9 12 15 18 9" /></svg>
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
                  {patient?.biological_sex !== "male" && (<>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Embarazo actual</p>
                      <div className="flex flex-wrap gap-2">
                        {([["not_applicable", "No aplica"], ["no", "No"], ["yes", "Sí"]] as const).map(([v, l]) => (
                          <button key={v} type="button" onClick={() => setSnapshot(p => ({ ...p, pregnancy_status: v as AnamnesisSnapshot["pregnancy_status"] }))}
                            className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all", snapshot.pregnancy_status === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Regularidad del ciclo</p>
                      <div className="flex flex-wrap gap-2">
                        {[["regular", "Regular"], ["irregular", "Irregular"], ["ausente", "Ausente"]].map(([v, l]) => (
                          <button key={v} type="button" onClick={() => sg("cycle_regularity", v)}
                            className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all", snap.cycle_regularity === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    {!cycleAbsent && (<>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Fecha última menstruación</label>
                        <input type="date" value={snap.last_menstruation as string ?? ""} onChange={e => sg("last_menstruation", e.target.value)} className="input-base" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Duración del ciclo</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[["21_23d", "21–23 días"], ["24_26d", "24–26 días"], ["27_29d", "27–29 días"], ["30_32d", "30–32 días"], ["gt_32d", "> 32 días"], ["irregular", "Irregular"]].map(([v, l]) => (
                            <button key={v} type="button" onClick={() => sg("cycle_duration", v)}
                              className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all", snap.cycle_duration === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Flujo menstrual</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[["escaso", "Escaso"], ["normal", "Normal"], ["abundante", "Abundante"], ["muy_abundante", "Muy abundante"]].map(([v, l]) => (
                            <button key={v} type="button" onClick={() => sg("menstrual_flow", v)}
                              className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all", snap.menstrual_flow === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>)}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Estado menopáusico</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[["premenopausia", "Premenopausia"], ["perimenopausia", "Perimenopausia"], ["postmenopausia", "Postmenopausia"], ["no_aplica", "No aplica"]].map(([v, l]) => (
                          <button key={v} type="button" onClick={() => sg("menopause_status", v)}
                            className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all", snap.menopause_status === v ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    {snap.menopause_status === "postmenopausia" && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Edad de menopausia</label>
                        <input type="number" min="30" max="70" value={snap.menopause_age as number ?? ""} onChange={e => sg("menopause_age", parseInt(e.target.value) || undefined)} placeholder="Ej: 50" className="input-base w-32" />
                      </div>
                    )}
                  </>)}
                </>)}

                {n === 2 && (<>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Gestaciones</label><input type="number" min="0" value={snap.gestations as number ?? ""} onChange={e => sg("gestations", parseInt(e.target.value) || 0)} placeholder="0" className="input-base" /></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Partos</label><input type="number" min="0" value={snap.births as number ?? ""} onChange={e => sg("births", parseInt(e.target.value) || 0)} placeholder="0" className="input-base" /></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Cesáreas</label><input type="number" min="0" value={snap.cesareans as number ?? ""} onChange={e => sg("cesareans", parseInt(e.target.value) || 0)} placeholder="0" className="input-base" /></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Abortos espontáneos</label><input type="number" min="0" value={snap.abortions as number ?? ""} onChange={e => sg("abortions", parseInt(e.target.value) || 0)} placeholder="0" className="input-base" /></div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Anticonceptivos actuales</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CONTRACEPTIVES.map(o => (
                        <button key={o.v} type="button" onClick={() => mu("contraceptives", o.v)}
                          className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all", (snap.contraceptives as string[] ?? []).includes(o.v) ? "bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]" : "border-gray-200 text-gray-700")}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Motivo de consulta <span className="text-red-500">*</span></label>
                    <textarea rows={2} value={snapshot.main_complaint ?? ""} onChange={e => setSnapshot(p => ({ ...p, main_complaint: e.target.value }))} placeholder="¿Por qué consulta hoy?" className="input-base resize-none" />
                  </div>
                </>)}

                <div className={cn("grid gap-2 mt-2", prevN ? "grid-cols-2" : "grid-cols-1")}>
                  {prevN && <button type="button" onClick={() => setOpenSec(prevN)} className="tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">← Anterior</button>}
                  {nextN && <button type="button" onClick={() => { setDoneSecs(d => new Set([...d, n])); setOpenSec(nextN) }} className="tap-target rounded-xl bg-purple-600 text-white text-sm font-semibold">Siguiente →</button>}
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
