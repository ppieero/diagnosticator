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
  { value: "primary",     label: "Dolor local",      color: "#dc2626" },
  { value: "superficial", label: "Superficial",       color: "#f97316" },
  { value: "deep",        label: "Profundo",          color: "#b45309" },
  { value: "irradiated",  label: "Irradiado",        color: "#ea580c" },
  { value: "paresthesia", label: "Parestesia",        color: "#7c3aed" },
  { value: "numbness",    label: "Entumecimiento",    color: "#2563eb" },
]

type ViewType = "front" | "back" | "lateral_right" | "lateral_left"

const VIEW_LABELS: Record<ViewType, string> = {
  front: "Anterior", back: "Posterior",
  lateral_right: "Lat. Der", lateral_left: "Lat. Izq"
}

const ZONES: Record<string, { label: string; front?: [number,number]; back?: [number,number]; lateral_right?: [number,number]; lateral_left?: [number,number] }> = {
  head_front:      { label: "Cabeza",              front: [120,18], lateral_right: [120,18], lateral_left: [120,18] },
  neck_front:      { label: "Cuello (ant)",         front: [120,48] },
  neck_back:       { label: "Cuello (post)",                          back: [120,48] },
  neck_lat:        { label: "Cuello lateral",                                              lateral_right: [120,48], lateral_left: [120,48] },
  chest_r:         { label: "Tórax derecho",        front: [90,80] },
  chest_l:         { label: "Tórax izquierdo",      front: [150,80] },
  chest_lat:       { label: "Tórax lateral",                                               lateral_right: [100,85], lateral_left: [140,85] },
  abdomen_upper:   { label: "Abdomen sup",          front: [120,115] },
  abdomen_lower:   { label: "Abdomen inf",          front: [120,145] },
  abdomen_lat:     { label: "Flanco lateral",                                              lateral_right: [100,125], lateral_left: [140,125] },
  shoulder_r:      { label: "Hombro derecho",       front: [65,68],  back: [65,68],  lateral_right: [72,68] },
  shoulder_l:      { label: "Hombro izquierdo",     front: [175,68], back: [175,68], lateral_left: [168,68] },
  arm_r:           { label: "Brazo derecho",        front: [55,100], back: [55,100], lateral_right: [62,100] },
  arm_l:           { label: "Brazo izquierdo",      front: [185,100],back: [185,100],lateral_left: [178,100] },
  forearm_r:       { label: "Antebrazo der",        front: [48,130], back: [48,130], lateral_right: [55,130] },
  forearm_l:       { label: "Antebrazo izq",        front: [192,130],back: [192,130],lateral_left: [185,130] },
  hand_r:          { label: "Mano derecha",         front: [42,158], back: [42,158], lateral_right: [50,158] },
  hand_l:          { label: "Mano izquierda",       front: [198,158],back: [198,158],lateral_left: [190,158] },
  hip_r:           { label: "Cadera derecha",       front: [90,170], back: [95,170], lateral_right: [88,170] },
  hip_l:           { label: "Cadera izquierda",     front: [150,170],back: [145,170],lateral_left: [152,170] },
  thigh_r:         { label: "Muslo derecho",        front: [92,200], back: [92,205], lateral_right: [90,200] },
  thigh_l:         { label: "Muslo izquierdo",      front: [148,200],back: [148,205],lateral_left: [150,200] },
  knee_r:          { label: "Rodilla derecha",      front: [92,232], back: [92,232], lateral_right: [90,232] },
  knee_l:          { label: "Rodilla izquierda",    front: [148,232],back: [148,232],lateral_left: [150,232] },
  leg_r:           { label: "Pierna derecha",       front: [92,262], back: [92,262], lateral_right: [90,262] },
  leg_l:           { label: "Pierna izquierda",     front: [148,262],back: [148,262],lateral_left: [150,262] },
  foot_r:          { label: "Pie derecho",          front: [88,292], back: [88,295], lateral_right: [100,292] },
  foot_l:          { label: "Pie izquierdo",        front: [152,292],back: [152,295],lateral_left: [140,292] },
  upper_back_r:    { label: "Espalda sup der",                        back: [90,90] },
  upper_back_l:    { label: "Espalda sup izq",                        back: [150,90] },
  lower_back_r:    { label: "Lumbar derecho",                         back: [95,130] },
  lower_back_l:    { label: "Lumbar izquierdo",                       back: [145,130] },
  lumbar_lat:      { label: "Lumbar lateral",                                              lateral_right: [100,140], lateral_left: [140,140] },
  sacrum:          { label: "Sacro/Glúteo",                           back: [120,158] },
  glute_r:         { label: "Glúteo derecho",                         back: [95,170] },
  glute_l:         { label: "Glúteo izquierdo",                       back: [145,170] },
  hamstring_r:     { label: "Isquios derecho",                        back: [92,205] },
  hamstring_l:     { label: "Isquios izquierdo",                      back: [148,205] },
  knee_back_r:     { label: "Hueco poplíteo der",                     back: [92,232] },
  knee_back_l:     { label: "Hueco poplíteo izq",                     back: [148,232] },
  calf_r:          { label: "Gemelo derecho",                         back: [92,262] },
  calf_l:          { label: "Gemelo izquierdo",                       back: [148,262] },
  heel_r:          { label: "Talón derecho",                          back: [88,295] },
  heel_l:          { label: "Talón izquierdo",                        back: [152,295] },
}

function findZone(x: number, y: number, view: ViewType): string | null {
  let closest: string | null = null
  let minDist = 25
  Object.entries(ZONES).forEach(([key, zone]) => {
    const coord = zone[view] as [number,number]|undefined
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

function LateralBody({ side }: { side: "right" | "left" }) {
  const flip = side === "left" ? "scale(-1,1) translate(-240,0)" : ""
  return (
    <g stroke="#9ca3af" strokeWidth="1" fill="#f3f4f6" transform={flip}>
      {/* Cabeza */}
      <ellipse cx="130" cy="22" rx="18" ry="20" />
      {/* Cuello */}
      <rect x="118" y="42" width="16" height="14" rx="4" />
      {/* Tronco */}
      <path d="M100 56 Q95 58 93 80 L93 165 Q105 175 130 172 Q150 170 148 165 L148 80 Q145 58 140 56 Z" />
      {/* Brazo */}
      <path d="M92 60 Q78 65 72 90 L70 140 Q75 145 82 143 L84 95 Q88 72 96 68 Z" />
      {/* Antebrazo */}
      <path d="M70 140 Q65 145 64 175 L72 177 L74 148 Z" />
      {/* Mano */}
      <ellipse cx="68" cy="185" rx="8" ry="11" />
      {/* Cadera/Glúteo */}
      <path d="M93 165 Q88 180 92 200 L118 205 L130 172 Z" />
      {/* Muslo */}
      <path d="M92 198 Q88 220 90 255 L108 257 L112 205 Z" />
      {/* Rodilla -->
      <ellipse cx="99" cy="258" rx="11" ry="10" />
      {/* Pierna */}
      <path d="M90 260 Q88 285 90 300 L108 300 L110 262 Z" />
      {/* Pie */}
      <path d="M90 298 Q85 305 105 308 L148 308 L148 300 L108 300 Z" />
      <text x="120" y="318" textAnchor="middle" fontSize="9" fill="#6b7280" stroke="none">
        {side === "right" ? "LAT. DER" : "LAT. IZQ"}
      </text>
    </g>
  )
}

function BodySVG({ view, markers, activeType, onZoneClick, disabled }: {
  view: ViewType
  markers: BodyMapMarker[]
  activeType: BodyMapMarkerType
  onZoneClick: (zone: string, x: number, y: number, view: ViewType) => void
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
    <svg viewBox="0 0 240 320" width="100%" onClick={handleClick}
      style={{ cursor: disabled ? "default" : "crosshair", maxWidth: 200 }}>
      {view === "front" && <FrontBody />}
      {view === "back" && <BackBody />}
      {view === "lateral_right" && <LateralBody side="right" />}
      {view === "lateral_left" && <LateralBody side="left" />}
      {viewMarkers.map((m, i) => {
        const typeConfig = MARKER_TYPES.find(t => t.value === m.type)
        return (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r={10} fill={typeConfig?.color ?? "#dc2626"} opacity={0.7} stroke="white" strokeWidth={1.5} />
            <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize={9} fill="white" fontWeight="bold">{m.intensity}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function BodyMapField({ value = [], onChange, disabled }: BodyMapFieldProps) {
  const [activeType, setActiveType] = useState<BodyMapMarkerType>("primary")
  const [activeIntensity, setActiveIntensity] = useState(5)
  const [activeView, setActiveView] = useState<ViewType>("front")

  function handleZoneClick(zone: string, x: number, y: number, view: ViewType) {
    const existing = value.findIndex(m => m.zone === zone && m.view === view)
    if (existing >= 0) {
      onChange(value.filter((_, i) => i !== existing))
    } else {
      onChange([...value, { zone, type: activeType, intensity: activeIntensity, x, y, view }])
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Selector de vista — 4 tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {(["front","back","lateral_right","lateral_left"] as ViewType[]).map(v => (
          <button key={v} type="button" disabled={disabled}
            onClick={() => setActiveView(v)}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeView === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Tipos de marcador */}
      <div className="flex flex-wrap gap-1.5">
        {MARKER_TYPES.map(t => (
          <button key={t.value} type="button" disabled={disabled}
            onClick={() => setActiveType(t.value)}
            className={cn("px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all",
              activeType === t.value ? "border-[1.5px] shadow-sm" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}
            style={activeType === t.value ? { background: t.color + "15", borderColor: t.color, color: t.color } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Intensidad del marcador */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 flex-shrink-0">Intensidad</span>
        <input type="range" min="1" max="10" value={activeIntensity} disabled={disabled}
          onChange={e => setActiveIntensity(parseInt(e.target.value))}
          className="flex-1"/>
        <span className="text-sm font-semibold text-gray-900 w-4 text-center">{activeIntensity}</span>
      </div>

      {/* Silueta */}
      <div className="flex justify-center">
        <BodySVG view={activeView} markers={value} activeType={activeType}
          onZoneClick={handleZoneClick} disabled={disabled} />
      </div>

      {/* Lista de zonas marcadas */}
      {value.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Zonas marcadas ({value.length})</p>
          {value.map((m, i) => {
            const typeConfig = MARKER_TYPES.find(t => t.value === m.type)
            const zoneLabel = ZONES[m.zone]?.label ?? m.zone
            const viewLabel = VIEW_LABELS[m.view as ViewType] ?? m.view
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: typeConfig?.color }}/>
                  <span className="text-xs text-gray-700">{typeConfig?.label} · {zoneLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{viewLabel.toLowerCase()} · int: {m.intensity}</span>
                  {!disabled && (
                    <button type="button" onClick={() => onChange(value.filter((_,j) => j !== i))}
                      className="text-gray-300 hover:text-red-400 text-xs px-1">×</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
