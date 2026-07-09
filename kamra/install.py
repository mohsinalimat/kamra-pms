import frappe


def after_install():
	set_site_favicon()


def set_site_favicon():
	"""A fresh site shows Frappe's favicon on /login and the Desk until
	Website Settings carries ours. Never overrides a hotelier's custom one."""
	ws = frappe.get_doc("Website Settings")
	if not ws.favicon:
		ws.favicon = "/assets/kamra/kamra-mark.svg"
		ws.flags.ignore_mandatory = True
		ws.save(ignore_permissions=True)
