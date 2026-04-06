import { createClient } from "@/lib/supabase/client"

export interface ClinicSettings {
  general: {
    clinic_name: string
    language: string
    timezone: string
    currency: string
    currency_symbol: string
    date_format: string
    time_format: string
  }
  billing: {
    tax_enabled: boolean
    tax_rate: number
    tax_name: string
    invoice_prefix: string
    payment_methods: string[]
  }
  appointments: {
    default_duration: number
    cancellation_hours: number
    reminder_enabled: boolean
    slot_padding: number
  }
}

const DEFAULT_SETTINGS: ClinicSettings = {
  general: {
    clinic_name: "Diagnosticator",
    language: "es",
    timezone: "Europe/Lisbon",
    currency: "EUR",
    currency_symbol: "€",
    date_format: "DD/MM/YYYY",
    time_format: "24h",
  },
  billing: {
    tax_enabled: false,
    tax_rate: 0,
    tax_name: "IVA",
    invoice_prefix: "INV",
    payment_methods: ["cash", "card", "transfer"],
  },
  appointments: {
    default_duration: 60,
    cancellation_hours: 24,
    reminder_enabled: false,
    slot_padding: 0,
  },
}

let cachedSettings: ClinicSettings | null = null

export async function getClinicSettings(): Promise<ClinicSettings> {
  if (cachedSettings) return cachedSettings
  const supabase = createClient()
  const { data } = await supabase.from("clinic_settings").select("key, value")
  if (!data || data.length === 0) return DEFAULT_SETTINGS
  const settings = { ...DEFAULT_SETTINGS }
  for (const row of data) {
    if (row.key === "general") settings.general = { ...DEFAULT_SETTINGS.general, ...row.value }
    if (row.key === "billing") settings.billing = { ...DEFAULT_SETTINGS.billing, ...row.value }
    if (row.key === "appointments") settings.appointments = { ...DEFAULT_SETTINGS.appointments, ...row.value }
  }
  cachedSettings = settings
  return settings
}

export function clearSettingsCache() {
  cachedSettings = null
}

export function formatPrice(amount: number, symbol: string): string {
  return `${symbol}${Number(amount).toFixed(0)}`
}