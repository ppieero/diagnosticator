"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createPackage, updatePackage } from "@/lib/services/packages"
import type { Package, PackageItem } from "@/lib/services/packages"
import { cn } from "@/lib/utils"

interface ServiceOption {
  id: string; name: string; duration_minutes: number; price: number
  specialty?: { name: string; color: string }
}

interface Props { pkg?: Package }

export default function PackageForm({ pkg }: Props) {
  const router = useRouter()
  const [services, setServices] = useState<ServiceOption[]>([])
  const [specialties, setSpecialties] = useState<{ id: string; name: string; color: string }[]>([])
  const [filterSpecialty, setFilterSpecialty] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(pkg?.name ?? "")
  const [description, setDescription] = useState(pkg?.description ?? "")
  const [price, setPrice] = useState(String(pkg?.price ?? ""))
  const [isActive, setIsActive] = useState(pkg?.is_active ?? true)
  const [items, setItems] = useState<{ service_id: string; quantity: number; service?: ServiceOption }[]>(
    pkg?.items?.map(i => ({ service_id: i.service_id, quantity: i.quantity, service: i.service as ServiceOption })) ?? []
  )

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [svRes, spRes] = await Promise.all([
        supabase.from("services").select("id, name, duration_minutes, price, specialty:specialties(name, color)").eq("is_active", true).order("name"),
        supabase.from("specialties").select("id, name, color").eq("is_active", true),
      ])
      setServices((svRes.data ?? []) as unknown as ServiceOption[])
      setSpecialties(spRes.data ?? [])
    }
    load()
  }, [])

  const filteredServices = filterSpecialty
    ? services.filter(s => {
        const spName = (s.specialty as { name: string })?.name ?? ""
        return spName === filterSpecialty
      })
    : services

  const totalSessionPrice = items.reduce((sum, i) => {
    const sv = services.find(s => s.id === i.service_id)
    return sum + (sv ? sv.price * i.quantity : 0)
  }, 0)

  function addService(sv: ServiceOption) {
    const existing = items.findIndex(i => i.service_id === sv.id)
    if (existing >= 0) {
      setItems(prev => prev.map((i, idx) => idx === existing ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setItems(prev => [...prev, { service_id: sv.id, quantity: 1, service: sv }])
    }
  }

  function removeItem(serviceId: string) {
    setItems(prev => prev.filter(i => i.service_id !== serviceId))
  }

  function updateQuantity(serviceId: string, qty: number) {
    if (qty <= 0) { removeItem(serviceId); return }
    setItems(prev => prev.map(i => i.service_id === serviceId ? { ...i, quantity: qty } : i))
  }

  async function handleSave() {
    if (!name.trim()) { setError("El nombre del paquete es obligatorio"); return }
    if (items.length === 0) { setError("Agrega al menos un servicio al paquete"); return }
    setSaving(true)
    setError(null)
    try {
      const payload = { name: name.trim(), description: description || undefined, price: parseFloat(price) || 0, is_active: isActive }
      const itemsPayload = items.map(i => ({ service_id: i.service_id, quantity: i.quantity }))
      if (pkg) {
        await updatePackage(pkg.id, payload, itemsPayload)
      } else {
        await createPackage(payload, itemsPayload)
      }
      router.push("/paquetes")
    } catch (err) {
      console.error(err)
      setError("Error al guardar el paquete")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del paquete</p>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Nombre del paquete</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Terapia 6 sesiones, Plan TRT, Pack Navidad..." className="input-base" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Descripcion (opcional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="Descripcion visible para el paciente..." className="input-base resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Precio del paquete (€)</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0.00" className="input-base" />
          {totalSessionPrice > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Precio unitario sumado: €{totalSessionPrice.toFixed(0)}
              {parseFloat(price) > 0 && parseFloat(price) < totalSessionPrice && (
                <span className="text-green-600 font-medium ml-2">
                  Ahorro: €{(totalSessionPrice - parseFloat(price)).toFixed(0)}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Items del paquete */}
      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios incluidos</p>
        {items.length === 0 ? (
          <div className="bg-gray-50 rounded-xl px-4 py-4 text-center">
            <p className="text-xs text-gray-400">Selecciona servicios de la lista de abajo</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => {
              const sv = item.service ?? services.find(s => s.id === item.service_id)
              const spColor = (sv?.specialty as { color?: string })?.color ?? "#888"
              return (
                <div key={item.service_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-purple-200 bg-purple-50">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: spColor }} />
                  <p className="text-sm font-medium text-purple-900 flex-1 truncate">{sv?.name}</p>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateQuantity(item.service_id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-purple-200 flex items-center justify-center text-purple-700 hover:bg-purple-100 text-base font-medium">
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-purple-900">{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.service_id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-purple-200 flex items-center justify-center text-purple-700 hover:bg-purple-100 text-base font-medium">
                      +
                    </button>
                  </div>
                  <button type="button" onClick={() => removeItem(item.service_id)}
                    className="w-7 h-7 rounded-lg bg-white border border-red-200 flex items-center justify-center text-red-400 hover:bg-red-50">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Catálogo de servicios */}
      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agregar servicios</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilterSpecialty("")}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
              !filterSpecialty ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500")}>
            Todos
          </button>
          {specialties.map(sp => (
            <button key={sp.id} onClick={() => setFilterSpecialty(filterSpecialty === sp.name ? "" : sp.name)}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
                filterSpecialty === sp.name ? "text-white border-transparent" : "border-gray-200 text-gray-500"
              )}
              style={filterSpecialty === sp.name ? { background: sp.color, borderColor: sp.color } : {}}>
              {sp.name}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {filteredServices.map(sv => {
            const inPackage = items.find(i => i.service_id === sv.id)
            const spColor = (sv.specialty as { color?: string })?.color ?? "#888"
            return (
              <button key={sv.id} type="button" onClick={() => addService(sv)}
                className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                  inPackage ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-gray-300 bg-white")}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: spColor }} />
                  <div>
                    <p className={cn("text-sm font-medium", inPackage ? "text-purple-900" : "text-gray-800")}>{sv.name}</p>
                    <p className="text-xs text-gray-400">{sv.duration_minutes} min · €{Number(sv.price).toFixed(0)}</p>
                  </div>
                </div>
                <div className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0",
                  inPackage ? "bg-purple-600 border-purple-600" : "border-gray-300")}>
                  {inPackage ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">Paquete activo</p>
          <p className="text-xs text-gray-400">Los paquetes inactivos no aparecen al asignar</p>
        </div>
        <button type="button" onClick={() => setIsActive(!isActive)}
          className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
            isActive ? "bg-blue-600" : "bg-gray-200")}>
          <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            isActive ? "translate-x-5" : "translate-x-1")} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !name.trim() || items.length === 0}
        className="tap-target w-full rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors">
        {saving ? "Guardando..." : pkg ? "Guardar cambios" : "Crear paquete →"}
      </button>
    </div>
  )
}