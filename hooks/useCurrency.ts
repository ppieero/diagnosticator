"use client"
import { useEffect, useState } from "react"
import { getClinicSettings } from "@/lib/services/settings"
import type { ClinicSettings } from "@/lib/services/settings"

const DEFAULT_SYMBOL = "€"

export function useCurrency() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [settings, setSettings] = useState<ClinicSettings | null>(null)

  useEffect(() => {
    getClinicSettings().then(s => {
      setSymbol(s.general.currency_symbol)
      setSettings(s)
    })
  }, [])

  function price(amount: number, decimals = 0) {
    return `${symbol}${Number(amount).toFixed(decimals)}`
  }

  return { symbol, settings, price }
}