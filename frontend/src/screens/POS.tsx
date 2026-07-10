import { useCallback, useEffect, useState } from "react"
import { Plus, Minus, Trash2, Send, UtensilsCrossed, Leaf } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { serverError } from "../lib/resource"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"

const inr = (n: unknown) =>
  Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })

interface MenuItem {
  name: string
  item_name: string
  category: string
  price: number
  is_veg: number
  is_alcohol: number
  image: string | null
  description: string | null
}
interface Outlet { name: string; outlet_name: string; outlet_type: string }
interface CartLine {
  menu_item: string
  item_name: string
  price: number
  is_veg: number
  qty: number
  instructions: string
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

export default function POS() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outlet, setOutlet] = useState("")
  const [room, setRoom] = useState("")
  const [table, setTable] = useState("")
  const [rooms, setRooms] = useState<{ name: string; room_number: string }[]>([])
  const [cats, setCats] = useState<{ category: string; items: MenuItem[] }[]>([])
  const [activeCat, setActiveCat] = useState("")
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState("")
  const [discountReason, setDiscountReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    call<Outlet[]>("kamra.pos.outlets", { property: getCurrentProperty() })
      .then((o) => { setOutlets(o); if (o[0]) setOutlet(o[0].name) })
      .catch((e) => setError(serverError(e)))
    call<{ name: string; room_number: string }[]>("kamra.api.hk_queue", { property: getCurrentProperty() })
      .then((d: any) => setRooms(d.rooms || []))
      .catch(() => {})
  }, [])

  const loadMenu = useCallback(() => {
    if (!outlet) return
    call<{ categories: { category: string; items: MenuItem[] }[] }>("kamra.pos.pos_menu", { outlet })
      .then((m) => { setCats(m.categories); setActiveCat(m.categories[0]?.category ?? "") })
      .catch((e) => setError(serverError(e)))
  }, [outlet])
  useEffect(loadMenu, [loadMenu])

  const addToCart = (it: MenuItem) =>
    setCart((c) => {
      const ex = c.find((l) => l.menu_item === it.name)
      if (ex) return c.map((l) => l.menu_item === it.name ? { ...l, qty: l.qty + 1 } : l)
      return [...c, { menu_item: it.name, item_name: it.item_name, price: it.price, is_veg: it.is_veg, qty: 1, instructions: "" }]
    })
  const setQty = (mi: string, d: number) =>
    setCart((c) => c.flatMap((l) => l.menu_item === mi
      ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l]))
  const setInstr = (mi: string, v: string) =>
    setCart((c) => c.map((l) => l.menu_item === mi ? { ...l, instructions: v } : l))

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0)
  const disc = Math.min(Number(discount) || 0, subtotal)
  const total = subtotal - disc

  async function sendToKitchen() {
    if (cart.length === 0) return
    setBusy(true); setError(null)
    try {
      const r = await call<{ order: string }>("kamra.pos.create_order", {
        outlet,
        property: getCurrentProperty(),
        room: room || null,
        table_no: table || null,
        items: cart.map((l) => ({ menu_item: l.menu_item, qty: l.qty, instructions: l.instructions })),
      })
      if (disc > 0)
        await call("kamra.pos.apply_discount", { order: r.order, amount: disc, reason: discountReason })
      await call("kamra.pos.confirm_order", { order: r.order })
      await call("kamra.pos.fire_kot", { order: r.order })
      setDone(`Order ${r.order} sent to the kitchen — ₹${inr(total)}${room ? ` · will post to room ${room.split("-").pop()}` : ""}.`)
      setCart([]); setDiscount(""); setDiscountReason(""); setRoom(""); setTable("")
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }

  const items = cats.find((c) => c.category === activeCat)?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-800">
          <UtensilsCrossed className="size-5 text-brand-600" />Restaurant POS
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputCls + " !w-auto"} value={outlet} onChange={(e) => setOutlet(e.target.value)}>
            {outlets.map((o) => <option key={o.name} value={o.name}>{o.outlet_name}</option>)}
          </select>
          <select className={inputCls + " !w-auto"} value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">Room (post to folio)…</option>
            {rooms.map((r) => <option key={r.name} value={r.name}>Room {r.room_number}</option>)}
          </select>
          <input className={inputCls + " !w-28"} placeholder="Table" value={table} onChange={(e) => setTable(e.target.value)} />
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {done && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{done}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* menu */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c.category} onClick={() => setActiveCat(c.category)}
                className={"rounded-lg px-3 py-1.5 text-sm font-medium " +
                  (activeCat === c.category ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-600")}>
                {c.category}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((it) => (
              <button key={it.name} onClick={() => addToCart(it)}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition hover:border-brand-400 hover:shadow-sm">
                {it.image && <img src={it.image} alt="" className="h-24 w-full object-cover" />}
                <div className="p-2.5">
                  <div className="flex items-center gap-1">
                    <Leaf className={"size-3 " + (it.is_veg ? "text-emerald-600" : "text-rose-500")} aria-label={it.is_veg ? "Veg" : "Non-veg"} />
                    <span className="truncate text-sm font-medium">{it.item_name}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-700">₹{inr(it.price)}</span>
                    <Plus className="size-4 text-brand-600" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* cart */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="p-4">
            <h2 className="mb-2 font-semibold text-zinc-800">Order</h2>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-400">Tap items to add.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((l) => (
                  <div key={l.menu_item} className="border-b border-zinc-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium">{l.item_name}</span>
                      <button onClick={() => setQty(l.menu_item, -1)} className="rounded border border-zinc-300 p-0.5"><Minus className="size-3.5" /></button>
                      <span className="w-5 text-center text-sm tabular-nums">{l.qty}</span>
                      <button onClick={() => setQty(l.menu_item, 1)} className="rounded border border-zinc-300 p-0.5"><Plus className="size-3.5" /></button>
                      <span className="w-14 text-right text-sm font-semibold tabular-nums">₹{inr(l.qty * l.price)}</span>
                      <button onClick={() => setQty(l.menu_item, -l.qty)} className="text-zinc-300 hover:text-rose-500"><Trash2 className="size-3.5" /></button>
                    </div>
                    <input className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs" placeholder="Instructions (no onion, less spicy…)"
                      value={l.instructions} onChange={(e) => setInstr(l.menu_item, e.target.value)} />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input className={inputCls + " !w-24"} placeholder="Discount ₹" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                  {disc > 0 && <input className={inputCls} placeholder="Reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />}
                </div>
                <div className="space-y-1 border-t border-zinc-100 pt-2 text-sm">
                  <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span>₹{inr(subtotal)}</span></div>
                  {disc > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−₹{inr(disc)}</span></div>}
                  <div className="flex justify-between text-base font-bold"><span>Total</span><span>₹{inr(total)}</span></div>
                </div>
                <Button className="w-full" disabled={busy} onClick={sendToKitchen}>
                  <Send className="size-4" />Send to kitchen
                </Button>
                <p className="text-center text-[11px] text-zinc-400">
                  {room ? `Posts to room ${room.split("-").pop()} on delivery` : "Fires a KOT · settle at the outlet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
