"""Endpoint authorization — Frappe checks doctype permissions on ORM
paths, but raw-SQL reads and db.set_value writes sail past them. Every
whitelisted Kamra endpoint therefore declares who may call it."""

from functools import wraps

import frappe

ADMIN = ("System Manager", "Administrator", "Hotel Admin")


def require_roles(*roles):
	"""Allow the listed roles (plus admins). Usage — below the
	whitelist decorator so the registered function is the guarded one:

	    @frappe.whitelist()
	    @require_roles("Front Desk", "Kamra Agent")
	    def check_in(...): ...
	"""
	allowed = set(roles) | set(ADMIN)

	def deco(fn):
		@wraps(fn)
		def guarded(*args, **kwargs):
			if not allowed & set(frappe.get_roles()):
				frappe.throw(
					f"Not permitted — needs one of: {', '.join(sorted(roles))}.",
					frappe.PermissionError)
			return fn(*args, **kwargs)
		return guarded
	return deco
