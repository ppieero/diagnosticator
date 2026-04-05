"use client"
import { useState } from "react"
import type { BodyMapMarker, BodyMapMarkerType } from "@/types/domain"
import { cn } from "@/lib/utils"

interface BodyMapFieldProps {
  value?: BodyMapMarker[]
  onChange: (val: BodyMapMarker[]) => void
  disabled?: boolean
}

const MARKER_TYPES: { value: BodyMapMarkerType; label: string; color: string }[] = [
  { value: "primary",     label: "Dolor primario",   color: "#dc2626" },
  { value: "irradiated",  label: "Irradiado",        color: "#ea580c" },
  { value: "paresthesia", label: "Parestesia",        color: "#7c3aed" },
  { value: "numbness",    label: "Entumecimiento",    color: "#2563eb" },
]

const ZONES: Record<string, { label: string; front?: [number,number]; back?: [number,number] }> = {
  head_front:      { label: "Cabeza",           front: [120,18] },
  neck_front:      { label: "Cuello (ant)",     front: [120,48] },
  chest_r:         { label: "Tórax derecho",    front: [90,80] },
  chest_l:         { label: "Tórax izquierdo",  front: [150,80] },
  abdomen_upper:   { label: "Abdomen sup",      front: [120,115] },
  abdomen_lower:   { label: "Abdomen inf",      front: [120,145] },
  shoulder_r:      { label: "Hombro derecho",   front: [65,68] },
  shoulder_l:      { label: "Hombro izquierdo", front: [175,68] },
  arm_r:           { label: "Brazo derecho",    front: [55,100] },
  arm_l:           { label: "Brazo izquierdo",  front: [185,100] },
  forearm_r:       { label: "Antebrazo der",    front: [48,130] },
  forearm_l:       { label: "Antebrazo izq",    front: [192,130] },
  hand_r:          { label: "Mano derecha",     front: [42,158] },
  hand_l:          { label: "Mano izquierda",   front: [198,158] },
  hip_r:           { label: "Cadera derecha",   front: [90,170] },
  hip_l:           { label: "Cadera izquierda", front: [150,170] },
  thigh_r:         { label: "Muslo derecho",    front: [92,200] },
  thigh_l:         { label: "Muslo izquierdo",  front: [148,200] },
  knee_r:          { label: "Rodilla derecha",  front: [92,232] },
  knee_l:          { label: "Rodilla izquierda",front: [148,232] },
  leg_r:           { label: "Pierna derecha",   front: [92,262] },
  leg_l:           { label: "Pierna izquierda", front: [148,262] },
  foot_r:          { label: "Pie derecho",      front: [88,292] },
  foot_l:          { label: "Pie izquierdo",    front: [152,292] },
  head_back:       { label: "Cabeza (post)",                    back: [120,18] },
  neck_back:       { label: "Cuello (post)",                    back: [120,48] },
  shoulder_r_back: { label: "Hombro der (post)",               back: [65,68] },
  shoulder_l_back: { label: "Hombro izq (post)",               back: [175,68] },
  upper_back_r:    { label: "Espalda sup der",                  back: [90,90] },
  upper_back_l:    { label: "Espalda sup izq",                  back: [150,90] },
  lower_back_r:    { label: "Lumbar derecho",                   back: [95,130] },
  lower_back_l:    { label: "Lumbar izquierdo",                 back: [145,130] },
  sacrum:          { label: "Sacro/Glúteo",                     back: [120,158] },
  glute_r:         { label: "Glúteo derecho",                   back: [95,170] },
  glute_l:         { label: "Glúteo izquierdo",                 back: [145,170] },
  hamstring_r:     { label: "Isquios derecho",                  back: [92,205] },
  hamstring_l:     { label: "Isquios izquierdo",                back: [148,205] },
  knee_back_r:     { label: "Hueco poplíteo der",               back: [92,232] },
  knee_back_l:     { label: "Hueco poplíteo izq",               back: [148,232] },
  calf_r:          { label: "Gemelo derecho",                   back: [92,262] },
  calf_l:          { label: "Gemelo izquierdo",                 back: [148,262] },
  heel_r:          { label: "Talón derecho",                    back: [88,295] },
  heel_l:          { label: "Talón izquierdo",                  back: [152,295] },
}

function BodySVG({
  view, markers, activeType, onZoneClick, disabled
}: {
  view: "front" | "back"
  markers: BodyMapMarker[]
  activeType: BodyMapMarkerType
  onZoneClick: (zone: string, x: number, y: number, view: "front"|"back") => void
  disabled?: boolean
}) {
  const viewMarkers = markers.filter(m => m.view === view)

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (disabled) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 240)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 320)
    const zoneKey = findZone(x, y, view)
    if (zoneKey) onZoneClick(zoneKey, x, y, view)
  }

  return (
    <svg
      viewBox="0 0 240 320"
      width="100%"
      onClick={handleClick}
      style={{ cursor: disabled ? "default" : "crosshair", maxWidth: 200 }}
    >
      {view === "front" ? <FrontBody /> : <BackBody />}
      {viewMarkers.map((m, i) => {
        const typeConfig = MARKER_TYPES.find(t => t.value === m.type)
        return (
          <g key={i}>
            <circle
              cx={m.x} cy={m.y} r={10}
              fill={typeConfig?.color ?? "#dc2626"}
              opacity={0.7}
              stroke="white"
              strokeWidth={1.5}
            />
            <text
              x={m.x} y={m.y + 4}
              textAnchor="middle"
              fontSize={9}
              fill="white"
              fontWeight="bold"
            >{m.intensity}</text>
          </g>
        )
      })}
    </svg>
  )
}

function findZone(x: number, y: number, view: "front"|"back"): string | null {
  let closest: string | null = null
  let minDist = 25
  Object.entries(ZONES).forEach(([key, zone]) => {
    const coord = view === "front" ? zone.front : zone.back
    if (!coord) return
    const dist = Math.sqrt((x - coord[0])**2 + (y - coord[1])**2)
    if (dist < minDist) { minDist = dist; closest = key }
  })
  return closest
}

function FrontBody() {
  return (
    <g stroke="#9ca3af" strokeWidth="1" fill="#f3f4f6">
      <ellipse cx="120" cy="22" rx="18" ry="20" />
      <rect x="104" y="44" width="32" height="12" rx="6" />
      <path d="M88 58 Q70 62 62 120 L78 122 Q82 90 96 80 L96 170 L88 172 L88 300 L102 300 L102 230 L120 232 L138 230 L138 300 L152 300 L152 172 L144 170 L144 80 Q158 90 162 122 L178 120 Q170 62 152 58 Z" />
      <line x1="104" y1="58" x2="104" y2="170" strokeDasharray="2,2" />
      <line x1="136" y1="58" x2="136" y2="170" strokeDasharray="2,2" />
      <text x="120" y="315" textAnchor="middle" fontSize="9" fill="#6b7280" stroke="none">ANTERIOR</text>
    </g>
  )
}

function BackBody() {
  return (
    <g stroke="#9ca3af" strokeWidth="1" fill="#e5e7eb">
      <ellipse cx="120" cy="22" rx="18" ry="20" />
      <rect x="104" y="44" width="32" height="12" rx="6" />
      <path d="M88 58 Q70 62 62 120 L78 122 Q82 90 96 80 L96 170 L88 172 L88 300 L102 300 L102 230 L120 232 L138 230 L138 300 L152 300 L152 172 L144 170 L144 80 Q158 90 162 122 L178 120 Q170 62 152 58 Z" />
      <text x="120" y="315" textAnchor="middle" fontSize="9" fill="#6b7280" stroke="none">POSTERIOR</text>
    </g>
  )
}

export function BodyMapField({ value = [], onChange, disabled }: BodyMapFieldProps) {
  const [activeType, setActiveType] = useState<BodyMapMarkerType>("primary")
  const [activeIntensity, setActiveIntensity] = useState(5)
  const [activeView, setActiveView] = useState<"front"|"back">("front")

  function handleZoneClick(zone: string, x: number, y: number, view: "front"|"back") {
    const existing = value.findIndex(m => m.zone === zone && m.view === view)
    if (existing >= 0) {
      onChange(value.filter((_, i) => i !== existing))
    } else {
      onChange([...value, { zone, type: activeType, intensity: activeIntensity, x, y, view }])
    }
  }

  function removeAll() { onChange([]) }

  const zoneLabels = value.map(m => ZONES[m.zone]?.label ?? m.zone)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {MARKER_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            disabled={disabled}
            onClick={() => setActiveType(t.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
              activeType === t.value ? "border-gray-800 shadow-sm" : "border-gray-200"
            )}
            style={activeType === t.value ? { background: t.color + "20", borderColor: t.color, color: t.color } : {}}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 flex-shrink-0">Intensidad:</span>
        <input
          type="range" min={1} max={10} value={activeIntensity}
          onChange={e => setActiveIntensity(Number(e.target.value))}
          className="flex-1" disabled={disabled}
        />
        <span className="text-sm font-bold text-gray-700 w-4">{activeIntensity}</span>
      </div>

      <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 w-fit">
        {(["front","back"] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setActiveView(v)}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
              activeView === v ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"
            )}
          >
            {v === "front" ? "Anterior" : "Posterior"}
          </button>
        ))}
      </div>

      <div className="flex gap-6 items-start">
        <BodySVG
          view={activeView}
          markers={value}
          activeType={activeType}
          onZoneClick={handleZoneClick}
          disabled={disabled}
        />
        <div className="flex-1 flex flex-col gap-2">
          <p className="text-xs text-gray-500 font-medium">Zonas marcadas ({value.length})</p>
          {value.length === 0 && (
            <p className="text-xs text-gray-400">Click en el cuerpo para marcar zonas</p>
          )}
          {value.map((m, i) => {
            const typeConfig = MARKER_TYPES.find(t => t.value === m.type)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeConfig?.color }} />
                <span className="flex-1 text-gray-700">{ZONES[m.zone]?.label ?? m.zone}</span>
                <span className="text-gray-400">{m.view === "front" ? "ant" : "post"}</span>
                <span className="font-semibold" style={{ color: typeConfig?.color }}>{m.intensity}/10</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                    className="text-gray-300 hover:text-red-500 ml-1"
                  >×</button>
                )}
              </div>
            )
          })}
          {value.length > 0 && !disabled && (
            <button
              type="button"
              onClick={removeAll}
              className="text-xs text-red-400 hover:text-red-600 mt-2 text-left"
            >
              Limpiar todo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}