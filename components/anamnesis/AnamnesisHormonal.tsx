"use client"
import { useState } from "react"
import type { AnamnesisSnapshot } from "@/lib/services/anamnesis"
import type { Patient } from "@/types/domain"
import { cn } from "@/lib/utils"

interface Props {
  snapshot: AnamnesisSnapshot
  setSnapshot: React.Dispatch<React.SetStateAction<AnamnesisSnapshot>>
  patient: Patient | null
}

const SC_OPTS=[{v:"exercise",l:"Ejercicio"},{v:"breathing_meditation",l:"Respiración"},{v:"sleep",l:"Dormir"},{v:"eating_cravings",l:"Comer"},{v:"talking",l:"Hablar"},{v:"music_leisure",l:"Música"},{v:"therapy",l:"Terapia"},{v:"caffeine_stimulants",l:"Café"},{v:"alcohol",l:"Alcohol"},{v:"tobacco",l:"Tabaco"},{v:"dont_know",l:"No lo manejo"}]

export function AnamnesisHormonal({ snapshot, setSnapshot, patient }: Props) {
  const [openSec, setOpenSec] = useState<number|null>(1)
  const [doneSecs, setDoneSecs] = useState<Set<number>>(new Set<number>())

  const sg = (k: string, v: unknown) => setSnapshot(p => ({...p, [k]: v} as AnamnesisSnapshot))
  const mu = (k: string, v: string) => setSnapshot(p => {
    const a = ((p as Record<string,unknown>)[k] as string[]) ?? []
    return {...p, [k]: a.includes(v) ? a.filter((x:string) => x !== v) : [...a, v]} as AnamnesisSnapshot
  })

  const snap = snapshot as Record<string,unknown>
  const total = 8
  const progress = Math.round((doneSecs.size / total) * 100)

  const sections = [
    {n:1,title:"Medidas y ciclo",sub:"Peso, talla, ciclo menstrual"},
    {n:2,title:"Síntomas hormonales",sub:"Síntomas actuales"},
    {n:3,title:"Historial reproductivo",sub:"Gestaciones, anticonceptivos"},
    {n:4,title:"Libido y bienestar sexual",sub:"Libido, dolor, sequedad"},
    {n:5,title:"Piel, cabello y uñas",sub:"Calidad y cambios"},
    {n:6,title:"Hábitos",sub:"Actividad, alimentación, hidratación, sueño"},
    {n:7,title:"Energía y estrés",sub:"Niveles y afrontamiento"},
    {n:8,title:"Estado de ánimo",sub:"Cómo se siente hoy"},
  ]

  const HORMONAL_SYMPTOMS = ["sofocos","sudoración nocturna","irritabilidad","ansiedad","depresión","fatiga crónica","insomnio","retención líquidos","hinchazón abdominal","caída cabello","piel seca","acné hormonal","hipotiroidismo","hipertiroidismo","SOP","endometriosis","miomas"]
  const CONTRACEPTIVES = [{v:"ninguno",l:"Ninguno"},{v:"pildora",l:"Píldora"},{v:"diu_hormonal",l:"DIU hormonal"},{v:"diu_cobre",l:"DIU cobre"},{v:"implante",l:"Implante"},{v:"inyectable",l:"Inyectable"},{v:"parche",l:"Parche"},{v:"anillo",l:"Anillo"},{v:"barrera",l:"Barrera"},{v:"ligadura",l:"Ligadura"}]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{doneSecs.size}/{total} secciones</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-purple-500 transition-all" style={{width:`${progress}%`}}/>
          </div>
          <span className="text-xs font-medium text-purple-600">{progress}%</span>
        </div>
      </div>

      {sections.map(({n,title,sub}) => {
        const isDone = doneSecs.has(n)
        const isOpen = openSec === n
        const prevN = n > 1 ? n - 1 : null
        const nextN = n < total ? n + 1 : null
        return (
          <div key={n} className={cn("card overflow-hidden", isOpen ? "border-purple-400" : "")}>
            <button type="button" onClick={() => setOpenSec(isOpen ? null : n)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div className="flex items-center gap-3">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                  isDone?"bg-green-100 text-green-800":isOpen?"bg-purple-600 text-white":"bg-gray-100 text-gray-500 border border-gray-200")}>
                  {isDone?"✓":n}
                </div>
                <div><p className="text-sm font-medium text-gray-900">{title}</p><p className="text-xs text-gray-400">{sub}</p></div>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("text-gray-400 transition-transform flex-shrink-0",isOpen?"rotate-180":"")}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-4 flex flex-col gap-4">
                {n===1 && (<>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Peso (kg)</label><input type="number" value={snapshot.weight_kg??""} onChange={e=>setSnapshot(p=>({...p,weight_kg:parseFloat(e.target.value)||undefined}))} placeholder="60" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Talla (cm)</label><input type="number" value={snapshot.height_cm??""} onChange={e=>setSnapshot(p=>({...p,height_cm:parseInt(e.target.value)||undefined}))} placeholder="165" className="input-base"/></div>
                  </div>
                  {patient?.biological_sex !== "male" && (<>
                    <div><p className="text-xs font-medium text-gray-500 mb-2">Embarazo actual</p>
                      <div className="flex flex-wrap gap-2">{[["not_applicable","No aplica"],["no","No"],["yes","Sí"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>setSnapshot(p=>({...p,pregnancy_status:v as AnamnesisSnapshot["pregnancy_status"]}))} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snapshot.pregnancy_status===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div>
                    </div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Fecha última menstruación</label><input type="date" value={snap.last_menstruation as string??""} onChange={e=>sg("last_menstruation",e.target.value)} className="input-base"/></div>
                    <div><p className="text-xs font-medium text-gray-500 mb-2">Duración ciclo</p><div className="flex flex-wrap gap-1.5">{[["21_23d","21–23d"],["24_26d","24–26d"],["27_29d","27–29d"],["30_32d","30–32d"],["irregular","Irregular"],["amenorrea","Amenorrea"],["menopausia","Menopausia"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("cycle_duration",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.cycle_duration===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                    <div><p className="text-xs font-medium text-gray-500 mb-2">Regularidad</p><div className="flex flex-wrap gap-2">{[["regular","Regular"],["irregular","Irregular"],["ausente","Ausente"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("cycle_regularity",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.cycle_regularity===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  </>)}
                  <div><label className="text-xs font-medium text-gray-500 block mb-1">Motivo de consulta</label><textarea rows={2} value={snapshot.main_complaint??""} onChange={e=>setSnapshot(p=>({...p,main_complaint:e.target.value}))} placeholder="¿Por qué consulta hoy?" className="input-base resize-none"/></div>
                </>)}
                {n===2 && (
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Síntomas actuales (seleccionar los que apliquen)</p>
                    <div className="flex flex-wrap gap-1.5">{HORMONAL_SYMPTOMS.map(s=>(<button key={s} type="button" onClick={()=>mu("hormonal_symptoms",s)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.hormonal_symptoms as string[]??[]).includes(s)?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{s}</button>))}</div>
                  </div>
                )}
                {n===3 && (<>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Gestaciones</label><input type="number" min="0" value={snap.gestations as number??""} onChange={e=>sg("gestations",parseInt(e.target.value)||0)} placeholder="0" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Partos</label><input type="number" min="0" value={snap.births as number??""} onChange={e=>sg("births",parseInt(e.target.value)||0)} placeholder="0" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Cesáreas</label><input type="number" min="0" value={snap.cesareans as number??""} onChange={e=>sg("cesareans",parseInt(e.target.value)||0)} placeholder="0" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Abortos</label><input type="number" min="0" value={snap.abortions as number??""} onChange={e=>sg("abortions",parseInt(e.target.value)||0)} placeholder="0" className="input-base"/></div>
                  </div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Anticonceptivos actuales</p><div className="flex flex-wrap gap-1.5">{CONTRACEPTIVES.map(o=>(<button key={o.v} type="button" onClick={()=>mu("contraceptives",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.contraceptives as string[]??[]).includes(o.v)?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Estado menopáusico</p><div className="flex flex-wrap gap-1.5">{[["premenopausia","Premenopausia"],["perimenopausia","Perimenopausia"],["postmenopausia","Postmenopausia"],["no_aplica","No aplica"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("menopause_status",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.menopause_status===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                </>)}
                {n===4 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de libido</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Muy bajo</span><input type="range" min="0" max="10" step="1" value={snap.libido_level as number??5} onChange={e=>sg("libido_level",parseInt(e.target.value))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snap.libido_level as number??5}</span><span className="text-xs text-gray-400">Muy alto</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Dolor en relaciones sexuales</p><div className="flex gap-2">{[["yes","Sí"],["no","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("pain_relations",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.pain_relations===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Sequedad vaginal</p><div className="flex gap-2">{[["yes","Sí"],["no","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("vaginal_dryness",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.vaginal_dryness===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                </>)}
                {n===5 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad de piel</p><div className="flex flex-wrap gap-1.5">{[["normal","Normal"],["seca","Seca"],["grasa","Grasa"],["mixta","Mixta"],["sensible","Sensible"],["acneica","Acneica"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>mu("skin_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.skin_quality as string[]??[]).includes(v)?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Caída de cabello</p><div className="flex flex-wrap gap-2">{[["ninguna","Ninguna"],["leve","Leve"],["moderada","Moderada"],["severa","Severa"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("hair_loss",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.hair_loss===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad de uñas</p><div className="flex flex-wrap gap-2">{[["normal","Normal"],["fragiles","Frágiles"],["quebradizas","Quebradizas"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("nail_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.nail_quality===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                </>)}
                {n===6 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Actividad física</p><div className="flex flex-wrap gap-1.5">{[["sedentary","Sedentario"],["moderate","Moderado (1–3d)"],["active","Activo (4–5d)"],["very_active","Muy activo (6–7d)"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("activity_level",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.activity_level===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Tipo de alimentación</p><div className="flex flex-wrap gap-1.5">{[["omnivore","Omnívora"],["vegetarian","Vegetariana"],["vegan","Vegana"],["keto_lowcarb","Keto"],["gluten_free","Sin gluten"],["high_protein","Alta proteína"],["other","Otro"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("diet_type",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.diet_type===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad alimentación</p><div className="flex flex-wrap gap-1.5">{[["excellent","Excelente"],["good","Buena"],["fair","Regular"],["bad","Mala"],["very_bad","Muy mala"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("diet_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.diet_quality===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Consumo de agua</p><div className="flex flex-wrap gap-1.5">{[["lt_0_5","< 0.5L"],["0_5_1","0.5–1L"],["1_1_5","1–1.5L"],["1_5_2","1.5–2L"],["2_3","2–3L"],["gt_3","> 3L"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("water_intake",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.water_intake===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad del sueño</p><div className="flex flex-wrap gap-1.5">{[["very_good","Muy bueno"],["good","Bueno"],["fair","Regular"],["bad","Malo"],["very_bad","Muy malo"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("sleep_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.sleep_quality===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><label className="text-xs font-medium text-gray-500 block mb-1">Horas de sueño</label><select value={snap.sleep_hours as string??""} onChange={e=>sg("sleep_hours",e.target.value)} className="input-base"><option value="">Seleccionar</option>{Array.from({length:15},(_,i)=><option key={i} value={i}>{i} h</option>)}</select></div>
                </>)}
                {n===7 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de energía</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Muy baja</span><input type="range" min="0" max="10" step="1" value={snapshot.energy_level??5} onChange={e=>setSnapshot(p=>({...p,energy_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snapshot.energy_level??5}</span><span className="text-xs text-gray-400">Muy alta</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de estrés</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Nada</span><input type="range" min="0" max="10" step="1" value={snapshot.stress_level??5} onChange={e=>setSnapshot(p=>({...p,stress_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snapshot.stress_level??5}</span><span className="text-xs text-gray-400">Máximo</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Cómo afronta el estrés?</p><div className="flex flex-wrap gap-1.5">{SC_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("stress_coping",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.stress_coping as string[]??[]).includes(o.v)?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                </>)}
                {n===8 && (
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Cómo se siente hoy?</p><div className="flex flex-wrap gap-1.5">{[["bien","Bien"],["anxious","Ansiosa"],["sad","Deprimida"],["irritable","Irritable"],["stable","Estable"],["variable","Variable"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("today_mood",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.today_mood===v?"bg-purple-50 border-purple-500 text-purple-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                )}

                <div className={cn("grid gap-2 mt-2", prevN ? "grid-cols-2" : "grid-cols-1")}>
                  {prevN && <button type="button" onClick={() => setOpenSec(prevN)} className="tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">← Anterior</button>}
                  {nextN && <button type="button" onClick={() => {setDoneSecs(d => new Set([...d, n])); setOpenSec(nextN)}} className="tap-target rounded-xl bg-purple-600 text-white text-sm font-semibold">Siguiente →</button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
