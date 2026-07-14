import frappe


def after_install():
	set_site_favicon()
	ensure_agent_user()


def ensure_agent_user():
	"""The governed agent user must exist on every install - public
	bookings, QR orders and housekeeping/laundry billing all post through
	it. Without this, those flows fail on a fresh site until the RBAC seed
	is run by hand."""
	from kamra.scripts.seed_rbac_v2 import ensure_agent_user as ensure
	ensure()


def set_site_favicon():
	"""A fresh site shows Frappe's favicon on /login and the Desk until
	Website Settings carries ours. Never overrides a hotelier's custom one."""
	ws = frappe.get_doc("Website Settings")
	if not ws.favicon:
		ws.favicon = "/assets/kamra/kamra-mark.svg"
		ws.flags.ignore_mandatory = True
		ws.save(ignore_permissions=True)
