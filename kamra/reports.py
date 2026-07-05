"""MIS reporting — the manager's flash and the trend behind it.

Everything is computed from folios (posted money) and reservations
(occupancy), never estimated: the same numbers the GST invoice and the
cash drawer reconcile to.
"""

import frappe
from frappe.utils import add_days, getdate, nowdate


def _day_stats(property: str, date: str, total_rooms: int) -> dict:
	row = frappe.db.sql(
		"""
		SELECT
		  COUNT(DISTINCT CASE WHEN fc.charge_type = 'Room'
		        THEN COALESCE(fc.reservation, f.reservation) END) AS rooms_sold,
		  COALESCE(SUM(CASE WHEN fc.charge_type = 'Room'
		        THEN fc.amount ELSE 0 END), 0) AS room_revenue,
		  COALESCE(SUM(CASE WHEN fc.charge_type IN ('Food & Beverage',
		        'Meal Plan', 'Minibar') THEN fc.amount ELSE 0 END), 0)
		        AS fnb_revenue,
		  COALESCE(SUM(CASE WHEN fc.charge_type NOT IN ('Room',
		        'Food & Beverage', 'Meal Plan', 'Minibar', 'Discount')
		        THEN fc.amount ELSE 0 END), 0) AS other_revenue
		FROM `tabFolio Charge` fc
		JOIN `tabFolio` f ON fc.parent = f.name
		WHERE f.property = %(p)s AND fc.posting_date = %(d)s
		""",
		{"p": property, "d": date}, as_dict=True)[0]
	sold = int(row.rooms_sold or 0)
	rev = float(row.room_revenue or 0)
	return {
		"date": str(date),
		"rooms_sold": sold,
		"occupancy_pct": round(100 * sold / total_rooms, 1) if total_rooms else 0,
		"room_revenue": rev,
		"fnb_revenue": float(row.fnb_revenue or 0),
		"other_revenue": float(row.other_revenue or 0),
		"adr": round(rev / sold, 0) if sold else 0,
		"revpar": round(rev / total_rooms, 0) if total_rooms else 0,
	}


@frappe.whitelist()
def manager_flash(property: str, date: str | None = None):
	"""The daily flash: yesterday's performance, month to date, today's
	movement, collections by mode, and the 7-day outlook."""
	date = date or nowdate()
	total_rooms = frappe.db.count("Room", {"property": property}) or 0

	# month-to-date across day stats
	mtd = {"rooms_sold": 0, "room_revenue": 0.0, "fnb_revenue": 0.0,
	       "other_revenue": 0.0}
	d = getdate(date).replace(day=1)
	end = getdate(date)
	days = 0
	trend = []
	while d <= end:
		s = _day_stats(property, str(d), total_rooms)
		for k in mtd:
			mtd[k] += s[k]
		trend.append(s)
		days += 1
		d = getdate(add_days(d, 1))
	mtd["occupancy_pct"] = round(
		100 * mtd["rooms_sold"] / (total_rooms * days), 1) if total_rooms and days else 0
	mtd["adr"] = round(mtd["room_revenue"] / mtd["rooms_sold"], 0) \
		if mtd["rooms_sold"] else 0
	mtd["revpar"] = round(mtd["room_revenue"] / (total_rooms * days), 0) \
		if total_rooms and days else 0

	movement = {
		"arrivals": frappe.db.count("Reservation", {
			"property": property, "check_in_date": date,
			"status": ("in", ["Confirmed", "Checked In"])}),
		"departures": frappe.db.count("Reservation", {
			"property": property, "check_out_date": date,
			"status": ("in", ["Checked In", "Checked Out"])}),
		"in_house": frappe.db.count("Reservation", {
			"property": property, "status": "Checked In"}),
		"no_shows": frappe.db.count("Reservation", {
			"property": property, "check_in_date": date,
			"status": "No Show"}),
	}

	from kamra.api import cash_summary
	collections = cash_summary(property, date)

	outlook = []
	for i in range(1, 8):
		od = str(add_days(date, i))
		booked = frappe.db.sql(
			"""
			SELECT COUNT(*) FROM `tabReservation`
			WHERE property = %(p)s AND status IN ('Confirmed', 'Checked In')
			  AND check_in_date <= %(d)s AND check_out_date > %(d)s
			""", {"p": property, "d": od})[0][0]
		outlook.append({
			"date": od, "booked": int(booked),
			"occupancy_pct": round(100 * booked / total_rooms, 1)
			if total_rooms else 0,
		})

	return {
		"date": str(date), "total_rooms": total_rooms,
		"today": trend[-1] if trend else None,
		"mtd": mtd, "movement": movement,
		"collections": collections,
		"trend": trend[-14:],
		"outlook": outlook,
	}
