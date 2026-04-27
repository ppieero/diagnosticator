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

const BK_OPTS=[{v:"no_breakfast",l:"No desayuno"},{v:"coffee_tea",l:"Café"},{v:"bread_toast",l:"Pan/tostadas"},{v:"oats_cereal",l:"Avena"},{v:"fruit",l:"Fruta"},{v:"yogurt_dairy",l:"Yogurt"},{v:"eggs",l:"Huevos"}]
const LN_OPTS=[{v:"home_cooked",l:"Menú casero"},{v:"fast_food",l:"Comida rápida"},{v:"salad",l:"Ensalada"},{v:"rice_pasta",l:"Arroz/pasta"},{v:"chicken_meat",l:"Pollo/carne"},{v:"fish",l:"Pescado"},{v:"legumes",l:"Legumbres"}]
const DN_OPTS=[{v:"similar_lunch",l:"Similar almuerzo"},{v:"light_meal",l:"Ligera"},{v:"fast_food",l:"Comida rápida"},{v:"snacking",l:"Picoteo"},{v:"no_dinner",l:"No ceno"}]
const SC_OPTS=[{v:"exercise",l:"Ejercicio"},{v:"breathing_meditation",l:"Respiración"},{v:"sleep",l:"Dormir"},{v:"eating_cravings",l:"Comer"},{v:"talking",l:"Hablar"},{v:"music_leisure",l:"Música"},{v:"therapy",l:"Terapia"},{v:"caffeine_stimulants",l:"Café"},{v:"alcohol",l:"Alcohol"},{v:"tobacco",l:"Tabaco"},{v:"dont_know",l:"No lo manejo"}]
const INTOLERANCES=[{v:"gluten",l:"Gluten"},{v:"lactosa",l:"Lactosa"},{v:"fructosa",l:"Fructosa"},{v:"huevo",l:"Huevo"},{v:"mariscos",l:"Mariscos"},{v:"frutos_secos",l:"Frutos secos"},{v:"soja",l:"Soja"},{v:"ninguna",l:"Ninguna"},{v:"otra",l:"Otra"}]

export function AnamnesisNutricion({ snapshot, setSnapshot, patient }: Props) {
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
    {n:1,title:"Medidas y composición",sub:"Peso, talla, cintura, objetivo"},
    {n:2,title:"Historial de peso",sub:"Peso habitual, mínimo, máximo"},
    {n:3,title:"Alimentación",sub:"Tipo, calidad y comidas del día"},
    {n:4,title:"Intolerancias y alergias",sub:"Restricciones alimentarias"},
    {n:5,title:"Hidratación",sub:"Consumo de agua"},
    {n:6,title:"Evacuación",sub:"Hábito intestinal"},
    {n:7,title:"Actividad y sueño",sub:"Ejercicio y descanso"},
    {n:8,title:"Energía y estrés",sub:"Niveles actuales"},
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{doneSecs.size}/{total} secciones</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{width:`${progress}%`}}/>
          </div>
          <span className="text-xs font-medium text-green-600">{progress}%</span>
        </div>
      </div>

      {sections.map(({n,title,sub}) => {
        const isDone = doneSecs.has(n)
        const isOpen = openSec === n
        const prevN = n > 1 ? n - 1 : null
        const nextN = n < total ? n + 1 : null
        return (
          <div key={n} className={cn("card overflow-hidden", isOpen ? "border-green-400" : "")}>
            <button type="button" onClick={() => setOpenSec(isOpen ? null : n)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div className="flex items-center gap-3">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                  isDone?"bg-green-100 text-green-800":isOpen?"bg-green-600 text-white":"bg-gray-100 text-gray-500 border border-gray-200")}>
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
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Peso (kg)</label><input type="number" value={snapshot.weight_kg??""} onChange={e=>setSnapshot(p=>({...p,weight_kg:parseFloat(e.target.value)||undefined}))} placeholder="70" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Talla (cm)</label><input type="number" value={snapshot.height_cm??""} onChange={e=>setSnapshot(p=>({...p,height_cm:parseInt(e.target.value)||undefined}))} placeholder="170" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Cintura (cm)</label><input type="number" value={snap.waist_cm as number??""} onChange={e=>sg("waist_cm",parseFloat(e.target.value)||undefined)} placeholder="80" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Cadera (cm)</label><input type="number" value={snap.hip_cm as number??""} onChange={e=>sg("hip_cm",parseFloat(e.target.value)||undefined)} placeholder="95" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">% Grasa corporal</label><input type="number" value={snap.body_fat_pct as number??""} onChange={e=>sg("body_fat_pct",parseFloat(e.target.value)||undefined)} placeholder="—" className="input-base"/></div>
                  </div>
                  {patient?.biological_sex !== "male" && (
                    <div><p className="text-xs font-medium text-gray-500 mb-2">Embarazo actual</p>
                      <div className="flex flex-wrap gap-2">{[["not_applicable","No aplica"],["no","No"],["yes","Sí"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>setSnapshot(p=>({...p,pregnancy_status:v as AnamnesisSnapshot["pregnancy_status"]}))} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snapshot.pregnancy_status===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div>
                    </div>
                  )}
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Objetivo nutricional</p><div className="flex flex-wrap gap-1.5">{[["bajar_peso","Bajar peso"],["subir_peso","Subir peso"],["mantener","Mantener peso"],["ganar_musculo","Ganar músculo"],["mejorar_habitos","Mejorar hábitos"],["control_medico","Control médico"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("nutritional_goal",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.nutritional_goal===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><label className="text-xs font-medium text-gray-500 block mb-1">Motivo de consulta</label><textarea rows={2} value={snapshot.main_complaint??""} onChange={e=>setSnapshot(p=>({...p,main_complaint:e.target.value}))} placeholder="¿Por qué consulta hoy?" className="input-base resize-none"/></div>
                </>)}
                {n===2 && (<>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Peso habitual (kg)</label><input type="number" value={snap.usual_weight as number??""} onChange={e=>sg("usual_weight",parseFloat(e.target.value)||undefined)} placeholder="—" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Peso mín. adulto</label><input type="number" value={snap.min_adult_weight as number??""} onChange={e=>sg("min_adult_weight",parseFloat(e.target.value)||undefined)} placeholder="—" className="input-base"/></div>
                    <div><label className="text-xs font-medium text-gray-500 block mb-1">Peso máx. adulto</label><input type="number" value={snap.max_adult_weight as number??""} onChange={e=>sg("max_adult_weight",parseFloat(e.target.value)||undefined)} placeholder="—" className="input-base"/></div>
                  </div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Intentos previos de dieta?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("previous_diets",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.previous_diets===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  {snap.previous_diets==="yes" && <div><label className="text-xs font-medium text-gray-500 block mb-1">¿Cuántos?</label><input type="number" min="1" value={snap.previous_diets_count as number??""} onChange={e=>sg("previous_diets_count",parseInt(e.target.value)||undefined)} placeholder="1" className="input-base"/></div>}
                </>)}
                {n===3 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Tipo de alimentación</p><div className="flex flex-wrap gap-1.5">{[["omnivore","Omnívora"],["vegetarian","Vegetariana"],["vegan","Vegana"],["keto_lowcarb","Keto"],["gluten_free","Sin gluten"],["high_protein","Alta proteína"],["fasting","Ayuno"],["other","Otro"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("diet_type",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.diet_type===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad</p><div className="flex flex-wrap gap-1.5">{[["excellent","Excelente"],["good","Buena"],["fair","Regular"],["bad","Mala"],["very_bad","Muy mala"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("diet_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.diet_quality===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Desayuno</p><div className="flex flex-wrap gap-1.5">{BK_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("breakfast",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.breakfast as string[]??[]).includes(o.v)?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Almuerzo</p><div className="flex flex-wrap gap-1.5">{LN_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("lunch",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.lunch as string[]??[]).includes(o.v)?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Cena</p><div className="flex flex-wrap gap-1.5">{DN_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("dinner",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.dinner as string[]??[]).includes(o.v)?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Comidas al día</p><div className="flex flex-wrap gap-1.5">{[["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["mas5","+5"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("meals_per_day",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.meals_per_day===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Come entre horas?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("snacking",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.snacking===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  {snap.snacking==="yes" && <div><label className="text-xs font-medium text-gray-500 block mb-1">¿Qué picotea?</label><input value={snap.snack_description as string??""} onChange={e=>sg("snack_description",e.target.value)} placeholder="Fruta, galletas, frutos secos..." className="input-base"/></div>}
                </>)}
                {n===4 && (
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Intolerancias / Alergias</p><div className="flex flex-wrap gap-1.5">{INTOLERANCES.map(o=>(<button key={o.v} type="button" onClick={()=>mu("food_intolerances",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.food_intolerances as string[]??[]).includes(o.v)?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                )}
                {n===5 && <div><p className="text-xs font-medium text-gray-500 mb-2">Consumo de agua</p><div className="flex flex-wrap gap-1.5">{[["lt_0_5","< 0.5L"],["0_5_1","0.5–1L"],["1_1_5","1–1.5L"],["1_5_2","1.5–2L"],["2_3","2–3L"],["gt_3","> 3L"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("water_intake",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.water_intake===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>}
                {n===6 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Evacuación</p><div className="flex flex-wrap gap-2">{[["normal","Normal"],["constipation","Estreñimiento"],["diarrhea","Diarrea"],["variable","Variable"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("bowel_habit",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.bowel_habit===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Evacua diariamente?</p><div className="flex gap-2">{[["yes","Sí"],["no","No"],["sometimes","A veces"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("daily_bowel_movement",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.daily_bowel_movement===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Constipación abdominal</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Nada</span><input type="range" min="0" max="10" step="1" value={snap.constipation_level as number??0} onChange={e=>sg("constipation_level",parseInt(e.target.value))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snap.constipation_level as number??0}</span><span className="text-xs text-gray-400">Severa</span></div></div>
                </>)}
                {n===7 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Actividad física</p><div className="flex flex-wrap gap-1.5">{[["sedentary","Sedentario"],["moderate","Moderado (1–3d)"],["active","Activo (4–5d)"],["very_active","Muy activo (6–7d)"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("activity_level",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.activity_level===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Calidad del sueño</p><div className="flex flex-wrap gap-1.5">{[["very_good","Muy bueno"],["good","Bueno"],["fair","Regular"],["bad","Malo"],["very_bad","Muy malo"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("sleep_quality",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.sleep_quality===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                  <div><label className="text-xs font-medium text-gray-500 block mb-1">Horas de sueño</label><select value={snap.sleep_hours as string??""} onChange={e=>sg("sleep_hours",e.target.value)} className="input-base"><option value="">Seleccionar</option>{Array.from({length:15},(_,i)=><option key={i} value={i}>{i} h</option>)}</select></div>
                </>)}
                {n===8 && (<>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de energía</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Muy baja</span><input type="range" min="0" max="10" step="1" value={snapshot.energy_level??5} onChange={e=>setSnapshot(p=>({...p,energy_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snapshot.energy_level??5}</span><span className="text-xs text-gray-400">Muy alta</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Nivel de estrés</p><div className="flex items-center gap-3"><span className="text-xs text-gray-400">Nada</span><input type="range" min="0" max="10" step="1" value={snapshot.stress_level??5} onChange={e=>setSnapshot(p=>({...p,stress_level:parseInt(e.target.value)}))} className="flex-1"/><span className="text-sm font-medium text-gray-700 w-6 text-center">{snapshot.stress_level??5}</span><span className="text-xs text-gray-400">Máximo</span></div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">Afrontamiento del estrés</p><div className="flex flex-wrap gap-1.5">{SC_OPTS.map(o=>(<button key={o.v} type="button" onClick={()=>mu("stress_coping",o.v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",(snap.stress_coping as string[]??[]).includes(o.v)?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{o.l}</button>))}</div></div>
                  <div><p className="text-xs font-medium text-gray-500 mb-2">¿Cómo se siente hoy?</p><div className="flex flex-wrap gap-1.5">{[["calm","Tranquilo"],["happy","Contento"],["motivated","Motivado"],["tired","Cansado"],["anxious","Ansioso"],["stressed","Estresado"],["sad","Triste"],["irritable","Irritable"]].map(([v,l])=>(<button key={v} type="button" onClick={()=>sg("today_mood",v)} className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",snap.today_mood===v?"bg-green-50 border-green-500 text-green-800 border-[1.5px]":"border-gray-200 text-gray-700")}>{l}</button>))}</div></div>
                </>)}

                <div className={cn("grid gap-2 mt-2", prevN ? "grid-cols-2" : "grid-cols-1")}>
                  {prevN && <button type="button" onClick={() => setOpenSec(prevN)} className="tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">← Anterior</button>}
                  {nextN && <button type="button" onClick={() => {setDoneSecs(d => new Set([...d, n])); setOpenSec(nextN)}} className="tap-target rounded-xl bg-green-600 text-white text-sm font-semibold">Siguiente →</button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
