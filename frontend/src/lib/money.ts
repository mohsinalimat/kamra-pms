/*  Currency and tax vocabulary, from the property's localization pack. Loaded
    once per session; defaults keep India output identical until it resolves. */

import { call, getCurrentProperty } from "./api"

interface Locale {
  currency_symbol: string
  locale: string
  currency: string
  tax_label: string
  tax_id_label: string
  tax_rates: number[]
}

let cache: Locale = {
  currency_symbol: "₹",
  locale: "en-IN",
  currency: "INR",
  tax_label: "GST",
  tax_id_label: "GSTIN",
  tax_rates: [0, 5, 12, 18, 28],
}

export function loadLocale(): Promise<Locale> {
  return call<Locale>("kamra.api.property_locale", {
    property: getCurrentProperty(),
  })
    .then((l) => {
      cache = { ...cache, ...l }
      return cache
    })
    .catch(() => cache)
}

export const locale = () => cache
export const fmtMoney = (n: unknown) =>
  cache.currency_symbol +
  Number(n ?? 0).toLocaleString(cache.locale, { maximumFractionDigits: 2 })
export const taxRates = () => cache.tax_rates
export const taxLabel = () => cache.tax_label
