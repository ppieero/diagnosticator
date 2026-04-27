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

export function AnamnesisPsicologia({ snapshot, setSnapshot, patient }: Props) {
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
    {n:1,title:"Datos básicos",sub:"Peso, talla (opcional), motivo"},
    {n:2,title:"Estado actual",sub:"Ansiedad, ánimo, sueño hoy"},
    {n:3,title:"Historial psicológico",sub:"Consultas previas, diagnóstico"},
    {n:4,title:"Medicación psicoactiva",sub:"Tratamiento farmacológico actual"},
    {n:5,title:"Contexto vital",sub:"Trabajo, pareja, entorno social"},
    {n:6,title:"Eventos vitales recientes",sub:"Cambios significativos últimos 12 meses"},
    {n:7,title:"Hábitos",sub:"Actividad física, alimentación, hidratación"},
    {n:8,title:"Estrés y afrontamiento",sub:"Niveles y estrategias"},
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{doneSecs.size}/{total} secciones</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{width:`${progress}%`}}/>
          </div>
          <span className="text-xs font-medium text-amber-600">{progress}%</span>
        </div>
      </div>

      {sections.map(({n,title,sub}) => {
        const isDone = doneSecs.has(n)
        const isOpen = openSec === n
        const prevN = n > 1 ? n - 1 : null
        const nextN = n < total ? n + 1 : null
        return (
          <div key={n} className={cn("card overflow-hidden", isOpen ? "border-amber-400" : "")}>
            <button type="button" onClick={() => setOpenSec(isOpen ? null : n)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div className="flex items-center gap-3">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                  isDone?"bg-green-100 text-green-800":isOpen?"bg-amber-600 text-white":"bg-gray-100 text-gray-500 border border-gray-200")}>
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
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Peso (kg) <span className="text-gray-400">(opcional)</span></label><input type="number" value={snapshot.weight_kg??""} onChange={e=>setSnapshot(p=>({...p,weight_kg:parseFloat(e.target.value)||undefined}))} placeholder="—" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Talla (cm) <span className="text-gray-400">(opcional)</span></label><input type="number" value={snapshot.height_cm??""} onChange={e=>setSnapshot(p=>({...p,height_cm:parseInt(e.target.value)||undefined}))} placeholder="—" className="input-base"/></div>
                  </div>
                  <div><label className="text-xs font-medium text-gray-500 block mb-1">Motivo de consulta <span className="text-red-500">*</span></label><textarea rows={3} value={snapshot.main_complaint??""} onChange={e=>setSnapshot(p=>({...p,main_complaint:e.target.value}))} placeholder="¿Por qué consulta hoy? ¿Qué le gustaría trabajar?" className="input-base resize-none"/></div>
                </>)}
                {n===2 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de ansiedad hoy</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Nada</span><input type="range" min="0" max="10" step="1" value={snap.anxiety_today as number??5} onChange={e=>sg("anxiety_today",parseInt(e.target.value))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snap.anxiety_today as number??5}</span><span className="text-xs text-gray-400">Máxima</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de ánimo hoy</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Muy bajo</span><input type="range" min="0" max="10" step="1" value={snap.mood_today_score as number??5} onChange={e=>sg("mood_today_score",parseInt(e.target.value))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snap.mood_today_score as number??5}</span><span className="text-xs text-gray-400">Muy alto</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de energía hoy</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Muy baja</span><input type="range" min="0" max="10" step="1" value={snapshot.energy_level??5} onChange={e=>setSnapshot(p=>({...p,energy_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snapshot.energy_level??5}</span><span className="text-xs text-gray-400">Muy alta</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad del sueño hoy</p><div className="flex flex-wrap gap-1.5">{[["very_good","Muy bueno"],["good","Bueno"],["fair","Regular"],["bad","Malo"],["very_bad","Muy malo"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("sleep_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.sleep_quality===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><label className="text-xs font-medium text-gray-500 block mb-1">Horas de sueño anoche</label><select value={snap.sleep_hours as string??""} onChange={e=>sg("sleep_hours",e.target.value)} className="input-base"><option value="">Seleccionar</option>{Array.from({length:15},(_,i)=><option key={i} value={i}>{i} h</option>)}</select></div>
                </>)}
                {n===3 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Ha consultado a un psicólogo antes?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("prev_psychology",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.prev_psychology===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  {snap.prev_psychology==="yes" && (<>
                    <div><p className="text-xs font-medium text-gray-500 mb-2">¿Hace cuánto tiempo?</p><div className="flex flex-wrap gap-1.5">{[["lt_1y","< 1 año"],["1_3y","1–3 años"],["3_5y","3–5 años"],["gt_5y","+ 5 años"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("prev_psych_time",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.prev_psych_time===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Diagnóstico previo (si lo tiene)</label><input value={snap.prev_diagnosis as string??""} onChange={e=>sg("prev_diagnosis",e.target.value)} placeholder="Ej. Trastorno de ansiedad, depresión..." className="input-base"/></div>
                  </>)}
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Tratamiento psiquiátrico previo?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("prev_psychiatry",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.prev_psychiatry===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                </>)}
                {n===4 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Toma medicación psicoactiva actualmente?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("current_psych_meds",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.current_psych_meds===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  {snap.current_psych_meds==="yes" && (<>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">¿Cuál/es?</label><input value={snap.psych_meds_name as string??""} onChange={e=>sg("psych_meds_name",e.target.value)} placeholder="Ej. Sertralina 50mg, Lorazepam..." className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">¿Desde cuándo?</label><input value={snap.psych_meds_since as string??""} onChange={e=>sg("psych_meds_since",e.target.value)} placeholder="Ej. 6 meses, 2 años..." className="input-base"/></div>
                  </>)}
                </>)}
                {n===5 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Situación laboral</p><div className="flex flex-wrap gap-1.5">{[["employed","Empleado/a"],["self_employed","Autónomo/a"],["unemployed","Desempleado/a"],["student","Estudiante"],["retired","Jubilado/a"],["other","Otro"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("employment_status",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.employment_status===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Situación de pareja</p><div className="flex flex-wrap gap-1.5">{[["single","Soltero/a"],["partner","En pareja"],["married","Casado/a"],["separated","Separado/a"],["widowed","Viudo/a"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("relationship_status",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.relationship_status===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Vive solo/a?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("lives_alone",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.lives_alone===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Red de apoyo</p><div className="flex flex-wrap gap-1.5">{[["family","Familia"],["friends","Amigos"],["partner","Pareja"],["community","Comunidad"],["none","Ninguna"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>mu("support_network",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.support_network as string[]??[]).includes(v)?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                </>)}
                {n===6 && (<>
                  <p className="text-xs text-gray-400">¿Ha experimentado alguno de estos eventos en los últimos 12 meses?</p>
                  <div className="flex flex-col gap-2">{[["recent_grief","Duelo reciente"],["recent_job_change","Cambio de trabajo"],["recent_separation","Separación o divorcio"],["recent_move","Mudanza"],["recent_illness","Enfermedad propia o familiar"]].map(([k,l])=>(<label key={k} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50 cursor-pointer"><input type="checkbox" checked={!!(snap[k])} onChange={e=>sg(k,e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-amber-600"/><span className="text-sm text-gray-700">{l}</span></label>))}</div>
                  <div><label className="text-xs font-medium text-gray-500 block mb-1">Otro evento significativo</label><input value={snap.recent_other_event as string??""} onChange={e=>sg("recent_other_event",e.target.value)} placeholder="Describe si aplica..." className="input-base"/></div>
                </>)}
                {n===7 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Actividad física</p><div className="flex flex-wrap gap-1.5">{[["sedentary","Sedentario"],["moderate","Moderado (1–3d)"],["active","Activo (4–5d)"],["very_active","Muy activo (6–7d)"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("activity_level",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.activity_level===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad alimentación</p><div className="flex flex-wrap gap-1.5">{[["excellent","Excelente"],["good","Buena"],["fair","Regular"],["bad","Mala"],["very_bad","Muy mala"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("diet_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.diet_quality===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Consumo de agua</p><div className="flex flex-wrap gap-1.5">{[["lt_0_5","< 0.5L"],["0_5_1","0.5–1L"],["1_1_5","1–1.5L"],["1_5_2","1.5–2L"],["2_3","2–3L"],["gt_3","> 3L"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("water_intake",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.water_intake===v?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                </>)}
                {n===8 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de estrés</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Nada</span><input type="range" min="0" max="10" step="1" value={snapshot.stress_level??5} onChange={e=>setSnapshot(p=>({...p,stress_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snapshot.stress_level??5}</span><span className="text-xs text-gray-400">Máximo</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Estrategias de afrontamiento</p><div className="flex flex-wrap gap-1.5">{SC_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("stress_coping",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.stress_coping as string[]??[]).includes(o.v)?"bg-amber-50 border-amber-500 text-amber-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                </>)}

                <div className={cn("grid gap-2 mt-2", prevN ? "grid-cols-2" : "grid-cols-1")}>
                  {prevN && <button type="button" onClick={() => setOpenSec(prevN)} className="tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">← Anterior</button>}
                  {nextN && <button type="button" onClick={() => {setDoneSecs(d => new Set([...d, n])); setOpenSec(nextN)}} className="tap-target rounded-xl bg-amber-600 text-white text-sm font-semibold">Siguiente →</button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
