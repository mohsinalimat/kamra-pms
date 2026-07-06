import frappe
from frappe.model.document import Document


class PendingAgentAction(Document):
	def before_insert(self):
		# Default TTL: 72 hours. The gate expires anything older on approval attempt
		# and via a periodic sweep.
		if not self.expires_at:
			self.expires_at = frappe.utils.add_to_date(frappe.utils.now_datetime(), hours=72)
