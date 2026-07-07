"""India localization pack: GST (slab / fixed), SAC 996311, GSTIN, CGST/SGST,
GSTR-1. The single place the core's Indian tax behaviour lives - reference
implementation for every other country pack."""

from decimal import Decimal

import frappe

FNB_GST = 5.0  # F&B / meal-plan GST rate


def _dec(v):
	return Decimal(str(v or 0))


def calculate_room_tax(property, room_type_doc, nightly_rate) -> Decimal:
	"""GST rate for one room night. Slab mode: the nightly tariff picks the
	slab (<=threshold → low, else high). Fixed mode: the room type percent."""
	prop = frappe.get_cached_doc("Property", property)
	if (prop.get("gst_mode") or "Slab") == "Fixed":
		return _dec(room_type_doc.tax_percent)
	threshold = _dec(prop.get("gst_slab_threshold") or 7500)
	low = _dec(prop.get("gst_rate_low") or 5)
	high = _dec(prop.get("gst_rate_high") or 18)
	return low if _dec(nightly_rate) <= threshold else high


def fnb_tax_rate(property) -> float:
	return FNB_GST


def tax_rate_options(property) -> list:
	return [0, 5, 12, 18, 28]


def invoice_context(prop_doc) -> dict:
	"""Country block for the invoice print. Values chosen to be byte-identical
	to the pre-seam hardcoding in api.folio_invoice."""
	return {
		"tax_label": "GST",
		"tax_id_label": "GSTIN",
		"service_code": {"label": "SAC", "value": "996311"},
		"sac": "996311",
		"place_of_supply": prop_doc.state,
		# CGST/SGST 50/50 split for intra-state accommodation
		"split": [("cgst", Decimal("0.5")), ("sgst", Decimal("0.5"))],
		"footer": "This is a computer-generated tax invoice under the GST Act.",
	}


def locale(prop_doc) -> dict:
	return {
		"currency_symbol": "₹",
		"locale": "en-IN",
		"currency": prop_doc.get("currency") or "INR",
		"tax_label": "GST",
		"tax_id_label": "GSTIN",
		"tax_rates": tax_rate_options(prop_doc.name),
	}
