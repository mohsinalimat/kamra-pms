# Copyright (c) 2026, HeyKoala and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate


class Folio(Document):
	def on_payment_authorized(self, status: str | None = None):
		"""Called by the frappe/payments app when a hosted checkout for
		this folio succeeds. Posts the payment and returns the folio URL
		to redirect the guest to."""
		if status not in ("Authorized", "Completed", "Paid"):
			return
		amount = float(self.balance or 0)
		if amount <= 0:
			return
		self.append("payments", {
			"posting_date": nowdate(),
			"mode": "Payment Link",
			"amount": amount,
			"reference": f"payments-app:{self.name}",
		})
		from kamra.folio import _recalculate

		_recalculate(self)
		self.save(ignore_permissions=True)

		from kamra.savings import log_action
		log_action("payment_received", "Folio", self.name, self.property,
		           minutes_saved=3,
		           rationale=f"₹{amount:,.0f} paid via hosted checkout",
		           agent_name="Payments", channel="API")
		frappe.db.commit()
		return f"/billing/{self.name}"
