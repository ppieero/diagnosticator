"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAnamnesisProfile, upsertAnamnesisProfile, getAnamnesisHistory } from "@/lib/services/anamnesis"
import type { AnamnesisProfile, AnamnesisSnapshot } from "@/lib/services/anamnesis"
import { cn } from "@/lib/utils"
import { tr, trArr, ACTIVITY_LABELS, DIET_TYPE_LABELS, DIET_QUALITY_LABELS, WATER_LABELS, BOWEL_HABIT_LABELS, YES_NO_LABELS, SLEEP_QUALITY_LABELS, MOOD_LABELS, DOMINANCE_LABELS, SPORT_PERF_LABELS, SPORT_LABELS, STRESS_COPE_LABELS, PERSONAL_HISTORY_LABELS, FOOD_LABELS, PREGNANCY_LABELS } from "@/lib/utils/anamnesis-labels"

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric" })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" })
}
function calcIMC(w?: number, h?: number) {
  if (!w || !h) return null
  return (w / Math.pow(h/100, 2)).toFixed(1)
}
function imcLabel(imc: string) {
  const v = parseFloat(imc)
  if (v < 18.5) return "Bajo peso"
  if (v < 25) return "Normal"
  if (v < 30) return "Sobrepeso"
  return "Obesidad"
}
function imcColor(imc: string) {
  const v = parseFloat(imc)
  if (v < 18.5) return "#185FA5"
  if (v < 25) return "#27500A"
  if (v < 30) return "#854F0B"
  return "#791F1F"
}
function clinicalId(uuid: string, date: string) {
  return `EVA-${new Date(date).getFullYear()}-${uuid.replace(/-/g,"").slice(-4).toUpperCase()}`
}

interface Episode {
  id: string; episode_type: string; start_date: string
  end_date?: string; status: string; details: Record<string,unknown>
}
const EP_TYPES = [
  {v:"pregnancy",l:"Embarazo",color:"#185FA5",bg:"#E6F1FB",tc:"#0C447C"},
  {v:"surgery",l:"Cirugía",color:"#854F0B",bg:"#FAEEDA",tc:"#633806"},
  {v:"injury",l:"Lesión",color:"#A32D2D",bg:"#FCEBEB",tc:"#791F1F"},
  {v:"hospitalization",l:"Hospitalización",color:"#534AB7",bg:"#EEEDFE",tc:"#3C3489"},
  {v:"other",l:"Otro",color:"#5F5E5A",bg:"#F1EFE8",tc:"#444441"},
]
const PH_OPTS=[{v:"none",l:"Ninguno"},{v:"diabetes",l:"Diabetes"},{v:"hypertension",l:"Hipertensión"},{v:"asthma",l:"Asma"},{v:"allergies",l:"Alergias"},{v:"thyroid",l:"Tiroides"},{v:"high_cholesterol",l:"Colesterol alto"},{v:"gastritis_reflux",l:"Gastritis/Reflujo"},{v:"anxiety_depression",l:"Ansiedad/Depresión"},{v:"migraines",l:"Migrañas"},{v:"major_injuries",l:"Lesiones previas"},{v:"surgeries",l:"Cirugías"},{v:"current_meds",l:"Medicación actual"},{v:"other",l:"Otros"}]
const SP_OPTS=[{v:"walking",l:"Caminata"},{v:"running",l:"Correr"},{v:"gym_weights",l:"Gimnasio"},{v:"crossfit",l:"CrossFit"},{v:"cycling",l:"Ciclismo"},{v:"swimming",l:"Natación"},{v:"soccer",l:"Fútbol"},{v:"yoga",l:"Yoga"},{v:"pilates",l:"Pilates"},{v:"dance",l:"Baile"},{v:"tennis_padel",l:"Tenis/Pádel"},{v:"other",l:"Otro"}]
const BK_OPTS=[{v:"no_breakfast",l:"No desayuno"},{v:"coffee_tea",l:"Café"},{v:"bread_toast",l:"Pan/tostadas"},{v:"oats_cereal",l:"Avena/cereal"},{v:"fruit",l:"Fruta"},{v:"yogurt_dairy",l:"Yogurt"},{v:"eggs",l:"Huevos"}]
const LN_OPTS=[{v:"home_cooked",l:"Menú casero"},{v:"fast_food",l:"Comida rápida"},{v:"salad",l:"Ensalada"},{v:"rice_pasta",l:"Arroz/pasta"},{v:"chicken_meat",l:"Pollo/carne"},{v:"fish",l:"Pescado"},{v:"legumes",l:"Legumbres"}]
const DN_OPTS=[{v:"similar_lunch",l:"Similar almuerzo"},{v:"light_meal",l:"Ligera"},{v:"fast_food",l:"Comida rápida"},{v:"snacking",l:"Picoteo"},{v:"no_dinner",l:"No ceno"}]
const SC_OPTS=[{v:"exercise",l:"Ejercicio"},{v:"breathing_meditation",l:"Respiración"},{v:"sleep",l:"Dormir"},{v:"eating_cravings",l:"Comer"},{v:"talking",l:"Hablar con alguien"},{v:"music_leisure",l:"Música/ocio"},{v:"therapy",l:"Terapia"},{v:"caffeine_stimulants",l:"Café"},{v:"alcohol",l:"Alcohol"},{v:"tobacco",l:"Tabaco"},{v:"dont_know",l:"No lo manejo"}]

type Tab="demograficos"|"antecedentes"|"signos"|"historial"

function Chip({label,on,onClick,excl=false}:{label:string;on:boolean;onClick:()=>void;excl?:boolean}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",
        on&&!excl?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":
        on&&excl?"bg-green-50 border-green-600 text-green-800 border-[1.5px]":
        "border-gray-200 text-gray-700 bg-white hover:bg-gray-50")}>
      {label}
    </button>
  )
}

function Row({label,children}:{label:string;children:React.ReactNode}) {
  return (
    <div className="flex items-start gap-2 px-4 py-2.5 border-t border-gray-50 first:border-t-0">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-xs text-gray-900">{children}</div>
    </div>
  )
}

function SectionHeader({title,badge}:{title:string;badge?:React.ReactNode}) {
  return (
    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      {badge}
    </div>
  )
}

function Meter({value,max=10,color="#185FA5"}:{value:number;max?:number;color?:string}) {
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex-1">
      <div className="h-full rounded-full transition-all" style={{width:`${Math.round((value/max)*100)}%`,background:color}}/>
    </div>
  )
}

function AuditRow({at,by}:{at?:string;by:string}) {
  if (!at) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span className="text-xs text-gray-400">{fmt(at)} · {fmtTime(at)}{by?` · ${by}`:""}</span>
    </div>
  )
}

export default function AnamnesisPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("demograficos")
  const [open, setOpen] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState("")
  const [histExpanded, setHistExpanded] = useState<string|null>(null)
  const [profNames, setProfNames] = useState<Record<string,string>>({})
  const [updatedByName, setUpdatedByName] = useState("")
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [patientSex, setPatientSex] = useState<string|null>(null)
  const [showNewEp, setShowNewEp] = useState(false)
  const [newEp, setNewEp] = useState({episode_type:"pregnancy",start_date:"",end_date:"",status:"resolved",description:""})

  const [profile, setProfile] = useState<AnamnesisProfile>({patient_id:patientId})
  const [allergies, setAllergies] = useState<{substance:string;severity:string;reaction?:string}[]>([])
  const [meds, setMeds] = useState<{name:string;dose?:string;frequency?:string}[]>([])
  const [personal, setPersonal] = useState<{condition:string;status:string;diagnosed_year?:number;notes?:string}[]>([])
  const [family, setFamily] = useState<{condition:string;relationship:string;notes?:string}[]>([])
  const [newA, setNewA] = useState({substance:"",severity:"mild",reaction:""})
  const [newM, setNewM] = useState({name:"",dose:"",frequency:""})
  const [newP, setNewP] = useState({condition:"",status:"active",diagnosed_year:"",notes:""})
  const [newF, setNewF] = useState({condition:"",relationship:"",notes:""})
  const [history, setHistory] = useState<AnamnesisSnapshot[]>([])

  function tog(id:string){setOpen(o=>o===id?null:id)}
  function showSaved(msg:string){setSavedMsg(msg);setTimeout(()=>setSavedMsg(""),2000)}

  useEffect(()=>{
    async function load() {
      const supabase=createClient()
      const supabasePx = createClient()
      const {data:patData} = await supabasePx.from("patients").select("biological_sex").eq("id",patientId).maybeSingle()
      if (patData) setPatientSex((patData as {biological_sex:string}).biological_sex)
      const [{data:prof},{data:hist},{data:eps}]=await Promise.all([
        supabase.from("anamnesis").select("*").eq("patient_id",patientId).maybeSingle(),
        supabase.from("anamnesis_history").select("*").eq("patient_id",patientId).order("recorded_at",{ascending:false}),
        supabase.from("patient_episodes").select("*").eq("patient_id",patientId).order("start_date",{ascending:false}),
      ])
      if (prof) {
        setProfile(prof as AnamnesisProfile)
        setAllergies((prof.known_allergies as typeof allergies)??[])
        setMeds((prof.active_medications as typeof meds)??[])
        setPersonal((prof.personal_history as typeof personal)??[])
        setFamily((prof.family_history as typeof family)??[])
        if (prof.updated_by) {
          const {data:p}=await supabase.from("profiles").select("full_name").eq("id",prof.updated_by).maybeSingle()
          if (p) setUpdatedByName((p as {full_name:string}).full_name)
        }
      }
      setHistory((hist??[]) as AnamnesisSnapshot[])
      setEpisodes((eps??[]) as Episode[])
      const ids=[...new Set((hist??[]).map((s:AnamnesisSnapshot)=>s.recorded_by).filter(Boolean))] as string[]
      if (ids.length>0) {
        const {data:profs}=await supabase.from("profiles").select("id,full_name").in("id",ids)
        const nm:Record<string,string>={}
        for (const p of (profs??[])) nm[p.id]=p.full_name
        setProfNames(nm)
      }
      setLoading(false)
    }
    load()
  },[patientId])

  async function autoSave(overrides:Partial<AnamnesisProfile>={}) {
    const base={...profile,patient_id:patientId,known_allergies:allergies,active_medications:meds,personal_history:personal,family_history:family}
    await upsertAnamnesisProfile({...base,...overrides})
  }

  async function addA(){if(!newA.substance)return;const u=[...allergies,{...newA}];setAllergies(u);setNewA({substance:"",severity:"mild",reaction:""});await autoSave({known_allergies:u});showSaved("Alergia guardada")}
  async function addM(){if(!newM.name)return;const u=[...meds,{...newM}];setMeds(u);setNewM({name:"",dose:"",frequency:""});await autoSave({active_medications:u});showSaved("Medicamento guardado")}
  async function addP(){if(!newP.condition)return;const item={condition:newP.condition,status:newP.status,diagnosed_year:newP.diagnosed_year?parseInt(newP.diagnosed_year):undefined,notes:newP.notes||undefined};const u=[...personal,item];setPersonal(u);setNewP({condition:"",status:"active",diagnosed_year:"",notes:""});await autoSave({personal_history:u});showSaved("Guardado")}
  async function addF(){if(!newF.condition||!newF.relationship)return;const u=[...family,{condition:newF.condition,relationship:newF.relationship,notes:newF.notes||undefined}];setFamily(u);setNewF({condition:"",relationship:"",notes:""});await autoSave({family_history:u});showSaved("Guardado")}
  async function rmA(i:number){const u=allergies.filter((_,j)=>j!==i);setAllergies(u);await autoSave({known_allergies:u})}
  async function rmM(i:number){const u=meds.filter((_,j)=>j!==i);setMeds(u);await autoSave({active_medications:u})}
  async function rmP(i:number){const u=personal.filter((_,j)=>j!==i);setPersonal(u);await autoSave({personal_history:u})}
  async function rmF(i:number){const u=family.filter((_,j)=>j!==i);setFamily(u);await autoSave({family_history:u})}
  async function saveHabits(){await autoSave({});showSaved("Guardado");setOpen(null)}

  async function addEpisode() {
    if (!newEp.start_date) return
    const supabase=createClient()
    const {data:ep}=await supabase.from("patient_episodes").insert({patient_id:patientId,episode_type:newEp.episode_type,start_date:newEp.start_date,end_date:newEp.end_date||null,status:newEp.status,details:{description:newEp.description}}).select().maybeSingle()
    if (ep) setEpisodes(prev=>[ep as Episode,...prev])
    setNewEp({episode_type:"pregnancy",start_date:"",end_date:"",status:"resolved",description:""})
    setShowNewEp(false);showSaved("Episodio guardado")
  }

  async function removeEpisode(id:string) {
    const supabase=createClient()
    await supabase.from("patient_episodes").delete().eq("id",id)
    setEpisodes(prev=>prev.filter(e=>e.id!==id))
  }


  const latest=history[0]
  const prev=history[1]
  const imc=calcIMC(latest?.weight_kg,latest?.height_cm)
  const imcPrev=calcIMC(prev?.weight_kg,prev?.height_cm)

  if (loading) return <div className="px-4 py-8 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"/></div>



  const TABS: {id:Tab;label:string}[]=[
    {id:"demograficos",label:"Demográficos"},
    {id:"antecedentes",label:"Antecedentes"},
    {id:"signos",label:"Signos"},
    {id:"historial",label:"Historial"},
  ]

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button onClick={()=>router.back()} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-900">Historia clínica</p>
          <p className="text-xs text-gray-400">{profile.updated_at?`Actualizada ${fmt(profile.updated_at)} · ${updatedByName}`:"Sin datos previos"}</p>
        </div>
        {savedMsg && <span className="text-xs font-medium text-green-600 px-2 py-1 rounded-lg bg-green-50">{savedMsg}</span>}
      </div>

      {/* TABS — scroll horizontal en móvil */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1" style={{scrollbarWidth:"none"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={cn("flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap",
              tab===t.id?"bg-blue-600 text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: DEMOGRÁFICOS ══ */}
      {tab==="demograficos" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400">Datos personales estables — se ingresan una vez.</p>

          <div className="card overflow-hidden">
            <SectionHeader title="Identificación personal"/>
            <div className="divide-y divide-gray-50">
              {[{l:"Ocupación",v:profile.occupation},{l:"Lugar de trabajo",v:profile.workplace},{l:"Médico tratante",v:profile.treating_doctor},{l:"Referido por",v:profile.referred_by}].filter(r=>r.v).map((r,i)=>(
                <Row key={i} label={r.l}>{r.v}</Row>
              ))}
            </div>
            <button onClick={()=>tog("demo-edit")} className="w-full text-left px-4 py-2.5 border-t border-gray-100 text-xs text-blue-600 font-medium">
              {open==="demo-edit"?"Cerrar edición":"Editar datos demográficos"}
            </button>
            {open==="demo-edit" && (
              <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-3">
                {[{label:"Ocupación",field:"occupation"},{label:"Lugar de trabajo",field:"workplace"},{label:"Médico tratante",field:"treating_doctor"},{label:"Referido por",field:"referred_by"}].map(f=>(
                  <div key={f.field}>
                    <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
                    <input value={(profile as Record<string,string>)[f.field]??""} onChange={e=>setProfile(p=>({...p,[f.field]:e.target.value}))} placeholder="—" className="input-base"/>
                  </div>
                ))}
                <button onClick={saveHabits} className="tap-target rounded-xl bg-blue-600 text-white text-sm font-semibold">Guardar</button>
              </div>
            )}
            <AuditRow at={profile.updated_at} by={updatedByName}/>
          </div>

          <div className="card overflow-hidden">
            <SectionHeader title="Contacto de emergencia"/>
            <div className="divide-y divide-gray-50">
              {[{l:"Nombre",v:profile.emergency_contact_name},{l:"Parentesco",v:profile.emergency_contact_relationship},{l:"Teléfono",v:profile.emergency_contact_phone}].filter(r=>r.v).map((r,i)=>(
                <Row key={i} label={r.l}>{r.v}</Row>
              ))}
              {!profile.emergency_contact_name && <p className="text-xs text-gray-400 italic px-4 py-3">Sin datos</p>}
            </div>
            <button onClick={()=>tog("emerg-edit")} className="w-full text-left px-4 py-2.5 border-t border-gray-100 text-xs text-blue-600 font-medium">
              {open==="emerg-edit"?"Cerrar":"Editar contacto de emergencia"}
            </button>
            {open==="emerg-edit" && (
              <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-3">
                {[{label:"Nombre",field:"emergency_contact_name"},{label:"Parentesco",field:"emergency_contact_relationship"},{label:"Teléfono",field:"emergency_contact_phone"}].map(f=>(
                  <div key={f.field}>
                    <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
                    <input value={(profile as Record<string,string>)[f.field]??""} onChange={e=>setProfile(p=>({...p,[f.field]:e.target.value}))} placeholder="—" className="input-base"/>
                  </div>
                ))}
                <button onClick={saveHabits} className="tap-target rounded-xl bg-blue-600 text-white text-sm font-semibold">Guardar</button>
              </div>
            )}
            <AuditRow at={profile.updated_at} by={updatedByName}/>
          </div>

          <div className="card overflow-hidden">
            <SectionHeader title="Antecedentes familiares"/>
            <div className="divide-y divide-gray-50">
              {family.length===0 && <p className="text-xs text-gray-400 italic px-4 py-3">Sin antecedentes</p>}
              {family.map((f,i)=>(
                <div key={i} className="flex items-start gap-2 px-4 py-2.5 border-t border-gray-50 first:border-t-0">
                  <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{f.relationship}</span>
                  <span className="text-xs text-gray-900 flex-1">{f.condition}{f.notes?` · ${f.notes}`:""}</span>
                  <button onClick={()=>rmF(i)} className="text-xs text-gray-400 px-1">×</button>
                </div>
              ))}
            </div>
            <button onClick={()=>tog("fam-add")} className="w-full text-left px-4 py-2.5 border-t border-gray-100 text-xs text-blue-600 font-medium">+ Agregar antecedente familiar</button>
            {open==="fam-add" && (
              <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input value={newF.condition} onChange={e=>setNewF(p=>({...p,condition:e.target.value}))} placeholder="Condición..." className="input-base text-xs flex-1"/>
                  <input value={newF.relationship} onChange={e=>setNewF(p=>({...p,relationship:e.target.value}))} placeholder="Parentesco" className="input-base text-xs flex-1"/>
                </div>
                <button onClick={addF} className="text-xs text-blue-600 font-medium text-left">+ Agregar</button>
              </div>
            )}
            <AuditRow at={profile.updated_at} by={updatedByName}/>
          </div>
        </div>
      )}

      {/* ══ TAB: ANTECEDENTES ══ */}
      {tab==="antecedentes" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400">Historial médico — se actualiza ante cambios clínicamente relevantes.</p>

          {/* Alergias */}
          <div className="card overflow-hidden">
            <SectionHeader title="Alergias e intolerancias" badge={allergies.length>0?<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ {allergies.length}</span>:undefined}/>
            <div className="divide-y divide-gray-50">
              {allergies.length===0 && <p className="text-xs text-gray-400 italic px-4 py-3">Ninguna registrada</p>}
              {allergies.map((a,i)=>(
                <div key={i} className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-50 first:border-t-0">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-900">{a.substance}</p>
                    <p className="text-xs text-red-600">{a.severity}{a.reaction?` · ${a.reaction}`:""}</p>
                    <p className="text-xs text-red-400 mt-0.5">{a.severity==="severe"?"Contraindicado · alertar siempre":a.severity==="moderate"?"Precaución · verificar alternativas":"Monitorear"}</p>
                  </div>
                  <button onClick={()=>rmA(i)} className="text-xs text-red-400 px-2 py-1">×</button>
                </div>
              ))}
            </div>
            <button onClick={()=>tog("al-add")} className="w-full text-left px-4 py-2.5 border-t border-gray-100 text-xs text-blue-600 font-medium">+ Agregar alergia</button>
            {open==="al-add" && (
              <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2">
                <input value={newA.substance} onChange={e=>setNewA(p=>({...p,substance:e.target.value}))} placeholder="Sustancia..." className="input-base text-xs"/>
                <div className="flex gap-2">
                  <select value={newA.severity} onChange={e=>setNewA(p=>({...p,severity:e.target.value}))} className="input-base text-xs flex-1">
                    <option value="mild">Leve</option><option value="moderate">Moderada</option><option value="severe">Severa</option>
                  </select>
                  <input value={newA.reaction} onChange={e=>setNewA(p=>({...p,reaction:e.target.value}))} placeholder="Reacción" className="input-base text-xs flex-1"/>
                </div>
                <button onClick={addA} className="text-xs text-blue-600 font-medium text-left">+ Agregar</button>
              </div>
            )}
            <AuditRow at={profile.updated_at} by={updatedByName}/>
          </div>

          {/* Medicación */}
          <div className="card overflow-hidden">
            <SectionHeader title="Medicación habitual" badge={meds.length>0?<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{meds.length}</span>:undefined}/>
            <div className="divide-y divide-gray-50">
              {meds.length===0 && <p className="text-xs text-gray-400 italic px-4 py-3">Ninguna</p>}
              {meds.map((m,i)=>(
                <div key={i} className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-50 first:border-t-0">
                  <div className="flex-1"><p className="text-xs font-semibold text-blue-900">{m.name}</p><p className="text-xs text-blue-600">{m.dose?`${m.dose} · `:""}{m.frequency??""}</p></div>
                  <button onClick={()=>rmM(i)} className="text-xs text-blue-400 px-2 py-1">×</button>
                </div>
              ))}
            </div>
            <button onClick={()=>tog("med-add")} className="w-full text-left px-4 py-2.5 border-t border-gray-100 text-xs text-blue-600 font-medium">+ Agregar medicamento</button>
            {open==="med-add" && (
              <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2">
                <input value={newM.name} onChange={e=>setNewM(p=>({...p,name:e.target.value}))} placeholder="Medicamento..." className="input-base text-xs"/>
                <div className="flex gap-2">
                  <input value={newM.dose} onChange={e=>setNewM(p=>({...p,dose:e.target.value}))} placeholder="Dosis" className="input-base text-xs flex-1"/>
                  <input value={newM.frequency} onChange={e=>setNewM(p=>({...p,frequency:e.target.value}))} placeholder="Frecuencia" className="input-base text-xs flex-1"/>
                </div>
                <button onClick={addM} className="text-xs text-blue-600 font-medium text-left">+ Agregar</button>
              </div>
            )}
            <AuditRow at={profile.updated_at} by={updatedByName}/>
          </div>

          {/* Condiciones médicas */}
          <div className="card overflow-hidden">
            <SectionHeader title="Condiciones médicas"/>
            <div className="px-4 py-3 flex flex-col gap-2">
              {personal.length===0 && <p className="text-xs text-gray-400 italic">Sin condiciones registradas</p>}
              {personal.map((h,i)=>(
                <div key={i} className="flex items-start justify-between px-3 py-2.5 rounded-xl" style={{background:h.status==="active"?"#FAEEDA":h.status==="chronic"?"#F1EFE8":"#EAF3DE"}}>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{color:h.status==="active"?"#633806":h.status==="chronic"?"#444441":"#27500A"}}>{h.condition}</p>
                    <p className="text-xs" style={{color:h.status==="active"?"#854F0B":h.status==="chronic"?"#5F5E5A":"#3B6D11"}}>{h.status==="active"?"Activo":h.status==="chronic"?"Crónico":"Resuelto"}{h.diagnosed_year?` · desde ${h.diagnosed_year}`:""}{h.notes?` · ${h.notes}`:""}</p>
                  </div>
                  <button onClick={()=>rmP(i)} className="text-xs px-2 py-1 opacity-60">×</button>
                </div>
              ))}
            </div>
            <button onClick={()=>tog("ph-add")} className="w-full text-left px-4 py-2.5 border-t border-gray-100 text-xs text-blue-600 font-medium">+ Agregar condición</button>
            {open==="ph-add" && (
              <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2">
                <input value={newP.condition} onChange={e=>setNewP(p=>({...p,condition:e.target.value}))} placeholder="Condición..." className="input-base text-xs"/>
                <div className="flex gap-2">
                  <select value={newP.status} onChange={e=>setNewP(p=>({...p,status:e.target.value}))} className="input-base text-xs flex-1">
                    <option value="active">Activo</option><option value="resolved">Resuelto</option><option value="chronic">Crónico</option>
                  </select>
                  <input type="number" value={newP.diagnosed_year} onChange={e=>setNewP(p=>({...p,diagnosed_year:e.target.value}))} placeholder="Año" className="input-base text-xs w-20"/>
                </div>
                <input value={newP.notes} onChange={e=>setNewP(p=>({...p,notes:e.target.value}))} placeholder="Notas..." className="input-base text-xs"/>
                <button onClick={addP} className="text-xs text-blue-600 font-medium text-left">+ Agregar</button>
              </div>
            )}
            <AuditRow at={profile.updated_at} by={updatedByName}/>
          </div>

          {/* Episodios médicos previos */}
          <div className="card overflow-hidden">
            <SectionHeader title="Episodios médicos previos" badge={
              <button onClick={()=>setShowNewEp(!showNewEp)} className="text-xs text-blue-600 font-medium">+ Agregar</button>
            }/>
            {showNewEp && (
              <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Tipo</label>
                    <select value={newEp.episode_type} onChange={e=>setNewEp(p=>({...p,episode_type:e.target.value}))} className="input-base">
                      {EP_TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Estado</label>
                    <select value={newEp.status} onChange={e=>setNewEp(p=>({...p,status:e.target.value}))} className="input-base">
                      <option value="resolved">Resuelto</option>
                      <option value="active">Activo</option>
                      <option value="unknown">Desconocido</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Fecha inicio</label>
                    <input type="date" value={newEp.start_date} onChange={e=>setNewEp(p=>({...p,start_date:e.target.value}))} className="input-base"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Fecha fin</label>
                    <input type="date" value={newEp.end_date} onChange={e=>setNewEp(p=>({...p,end_date:e.target.value}))} className="input-base"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Descripción</label>
                  <input value={newEp.description} onChange={e=>setNewEp(p=>({...p,description:e.target.value}))} placeholder="Detalles del episodio..." className="input-base"/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={()=>setShowNewEp(false)} className="tap-target rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">Cancelar</button>
                  <button onClick={addEpisode} className="tap-target rounded-xl bg-blue-600 text-white text-sm font-semibold">Guardar</button>
                </div>
              </div>
            )}
            {episodes.length===0 && !showNewEp && <p className="text-xs text-gray-400 italic px-4 py-3">Sin episodios registrados · agrega embarazos, cirugías o lesiones importantes</p>}
            {episodes.length>0 && (
              <div className="p-4 flex flex-col gap-0">
                {episodes.map((ep,i)=>{
                  const et=EP_TYPES.find(t=>t.v===ep.episode_type)??EP_TYPES[EP_TYPES.length-1]
                  const isLast=i===episodes.length-1
                  return (
                    <div key={ep.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{background:et.color}}/>
                        {!isLast && <div className="w-px flex-1 mt-1 mb-1" style={{background:"var(--color-border-tertiary)"}}/>}
                      </div>
                      <div className={cn("flex-1",!isLast?"pb-3":"")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{background:et.bg,color:et.tc}}>{et.l}</span>
                              <span className="text-xs text-gray-400">{ep.start_date}{ep.end_date?` – ${ep.end_date}`:""}</span>
                              <span className={cn("text-xs font-medium",ep.status==="active"?"text-green-700":"text-gray-400")}>{ep.status==="active"?"● Activo":"○ Resuelto"}</span>
                            </div>
                            {ep.details?.description && <p className="text-xs text-gray-700">{String(ep.details.description)}</p>}
                          </div>
                          <button onClick={()=>removeEpisode(ep.id)} className="text-xs text-gray-400 px-1 py-0.5 flex-shrink-0">×</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <AuditRow at={profile.updated_at} by={updatedByName}/>
          </div>

          {/* Hábitos */}
          <div className="card overflow-hidden">
            <SectionHeader title="Hábitos generales"/>
            {[{label:"Tabaquismo",field:"smoking_status",opts:[["never","Nunca"],["former","Ex-fumador"],["current","Fumador activo"]]},{label:"Alcohol",field:"alcohol_status",opts:[["none","Ninguno"],["occasional","Ocasional"],["moderate","Moderado"],["heavy","Alto"]]}].map(f=>(
              <div key={f.field} className="px-4 py-2.5 border-t border-gray-50 first:border-t-0">
                <p className="text-xs text-gray-400 mb-1">{f.label}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {f.opts.map(([v,l])=>(
                    <button key={v} type="button" onClick={async()=>{
                      const updated = {...profile,[f.field]:v}
                      setProfile(updated)
                      await upsertAnamnesisProfile({...updated,patient_id:patientId,known_allergies:allergies,active_medications:meds,personal_history:personal,family_history:family})
                      showSaved("Guardado")
                    }}
                      className={cn("px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all",
                        (profile as Record<string,string>)[f.field]===v?"bg-blue-50 border-blue-500 text-blue-800 border-[1.5px]":"border-gray-200 text-gray-600")}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <AuditRow at={profile.updated_at} by={updatedByName}/>
          </div>
        </div>
      )}

      {/* ══ TAB: SIGNOS ══ */}
      {tab==="signos" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400">Datos variables por consulta — último registro{latest?.recorded_at?` del ${fmt(latest.recorded_at)}`:""}.</p>

          {/* Embarazo — solo para mujeres */}
          {patientSex !== "male" && (
          <div className="card overflow-hidden border-blue-300">
            <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Estado reproductivo · verificar en cada consulta</p>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-600 text-white">Crítico</span>
            </div>
            <Row label="Embarazo actual"><span className="font-medium text-blue-800">{latest?.pregnancy_status==="yes"?`Sí · ${latest.gestation_months??0} meses`:latest?.pregnancy_status==="no"?"No":latest?.pregnancy_status==="not_applicable"?"No aplica":"Sin datos"}</span></Row>
            {episodes.filter(e=>e.episode_type==="pregnancy").length>0 && (
              <Row label="Historial">{episodes.filter(e=>e.episode_type==="pregnancy").length} embarazo{episodes.filter(e=>e.episode_type==="pregnancy").length>1?"s":""} previo{episodes.filter(e=>e.episode_type==="pregnancy").length>1?"s":""} registrado{episodes.filter(e=>e.episode_type==="pregnancy").length>1?"s":""}</Row>
            )}
          </div>
          )}

          {/* Signos vitales y medidas */}
          <div className="card overflow-hidden">
            <SectionHeader title="Signos vitales y medidas"/>
            {latest ? (
              <>
                <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
                  <div className="p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Peso</p>
                    <p className="text-xl font-semibold text-gray-900">{latest.weight_kg?`${latest.weight_kg} kg`:"—"}</p>
                    {prev?.weight_kg && latest.weight_kg && (
                      <p className={cn("text-xs mt-0.5",Number(latest.weight_kg)>Number(prev.weight_kg)?"text-amber-600":"text-green-600")}>
                        {Number(latest.weight_kg)>Number(prev.weight_kg)?"▲":"▼"} {Math.abs(Number(latest.weight_kg)-Number(prev.weight_kg)).toFixed(1)} kg
                      </p>
                    )}
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">IMC</p>
                    <p className="text-xl font-semibold" style={{color:imc?imcColor(imc):"var(--color-text-primary)"}}>{imc??"—"}</p>
                    <p className="text-xs mt-0.5" style={{color:imc?imcColor(imc):"var(--color-text-secondary)"}}>{imc?imcLabel(imc):"Sin datos"}</p>
                  </div>
                </div>
                <Row label="Talla">{latest.height_cm?`${latest.height_cm} cm`:"—"}</Row>
              </>
            ) : <p className="text-xs text-gray-400 italic px-4 py-3">Sin registros aún</p>}
          </div>

          {/* Escalas funcionales */}
          <div className="card overflow-hidden">
            <SectionHeader title="Escalas funcionales"/>
            {latest ? (
              <div className="divide-y divide-gray-50">
                {[
                  {l:"Energía",k:"energy_level" as keyof AnamnesisSnapshot,color:"#3B6D11",prevK:"energy_level"},
                  {l:"Estrés",k:"stress_level" as keyof AnamnesisSnapshot,color:"#854F0B",prevK:"stress_level"},
                  {l:"Constipación",k:"constipation_level" as keyof AnamnesisSnapshot,color:"#185FA5",prevK:"constipation_level"},
                ].map(({l,k,color,prevK})=>{
                  const val = latest[k] as number|undefined
                  const prevVal = prev?.[prevK as keyof AnamnesisSnapshot] as number|undefined
                  if (val===undefined) return null
                  return (
                    <div key={l} className="flex items-start gap-2 px-4 py-2.5 border-t border-gray-50 first:border-t-0">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{l}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Meter value={val} color={color}/>
                          <span className="text-xs font-medium" style={{color}}>{val}/10</span>
                          {prevVal!==undefined && <span className="text-xs text-gray-400">era {prevVal}</span>}
                        </div>
                        {prevVal!==undefined && val!==prevVal && (
                          <p className={cn("text-xs mt-0.5",val>prevVal?"text-amber-600":"text-green-600")}>
                            {val>prevVal?"▲":"▼"} {Math.abs(val-prevVal)} punto{Math.abs(val-prevVal)!==1?"s":""}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
                <Row label="Sueño">
                  <span>{latest.sleep_quality?`${tr(SLEEP_QUALITY_LABELS,latest.sleep_quality as string)}${latest.sleep_hours?` · ${latest.sleep_hours}h`:""}${latest.wake_refreshed?` · renovado: ${tr(YES_NO_LABELS,latest.wake_refreshed as string)}`:""}` : "—"}</span>
                  {prev?.sleep_hours && prev.sleep_hours!==latest.sleep_hours && <span className="text-xs text-gray-400">Anterior: {prev.sleep_hours}h</span>}
                </Row>
              </div>
            ) : <p className="text-xs text-gray-400 italic px-4 py-3">Sin registros aún</p>}
          </div>

          {/* Actividad */}
          <div className="card overflow-hidden">
            <SectionHeader title="Actividad física"/>
            {latest ? (
              <div className="divide-y divide-gray-50">
                <Row label="Nivel">{latest.activity_level??"—"}</Row>
                <Row label="Deporte">{latest.does_sport?`Sí · ${Array.isArray(latest.sports_practiced)?(latest.sports_practiced as string[]).join(", "):""}${latest.sport_frequency?` · ${latest.sport_frequency}/sem`:""}`:"No practica"}</Row>
                <Row label="Evacuación">{latest.bowel_habit?`${latest.bowel_habit}${latest.daily_bowel_movement?` · ${latest.daily_bowel_movement==="yes"?"diariamente":latest.daily_bowel_movement}`:""}`:"—"}</Row>
              </div>
            ) : <p className="text-xs text-gray-400 italic px-4 py-3">Sin registros aún</p>}
          </div>

          {/* Nutrición */}
          <div className="card overflow-hidden">
            <SectionHeader title="Nutrición e hidratación"/>
            {latest ? (
              <div className="divide-y divide-gray-50">
                <Row label="Tipo de dieta">{latest.diet_type?`${latest.diet_type}${latest.diet_quality?` · calidad ${latest.diet_quality}`:""}`:  "—"}</Row>
                {Array.isArray(latest.breakfast) && (latest.breakfast as string[]).length>0 && (
                  <div className="flex items-start gap-2 px-4 py-2.5 border-t border-gray-50">
                    <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Desayuno</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {(latest.breakfast as string[]).map((v,i)=><span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">{v}</span>)}
                    </div>
                  </div>
                )}
                {Array.isArray(latest.lunch) && (latest.lunch as string[]).length>0 && (
                  <div className="flex items-start gap-2 px-4 py-2.5 border-t border-gray-50">
                    <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Almuerzo</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {(latest.lunch as string[]).map((v,i)=><span key={i} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">{v}</span>)}
                    </div>
                  </div>
                )}
                {Array.isArray(latest.dinner) && (latest.dinner as string[]).length>0 && (
                  <div className="flex items-start gap-2 px-4 py-2.5 border-t border-gray-50">
                    <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Cena</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {(latest.dinner as string[]).map((v,i)=><span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">{v}</span>)}
                    </div>
                  </div>
                )}
                <Row label="Agua">{latest.water_intake??"—"}</Row>
              </div>
            ) : <p className="text-xs text-gray-400 italic px-4 py-3">Sin registros aún</p>}
          </div>

          {/* Salud mental */}
          <div className="card overflow-hidden">
            <SectionHeader title="Salud mental y estado de ánimo"/>
            {latest ? (
              <div className="divide-y divide-gray-50">
                <Row label="Exposición">{tr(YES_NO_LABELS,latest.stress_exposure as string)}</Row>
                {Array.isArray(latest.stress_coping) && (latest.stress_coping as string[]).length>0 && (
                  <div className="flex items-start gap-2 px-4 py-2.5 border-t border-gray-50">
                    <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">Afrontamiento</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {(latest.stress_coping as string[]).map((v,i)=><span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{v}</span>)}
                    </div>
                  </div>
                )}
                <Row label="Ánimo de hoy">{latest.today_mood?<span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-800 border border-amber-200">{tr(MOOD_LABELS,latest.today_mood as string)}</span>:"—"}</Row>
                <Row label="Motivo">{latest.main_complaint??"—"}</Row>
                {latest.notes && <Row label="Observaciones">{latest.notes as string}</Row>}
                {latest.other_history && <Row label="Otros antecedentes">{latest.other_history as string}</Row>}
              </div>
            ) : <p className="text-xs text-gray-400 italic px-4 py-3">Sin registros aún</p>}
          </div>
        </div>
      )}

      {/* ══ TAB: HISTORIAL ══ */}
      {tab==="historial" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400">Todos los registros por consulta — más reciente primero.</p>
          {history.length===0 && (
            <div className="card p-8 text-center">
              <p className="text-sm text-gray-400">Sin registros</p>
              <p className="text-xs text-gray-400 mt-1">Crea el primer registro desde "Nuevo"</p>
            </div>
          )}
          {history.map((h,i)=>{
            const imc2=calcIMC(h.weight_kg,h.height_cm)
            const pn=h.recorded_by?(profNames[h.recorded_by]??")"):""
            const k=h.id??String(i)
            const isExp=histExpanded===k
            return (
              <div key={k} className={cn("card overflow-hidden",i===0?"border-green-300":"")}>
                <button onClick={()=>setHistExpanded(isExp?null:k)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div>
                    {i===0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 mb-1 inline-flex items-center gap-1"><span style={{width:5,height:5,borderRadius:"50%",background:"#27500A",display:"inline-block"}}></span>Más reciente</span>}
                    <p className="text-xs font-semibold text-gray-900">{h.recorded_at?fmt(h.recorded_at):"—"} · {h.recorded_at?fmtTime(h.recorded_at):""}</p>
                    <p className="text-xs text-gray-400">{h.evaluation_id?`${clinicalId(h.evaluation_id,h.recorded_at??"")} · `:""}{pn}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-700">{h.weight_kg?`${h.weight_kg} kg`:"—"}</p>
                      <p className="text-xs text-gray-400">{imc2?`IMC ${imc2}`:""}{h.stress_level!==undefined?` · E:${h.stress_level}`:""}</p>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("text-gray-400 transition-transform",isExp?"rotate-180":"")}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </button>
                {isExp && (
                  <div className="border-t border-gray-100">
                    <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                      {[{l:"Peso",v:h.weight_kg?`${h.weight_kg}kg`:"—"},{l:"Talla",v:h.height_cm?`${h.height_cm}cm`:"—"},{l:"IMC",v:imc2??"—"},{l:"Estrés",v:h.stress_level!==undefined?`${h.stress_level}/10`:"—"}].map((m,j)=>(
                        <div key={j} className="p-3 text-center"><p className="text-sm font-semibold text-gray-900">{m.v}</p><p className="text-xs text-gray-400">{m.l}</p></div>
                      ))}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {[
                        ...(patientSex!=="male"?[{l:"Embarazo",v:h.pregnancy_status==="yes"?`Sí · ${h.gestation_months??0} meses`:tr(PREGNANCY_LABELS,h.pregnancy_status)}]:[]),
                        {l:"Actividad",v:tr(ACTIVITY_LABELS,h.activity_level)},
                        {l:"Dominancia",v:tr(DOMINANCE_LABELS,h.dominance as string)},
                        {l:"Deporte",v:h.does_sport?`Sí${Array.isArray(h.sports_practiced)&&(h.sports_practiced as string[]).length>0?` · ${trArr(SPORT_LABELS,h.sports_practiced as string[])}` :""}${h.sport_frequency?` · ${h.sport_frequency}d/sem`:""}${h.sport_performance?` · ${tr(SPORT_PERF_LABELS,h.sport_performance as string)}`:""}` :"No practica"},
                        {l:"Dieta",v:h.diet_type?`${tr(DIET_TYPE_LABELS,h.diet_type)}${h.diet_quality?` · ${tr(DIET_QUALITY_LABELS,h.diet_quality)}`:""}`:"—"},
                        {l:"Desayuno",v:trArr(FOOD_LABELS,h.breakfast as string[])},
                        {l:"Almuerzo",v:trArr(FOOD_LABELS,h.lunch as string[])},
                        {l:"Cena",v:trArr(FOOD_LABELS,h.dinner as string[])},
                        {l:"Agua",v:tr(WATER_LABELS,h.water_intake as string)},
                        {l:"Evacuación",v:h.bowel_habit?`${tr(BOWEL_HABIT_LABELS,h.bowel_habit as string)}${h.daily_bowel_movement?` · ${tr(YES_NO_LABELS,h.daily_bowel_movement as string)} diariamente`:""}${h.constipation_level!==undefined?` · constipación ${h.constipation_level}/10`:""}`:undefined},
                        {l:"Sueño",v:h.sleep_quality?`${tr(SLEEP_QUALITY_LABELS,h.sleep_quality as string)}${h.sleep_hours?` · ${h.sleep_hours}h`:""}${h.wake_refreshed?` · renovado: ${tr(YES_NO_LABELS,h.wake_refreshed as string)}`:""}`:undefined},
                        {l:"Energía",v:h.energy_level!==undefined?`${h.energy_level}/10${h.energy_during_day?` · durante el día: ${tr(YES_NO_LABELS,h.energy_during_day as string)}`:""}`:undefined},
                        {l:"Estrés",v:h.stress_level!==undefined?`${h.stress_level}/10${h.stress_exposure?` · expuesto: ${tr(YES_NO_LABELS,h.stress_exposure as string)}`:""}`:undefined},
                        {l:"Afrontamiento",v:trArr(STRESS_COPE_LABELS,h.stress_coping as string[])},
                        {l:"Ánimo",v:tr(MOOD_LABELS,h.today_mood as string)},
                        {l:"Motivo",v:h.main_complaint as string},
                        {l:"Antecedentes",v:Array.isArray(h.personal_history_snapshot)&&(h.personal_history_snapshot as string[]).filter(v=>v!=="none").length>0?trArr(PERSONAL_HISTORY_LABELS,(h.personal_history_snapshot as string[]).filter(v=>v!=="none")):undefined},
                        {l:"Notas",v:h.notes as string},{l:"Otros",v:h.other_history as string},
                      ].filter(r=>r.v&&r.v!=="—").map((r,j)=>(
                        <div key={j} className="flex items-start gap-3 px-4 py-2.5">
                          <span className="text-xs text-gray-400 w-24 flex-shrink-0">{r.l}</span>
                          <span className="text-xs text-gray-700 flex-1">{r.v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span className="text-xs text-gray-400">{h.recorded_at?fmt(h.recorded_at):""} · {h.recorded_at?fmtTime(h.recorded_at):""}{pn?` · ${pn}`:""}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
