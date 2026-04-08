"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getProduct } from "@/lib/services/products"
import type { Product } from "@/lib/services/products"
import ProductForm from "../ProductForm"
import { useCurrency } from "@/hooks/useCurrency"

export default function ProductoDetailPage() {
  const { prod } = useParams<{ prod: string }>()
  const router = useRouter()
  const { symbol } = useCurrency()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProduct(prod).then(data => {
      if (!data) router.push("/productos")
      setProduct(data)
      setLoading(false)
    })
  }, [prod, router])

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!product) return null

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{product.name}</p>
            <p className="text-xs text-amber-700 font-medium">{symbol}{Number(product.price).toFixed(2)}</p>
          </div>
        </div>
      </div>
      <ProductForm product={product} />
    </div>
  )
}