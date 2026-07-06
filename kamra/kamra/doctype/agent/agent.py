"""Agent — one row per persona wired into Kamra.

An Agent is a named caller of MCP tools: Ravi the Front Desk Copilot,
Rani the Revenue bot, the Night Auditor, or a bring-your-own external
Claude. Row-level config (not code) controls what tools it can call,
its autonomy per action, its schedule, and its model.

The Autonomy Gate (kamra/autonomy.py) reads this doctype on every tool
call to decide Execute / Draft / Pending.
"""

import frappe
from frappe.model.document import Document


class Agent(Document):
	def validate(self):
		self._validate_cron_when_scheduled()
		self._validate_webhook_secret_when_webhook()
		self._dedupe_autonomy_rules()

	def _validate_cron_when_scheduled(self):
		if self.trigger_type == "Cron" and not (self.schedule_cron or "").strip():
			frappe.throw(
				"A scheduled agent needs a cron expression (e.g. '0 6,18 * * *' for 6am and 6pm)."
			)

	def _validate_webhook_secret_when_webhook(self):
		# Password fields are Frappe-managed; only require its presence flag.
		if self.trigger_type == "Webhook" and not self.get_password("webhook_secret", raise_exception=False):
			frappe.msgprint(
				"Webhook agents should set a webhook_secret so inbound signatures can be verified.",
				alert=True,
				indicator="orange",
			)

	def _dedupe_autonomy_rules(self):
		"""Two rules for the same action_type would be ambiguous — the gate
		must resolve a single autonomy per call. Enforce one row per key."""
		seen = set()
		for rule in self.autonomy_rules or []:
			key = (rule.action_type or "").strip()
			if not key:
				continue
			if key in seen:
				frappe.throw(f"Duplicate autonomy rule for action_type '{key}'.")
			seen.add(key)

	def resolve_autonomy(self, action_type: str, payload: dict | None = None) -> str:
		"""Return one of 'Full' / 'Suggest' / 'Approve' for this action.

		Matching rule wins; if the rule has a threshold, the operator must
		be satisfied by payload[threshold_field]. If no rule matches
		(or the threshold fails), the default is 'Full' — the safe-by-
		exclusion posture would be Approve, but that would break every
		existing tool at once. Rules are opt-in tightening.
		"""
		payload = payload or {}
		for rule in self.autonomy_rules or []:
			if (rule.action_type or "").strip() != action_type:
				continue
			if not (rule.threshold_field or "").strip():
				return rule.autonomy or "Full"
			if _threshold_matches(rule, payload):
				return rule.autonomy or "Full"
		return "Full"

	def allowed_tools(self) -> set[str]:
		"""Set of whitelisted API method names this agent can invoke.
		Empty means the agent is read-only (no tool calls)."""
		return {(t.tool_name or "").strip() for t in (self.tool_allowlist or []) if (t.tool_name or "").strip()}


def _threshold_matches(rule, payload: dict) -> bool:
	field = (rule.threshold_field or "").strip()
	op = (rule.threshold_operator or "").strip()
	if not field or not op:
		return True
	raw = payload.get(field)
	if raw is None:
		return False
	try:
		lhs = float(raw)
	except (TypeError, ValueError):
		return False
	rhs = float(rule.threshold_value or 0)
	return {
		">": lhs > rhs,
		">=": lhs >= rhs,
		"<": lhs < rhs,
		"<=": lhs <= rhs,
		"==": lhs == rhs,
		"!=": lhs != rhs,
	}.get(op, True)
