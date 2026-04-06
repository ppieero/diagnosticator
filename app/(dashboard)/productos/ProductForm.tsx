"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createProduct, updateProduct } from "@/lib/services/products"
import type { Product } from "@/lib/services/products"
import { cn } from "@/lib/utils"

const TAX_RATES = [0, 4, 10, 21]

interface ServiceOption { id: string; name: string; specialty?: { name: string; color: string } }
interface Props { product?: Product }

export default function ProductForm({ product }: Props) {
  const router = useRouter()
  const [services, setServices] = useState<ServiceOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [price, setPrice] = useState(String(product?.price ?? ""))
  const [taxRate, setTaxRate] = useState(product?.tax_rate ?? 0)
  const [barcode, setBarcode] = useState(product?.barcode ?? "")
  const [isActive, setIsActive] = useState(product?.is_active ?? true)
  const [connectedServices, setConnectedServices] = useState<string[]>(
    product?.connected_services?.map(cs => cs.service_id) ?? []
  )

  useEffect(() => {
    const supabase = createClient()
    supabase.from("services")
      .select("id, name, specialty:specialties(name, color)")
      .eq("is_active", true).order("name")
      .then(({ data }) => setServices((data ?? []) as unknown as ServiceOption[]))
  }, [])

  const priceWithTax = price && taxRate > 0
    ? (parseFloat(price) * (1 + taxRate / 100)).toFixed(2)
    : null

  function toggleService(id: string) {
    setConnectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return }
    if (!price || parseFloat(price) < 0) { setError("El precio es obligatorio"); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        description: description || undefined,
        price: parseFloat(price),
        tax_rate: taxRate,
        barcode: barcode || undefined,
        is_active: isActive,
      }
      if (product) {
        await updateProduct(product.id, payload, connectedServices)
      } else {
        await createProduct(payload, connectedServices)
      }
      router.push("/productos")
    } catch (err) {
      console.error(err)
      setError("Error al guardar el producto")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del producto</p>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Barra de proteina, Bandas elasticas..." className="input-base" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Descripcion (opcional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="Descripcion del producto..." className="input-base resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Codigo de barras (opcional)</label>
          <input value={barcode} onChange={e => setBarcode(e.target.value)}
            placeholder="Escanear o escribir codigo..." className="input-base font-mono" />
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio e impuestos</p>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Precio base (€)</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0.00" step="0.01" className="input-base" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">IVA</label>
          <div className="flex gap-2">
            {TAX_RATES.map(rate => (
              <button key={rate} type="button" onClick={() => setTaxRate(rate)}
                className={cn("flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all",
                  taxRate === rate
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300")}>
                {rate === 0 ? "Sin IVA" : `${rate}%`}
              </button>
            ))}
          </div>
        </div>
        {priceWithTax && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-xs text-green-800">
              Precio con IVA: <span className="font-bold">€{priceWithTax}</span>
              {" "}(IVA incluido: €{(parseFloat(price) * taxRate / 100).toFixed(2)})
            </p>
          </div>
        )}
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios asociados</p>
        <p className="text-xs text-gray-400">
          El producto se ofrecera automaticamente al registrar una cita de estos servicios.
        </p>
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
          {services.map(sv => {
            const selected = connectedServices.includes(sv.id)
            const spColor = (sv.specialty as { color?: string })?.color ?? "#888"
            return (
              <button key={sv.id} type="button" onClick={() => toggleService(sv.id)}
                className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                  selected ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-gray-300 bg-white")}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: spColor }} />
                  <span className={cn("text-sm font-medium", selected ? "text-amber-900" : "text-gray-800")}>
                    {sv.name}
                  </span>
                </div>
                <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center",
                  selected ? "bg-amber-500 border-amber-500" : "border-gray-300")}>
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
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
          <p className="text-sm font-medium text-gray-800">Producto activo</p>
          <p className="text-xs text-gray-400">Los productos inactivos no aparecen al vender</p>
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

      <button onClick={handleSave} disabled={saving || !name.trim()}
        className="tap-target w-full rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
        {saving ? "Guardando..." : product ? "Guardar cambios" : "Crear producto →"}
      </button>
    </div>
  )
}