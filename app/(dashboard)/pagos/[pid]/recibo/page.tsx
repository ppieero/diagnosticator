"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Payment } from "@/lib/services/payments"
import { getClinicSettings } from "@/lib/services/settings"
import { cn } from "@/lib/utils"

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia",
  bizum: "Bizum", mbway: "MB Way", insurance: "Seguro medico",
}

const STATUS_CONFIG = {
  paid:     { label: "COBRADO",   color: "#16a34a" },
  pending:  { label: "PENDIENTE", color: "#d97706" },
  partial:  { label: "PARCIAL",   color: "#2563eb" },
  refunded: { label: "DEVUELTO",  color: "#6b7280" },
}

export default function ReciboPage() {
  const { pid } = useParams<{ pid: string }>()
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [clinicName, setClinicName] = useState("Diagnosticator")
  const [symbol, setSymbol] = useState("€")
  const [taxName, setTaxName] = useState("IVA")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [payRes, settings] = await Promise.all([
        supabase.from("payments")
          .select("*, patient:patients(id, full_name, email, phone), appointment:appointments(id, scheduled_at, service:services(name))")
          .eq("id", pid).single(),
        getClinicSettings(),
      ])
      setPayment(payRes.data as unknown as Payment)
      setClinicName(settings.general.clinic_name)
      setSymbol(settings.general.currency_symbol)
      setTaxName(settings.billing.tax_name)
      setLoading(false)
    }
    load()
  }, [pid])

  function handlePrint() { window.print() }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!payment) return null

  const patient = payment.patient as { full_name: string; email?: string; phone?: string } | undefined
  const apptSvc = (payment.appointment as { service?: { name: string } } | undefined)?.service?.name
  const st = STATUS_CONFIG[payment.status]
  const dateStr = new Date(payment.created_at).toLocaleDateString("es-ES", {
    day: "2-digit", month: "long", year: "numeric"
  })

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3 print:hidden">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-900">Recibo de pago</h2>
        <button onClick={handlePrint}
          className="ml-auto tap-target px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Imprimir / PDF
        </button>
      </div>

      <div ref={printRef} className="card p-6 flex flex-col gap-5 print:shadow-none print:border-none">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold text-gray-900">{clinicName}</p>
            <p className="text-xs text-gray-400 mt-0.5">Recibo de pago</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Numero</p>
            <p className="text-sm font-bold text-gray-900">{payment.invoice_number}</p>
            <p className="text-xs text-gray-400 mt-1">{dateStr}</p>
          </div>
        </div>

        <div className="border-t border-b border-gray-100 py-4 flex flex-col gap-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 font-medium">Paciente</span>
            <span className="text-gray-900 font-semibold">{patient?.full_name}</span>
          </div>
          {patient?.email && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-700">{patient.email}</span>
            </div>
          )}
          {patient?.phone && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Telefono</span>
              <span className="text-gray-700">{patient.phone}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Concepto</p>
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-gray-900">
              {payment.concept ?? apptSvc ?? "Servicio medico"}
            </p>
            {payment.notes && <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Importe base</span>
            <span className="text-gray-900">{symbol}{Number(payment.amount).toFixed(2)}</span>
          </div>
          {Number(payment.tax_amount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{taxName}</span>
              <span className="text-gray-900">{symbol}{Number(payment.tax_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-1">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">{symbol}{Number(payment.total).toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs text-gray-500">Metodo de pago</p>
            <p className="text-sm font-semibold text-gray-900">{METHOD_LABELS[payment.payment_method] ?? payment.payment_method}</p>
          </div>
          <span className="text-sm font-bold px-3 py-1.5 rounded-xl"
            style={{ background: st.color + "22", color: st.color }}>
            {st.label}
          </span>
        </div>

        <p className="text-xs text-gray-400 text-center mt-2">
          {clinicName} · {dateStr} · {payment.invoice_number}
        </p>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:shadow-none, .print\\:shadow-none * { visibility: visible; }
          .print\\:shadow-none { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}