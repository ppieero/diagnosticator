"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getPayments, getPaymentStats, updatePaymentStatus } from "@/lib/services/payments"
import type { Payment } from "@/lib/services/payments"
import { useCurrency } from "@/hooks/useCurrency"
import { cn } from "@/lib/utils"

const STATUS_CONFIG = {
  paid:     { label: "Cobrado",   bg: "bg-green-100",  text: "text-green-800" },
  pending:  { label: "Pendiente", bg: "bg-amber-100",  text: "text-amber-800" },
  partial:  { label: "Parcial",   bg: "bg-blue-100",   text: "text-blue-800" },
  refunded: { label: "Devuelto",  bg: "bg-gray-100",   text: "text-gray-600" },
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia",
  bizum: "Bizum", mbway: "MB Way", insurance: "Seguro",
}

const PERIODS = [
  { label: "Hoy", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Mes", days: -1 },
]

function getRange(days: number): { from: string; to: string } {
  const to = new Date(); to.setHours(23,59,59,999)
  const from = new Date()
  if (days === 0) { from.setHours(0,0,0,0) }
  else if (days === -1) { from.setDate(1); from.setHours(0,0,0,0) }
  else { from.setDate(from.getDate() - days); from.setHours(0,0,0,0) }
  return { from: from.toISOString(), to: to.toISOString() }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

export default function PagosPage() {
  const router = useRouter()
  const { price } = useCurrency()
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<{ total_cobrado: number; total_pendiente: number; count_paid: number; count_pending: number; by_method: Record<string, number> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(0)
  const [filterStatus, setFilterStatus] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function load(days: number) {
    setLoading(true)
    const range = getRange(days)
    const [pays, st] = await Promise.all([
      getPayments({ from: range.from, to: range.to, status: filterStatus || undefined }),
      getPaymentStats(range.from, range.to),
    ])
    setPayments(pays)
    setStats(st)
    setLoading(false)
  }

  useEffect(() => { load(period) }, [period, filterStatus])

  async function handleMarkPaid(id: string) {
    setActionLoading(id)
    await updatePaymentStatus(id, "paid")
    await load(period)
    setActionLoading(null)
  }

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pagos</h2>
          <p className="text-xs text-gray-400 mt-0.5">{payments.length} registros</p>
        </div>
        <button onClick={() => router.push("/pagos/nuevo")}
          className="tap-target px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
          + Registrar
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {PERIODS.map((p, i) => (
          <button key={p.label} onClick={() => setPeriod(p.days)}
            className={cn("flex-1 py-2 rounded-lg text-xs font-medium transition-all",
              period === p.days ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            {p.label}
          </button>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-4 bg-green-50">
            <p className="text-2xl font-bold text-green-700">{price(stats.total_cobrado, 2)}</p>
            <p className="text-xs text-green-600 mt-0.5">Cobrado ({stats.count_paid})</p>
            {Object.keys(stats.by_method).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(stats.by_method).map(([m, v]) => (
                  <span key={m} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    {METHOD_LABELS[m] ?? m}: {price(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="card p-4 bg-amber-50">
            <p className="text-2xl font-bold text-amber-700">{price(stats.total_pendiente, 2)}</p>
            <p className="text-xs text-amber-600 mt-0.5">Pendiente ({stats.count_pending})</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["", "paid", "pending", "partial", "refunded"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
              filterStatus === s ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500")}>
            {s === "" ? "Todos" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && payments.length === 0 && (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">💳</span>
          <p className="text-sm font-medium text-gray-500">Sin pagos en este periodo</p>
          <button onClick={() => router.push("/pagos/nuevo")} className="text-sm text-blue-600 font-medium">
            Registrar primer pago →
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {payments.map(pay => {
          const st = STATUS_CONFIG[pay.status]
          const patient = pay.patient as { full_name: string } | undefined
          const appt = pay.appointment as { service?: { name: string }; scheduled_at?: string } | undefined
          return (
            <div key={pay.id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {patient?.full_name ?? "Paciente"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pay.concept ?? appt?.service?.name ?? "Pago"}
                    {pay.invoice_number && ` · ${pay.invoice_number}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(pay.created_at)} · {METHOD_LABELS[pay.payment_method] ?? pay.payment_method}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{price(pay.total, 2)}</p>
                  {pay.tax_amount > 0 && (
                    <p className="text-xs text-gray-400">+{price(pay.tax_amount, 2)} IVA</p>
                  )}
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-lg mt-1 inline-block", st.bg, st.text)}>
                    {st.label}
                  </span>
                </div>
              </div>
              {pay.notes && <p className="text-xs text-gray-500 italic">{pay.notes}</p>}
              <div className="flex gap-2">
                <button onClick={() => router.push(`/pagos/${pay.id}/recibo`)}
                  className="flex-1 tap-target rounded-xl border border-gray-300 text-gray-600 text-xs font-medium">
                  Ver recibo
                </button>
                {pay.status === "pending" && (
                  <button onClick={() => handleMarkPaid(pay.id)}
                    disabled={actionLoading === pay.id}
                    className="flex-1 tap-target rounded-xl bg-green-600 text-white text-xs font-semibold disabled:opacity-50">
                    {actionLoading === pay.id ? "..." : "Marcar cobrado"}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}