"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getProducts } from "@/lib/services/products"
import type { Product } from "@/lib/services/products"
import { cn } from "@/lib/utils"

export default function ProductosPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProducts().then(data => { setProducts(data); setLoading(false) })
  }, [])

  const active = products.filter(p => p.is_active)
  const inactive = products.filter(p => !p.is_active)

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Productos</h2>
          <p className="text-xs text-gray-400 mt-0.5">{products.length} en catalogo</p>
        </div>
        <button onClick={() => router.push("/productos/nuevo")}
          className="tap-target px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
          + Nuevo
        </button>
      </div>

      {products.length === 0 && (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">🛍️</span>
          <p className="text-sm font-medium text-gray-600">No hay productos configurados</p>
          <button onClick={() => router.push("/productos/nuevo")} className="text-sm text-blue-600 font-medium">
            Agregar primer producto →
          </button>
        </div>
      )}

      {active.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activos ({active.length})</p>
          {active.map(prod => (
            <button key={prod.id} onClick={() => router.push(`/productos/${prod.id}`)}
              className="card p-4 text-left hover:shadow-md transition-shadow w-full">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                      <line x1="3" y1="6" x2="21" y2="6"/>
                      <path d="M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{prod.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {prod.barcode && (
                        <span className="text-xs text-gray-400 font-mono">{prod.barcode}</span>
                      )}
                      {prod.tax_rate > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
                          IVA {prod.tax_rate}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">€{Number(prod.price).toFixed(2)}</p>
                  {prod.tax_rate > 0 && (
                    <p className="text-xs text-gray-400">
                      c/IVA €{(Number(prod.price) * (1 + prod.tax_rate / 100)).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Inactivos ({inactive.length})</p>
          {inactive.map(prod => (
            <button key={prod.id} onClick={() => router.push(`/productos/${prod.id}`)}
              className="card p-3 text-left opacity-60 w-full">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{prod.name}</p>
                <p className="text-sm text-gray-400">€{Number(prod.price).toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}