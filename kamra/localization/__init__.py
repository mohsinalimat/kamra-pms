"""Localization seam. The core PMS never knows about GST, VAT or fiscal
printers - it asks the country pack. Packs are resolved through the
`kamra_localization` hook (ERPNext regional_overrides style), so a future
`kamra_uae` app claims its country just by declaring the hook. Countries
without a pack fall back to a plain flat-tax `generic` pack.

Interface every pack implements (see india.py):
  calculate_room_tax(property, room_type_doc, nightly_rate) -> Decimal
  fnb_tax_rate(property) -> float
  tax_rate_options(property) -> list[float]
  invoice_context(prop_doc) -> dict   (labels, service code, place of supply)
  locale(prop_doc) -> dict            (currency_symbol, locale, tax_label...)
"""

import importlib

import frappe


def pack_for(property: str | None = None):
	country = None
	if property:
		country = frappe.get_cached_value("Property", property, "country")
	country = country or "India"
	mapping = frappe.get_hooks("kamra_localization") or {}
	target = mapping.get(country)
	if target:
		path = target[-1] if isinstance(target, (list, tuple)) else target
		try:
			return importlib.import_module(path)
		except ModuleNotFoundError:
			pass
	from kamra.localization import generic
	return generic
