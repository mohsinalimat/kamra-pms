import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  Check,
  Clock,
  Inbox,
  ListChecks,
  Loader2,
  Power,
  Users,
  X,
  Zap,
} from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card"
import { cn } from "../lib/utils"

type Tab = "team" | "inbox" | "timeline"

interface AutonomyRule {
  action_type: string
  autonomy: "Full" | "Suggest" | "Approve"
  threshold_field: string | null
  threshold_operator: string | null
  threshold_value: number | null
}

interface AgentRow {
  name: string
  agent_name: string
  persona: string
  active: 0 | 1
  property: string | null
  trigger_type: "Event" | "Cron" | "Webhook"
  schedule_cron: string | null
  channel: string
  model: string | null
  default_approver: string | null
  modified: string
  tools: string[]
  autonomy_rules: AutonomyRule[]
  last_action_at: string | null
  minutes_saved_week: number
  pending_count: number
}

interface PendingRow {
  name: string
  agent: string
  action_type: string
  status: string
  property: string | null
  summary: string
  action_endpoint: string
  reference_doctype: string | null
  reference_name: string | null
  requested_by: string | null
  action_log: string | null
  approver: string | null
  decision_note: string | null
  expires_at: string | null
  resolved_at: string | null
  creation: string
  before_snapshot?: Record<string, unknown> | null
  after_snapshot?: Record<string, unknown> | null
}

interface TimelineRow {
  name: string
  agent_name: string
  action_type: string
  autonomy: string
  approval_status: string
  action_channel: string | null
  reference_doctype: string | null
  reference_name: string | null
  property: string | null
  minutes_saved: number
  rationale: string
  approver: string | null
  executed_at: string | null
  creation: string
}

interface SavingsSummary {
  days: number
  channels: { channel: string; actions: number; minutes: number }[]
  total_minutes: number
  total_hours: number
}

const personaTone: Record<string, "brand" | "sky" | "amber" | "zinc" | "green"> = {
  "Front Desk Copilot": "brand",
  Revenue: "sky",
  Housekeeping: "green",
  "Voice Concierge": "amber",
  "WhatsApp Concierge": "green",
  "Night Auditor": "zinc",
  Sales: "sky",
  Collections: "amber",
  "Owner Digest": "brand",
  Custom: "zinc",
}

const statusTone: Record<string, "zinc" | "sky" | "amber" | "rose" | "green"> = {
  Executed: "green",
  Suggested: "sky",
  Pending: "amber",
  Approved: "green",
  Rejected: "rose",
  Expired: "zinc",
}

export default function Agents() {
  const [tab, setTab] = useState<Tab>("team")
  const property = getCurrentProperty()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Bot className="size-6 text-brand-600" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
        </div>
        <p className="text-sm text-zinc-500">
          The team of AI helpers running your property. Everything they do is
          logged, and money-moving actions wait for your tap.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Agents view"
        className="inline-flex rounded-lg border border-zinc-200 bg-white p-1"
      >
        <TabButton current={tab} value="team" onSet={setTab} icon={Users}>
          Team
        </TabButton>
        <TabButton current={tab} value="inbox" onSet={setTab} icon={Inbox}>
          Inbox
        </TabButton>
        <TabButton current={tab} value="timeline" onSet={setTab} icon={Clock}>
          Timeline
        </TabButton>
      </div>

      {tab === "team" && <TeamTab property={property} />}
      {tab === "inbox" && <InboxTab property={property} />}
      {tab === "timeline" && <TimelineTab property={property} />}
    </div>
  )
}

function TabButton({
  current,
  value,
  onSet,
  icon: Icon,
  children,
}: {
  current: Tab
  value: Tab
  onSet: (v: Tab) => void
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  const active = current === value
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onSet(value)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Team tab
// ---------------------------------------------------------------------------

function TeamTab({ property }: { property: string }) {
  const [rows, setRows] = useState<AgentRow[]>([])
  const [savings, setSavings] = useState<SavingsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      call<AgentRow[]>("kamra.agents_api.agents_list", {
        property,
        include_inactive: 1,
      }),
      call<SavingsSummary>("kamra.agents_api.agents_savings_summary", {
        property,
        days: 7,
      }),
    ])
      .then(([agents, s]) => {
        setRows(agents)
        setSavings(s)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [property])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(agent: AgentRow) {
    setBusy(agent.name)
    try {
      await call("kamra.agents_api.toggle_agent", {
        agent: agent.name,
        active: agent.active ? 0 : 1,
      })
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (loading && !rows.length) {
    return <LoadingRow />
  }

  return (
    <div className="space-y-4">
      {savings && <SavingsBanner s={savings} />}
      {error && <ErrorBanner message={error} />}
      {!rows.length && (
        <EmptyState
          icon={Users}
          title="No agents yet"
          note="Kamra seeds Front Desk Copilot, Night Auditor and Owner Digest on new-property install. Run the seed script to add them."
        />
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((agent) => (
          <AgentCard
            key={agent.name}
            agent={agent}
            busy={busy === agent.name}
            onToggle={() => toggle(agent)}
          />
        ))}
      </div>
    </div>
  )
}

function SavingsBanner({ s }: { s: SavingsSummary }) {
  return (
    <Card className="border-brand-100 bg-brand-50/40">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-brand-600" aria-hidden />
          <div>
            <div className="text-2xl font-semibold tracking-tight text-brand-700">
              {s.total_hours}h
            </div>
            <div className="text-xs text-brand-600/70">
              clerical time saved last {s.days} days
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {s.channels.map((c) => (
            <span
              key={c.channel}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200"
            >
              {c.channel} · {c.actions} actions
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function AgentCard({
  agent,
  busy,
  onToggle,
}: {
  agent: AgentRow
  busy: boolean
  onToggle: () => void
}) {
  const tone = personaTone[agent.persona] ?? "zinc"
  return (
    <Card
      className={cn(
        !agent.active && "opacity-60",
        agent.pending_count > 0 && "ring-2 ring-amber-300",
      )}
    >
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {agent.agent_name}
              {agent.pending_count > 0 && (
                <Badge tone="amber">
                  {agent.pending_count} pending
                </Badge>
              )}
            </CardTitle>
            <div className="mt-0.5 text-xs text-zinc-500">
              {agent.persona}
              {agent.property ? ` · ${agent.property}` : " · Chain-global"}
            </div>
          </div>
          <button
            onClick={onToggle}
            disabled={busy}
            aria-label={agent.active ? "Pause agent" : "Resume agent"}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border transition",
              agent.active
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-zinc-300 bg-zinc-50 text-zinc-500 hover:bg-zinc-100",
            )}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Power className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={tone}>{agent.trigger_type}</Badge>
          {agent.trigger_type === "Cron" && agent.schedule_cron && (
            <Badge tone="zinc">cron: {agent.schedule_cron}</Badge>
          )}
          <Badge tone="zinc">{agent.channel}</Badge>
          {agent.model && <Badge tone="zinc">{agent.model}</Badge>}
        </div>

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Tools" value={agent.tools.length} />
          <Stat label="Autonomy rules" value={agent.autonomy_rules.length} />
          <Stat
            label="Saved (7d)"
            value={formatMinutes(agent.minutes_saved_week)}
          />
        </dl>

        {agent.tools.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700">
              Show tools & rules
            </summary>
            <div className="mt-2 space-y-2">
              <ToolList tools={agent.tools} />
              <AutonomyList rules={agent.autonomy_rules} />
            </div>
          </details>
        )}

        {agent.last_action_at && (
          <div className="text-xs text-zinc-400">
            Last active {relativeTime(agent.last_action_at)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-1.5">
      <div className="font-semibold text-zinc-800">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400">
        {label}
      </div>
    </div>
  )
}

function ToolList({ tools }: { tools: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((t) => (
        <code
          key={t}
          className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700"
        >
          {t}
        </code>
      ))}
    </div>
  )
}

function AutonomyList({ rules }: { rules: AutonomyRule[] }) {
  if (!rules.length) {
    return <p className="text-xs text-zinc-400">No overrides — all Full.</p>
  }
  return (
    <ul className="space-y-1 text-xs">
      {rules.map((r) => (
        <li key={r.action_type} className="flex flex-wrap items-baseline gap-2">
          <code className="font-mono text-[10px] text-zinc-500">
            {r.action_type}
          </code>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
              r.autonomy === "Full" && "bg-emerald-50 text-emerald-700",
              r.autonomy === "Suggest" && "bg-sky-50 text-sky-700",
              r.autonomy === "Approve" && "bg-amber-50 text-amber-700",
            )}
          >
            {r.autonomy}
          </span>
          {r.threshold_field && (
            <span className="text-[10px] text-zinc-500">
              when {r.threshold_field} {r.threshold_operator} {r.threshold_value}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Inbox tab
// ---------------------------------------------------------------------------

function InboxTab({ property }: { property: string }) {
  const [rows, setRows] = useState<PendingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    call<PendingRow[]>("kamra.agents_api.pending_actions", {
      property,
    })
      .then((r) => {
        setRows(r)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [property])

  useEffect(() => {
    load()
  }, [load])

  async function approve(row: PendingRow) {
    setBusy(row.name)
    try {
      await call("kamra.agents_api.approve_action", {
        pending: row.name,
        note,
      })
      setNote("")
      setExpanded(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function reject(row: PendingRow) {
    setBusy(row.name)
    try {
      await call("kamra.agents_api.reject_action", {
        pending: row.name,
        reason: note,
      })
      setNote("")
      setExpanded(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (loading && !rows.length) return <LoadingRow />

  return (
    <div className="space-y-3">
      {error && <ErrorBanner message={error} />}
      {!rows.length && (
        <EmptyState
          icon={Inbox}
          title="Inbox is empty"
          note="Nothing waiting for your tap. Agents with Approve autonomy will land things here."
        />
      )}
      {rows.map((row) => (
        <Card key={row.name} className="border-amber-200">
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                  {row.summary}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>from {row.requested_by || row.agent}</span>
                  <span>·</span>
                  <span>{relativeTime(row.creation)}</span>
                  {row.reference_name && (
                    <>
                      <span>·</span>
                      <a
                        href={referenceLink(row)}
                        className="text-brand-600 hover:underline"
                      >
                        {row.reference_name}
                      </a>
                    </>
                  )}
                </div>
              </div>
              <Badge tone="amber">{row.action_type}</Badge>
            </div>

            {(row.before_snapshot || row.after_snapshot) && (
              <SnapshotDiff
                before={row.before_snapshot}
                after={row.after_snapshot}
              />
            )}

            {expanded === row.name ? (
              <div className="space-y-2 rounded-lg bg-zinc-50 p-3">
                <label className="block text-xs font-medium text-zinc-600">
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                  placeholder="Why you're approving or rejecting…"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => approve(row)}
                    disabled={busy === row.name}
                  >
                    {busy === row.name ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                    Approve & run
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => reject(row)}
                    disabled={busy === row.name}
                  >
                    <X className="size-4" aria-hidden />
                    Reject
                  </Button>
                  <button
                    className="ml-auto text-xs text-zinc-500 hover:text-zinc-700"
                    onClick={() => {
                      setExpanded(null)
                      setNote("")
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setExpanded(row.name)}>
                Review
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SnapshotDiff({
  before,
  after,
}: {
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}) {
  const beforeStr = before ? JSON.stringify(before, null, 2) : "—"
  const afterStr = after ? JSON.stringify(after, null, 2) : "(pending — not yet applied)"
  return (
    <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Before
        </div>
        <pre className="max-h-40 overflow-auto rounded-md bg-zinc-50 p-2 font-mono text-[11px] text-zinc-700">
          {beforeStr}
        </pre>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          After (proposed)
        </div>
        <pre className="max-h-40 overflow-auto rounded-md bg-amber-50 p-2 font-mono text-[11px] text-amber-800">
          {afterStr}
        </pre>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline tab
// ---------------------------------------------------------------------------

function TimelineTab({ property }: { property: string }) {
  const [rows, setRows] = useState<TimelineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<string>("")
  const [status, setStatus] = useState<string>("")

  const load = useCallback(() => {
    setLoading(true)
    call<TimelineRow[]>("kamra.agents_api.agent_timeline", {
      property,
      channel: channel || null,
      approval_status: status || null,
      days: 7,
      limit: 200,
    })
      .then((r) => {
        setRows(r)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [property, channel, status])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    const byAgent = new Map<string, TimelineRow[]>()
    for (const r of rows) {
      const list = byAgent.get(r.agent_name) ?? []
      list.push(r)
      byAgent.set(r.agent_name, list)
    }
    return Array.from(byAgent.entries())
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm"
          aria-label="Filter by channel"
        >
          <option value="">All channels</option>
          <option value="Desk">Desk</option>
          <option value="Voice">Voice</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="API">API</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="Executed">Executed</option>
          <option value="Suggested">Suggested</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <div className="ml-auto text-xs text-zinc-500 self-center">
          {rows.length} events · last 7 days
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && !rows.length && <LoadingRow />}
      {!loading && !rows.length && (
        <EmptyState
          icon={ListChecks}
          title="Nothing in the last 7 days"
          note="Try widening the filter, or wait for the agents to do something."
        />
      )}

      <div className="space-y-4">
        {grouped.map(([agent, list]) => (
          <div key={agent}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              {agent} · {list.length}
            </h3>
            <ol className="space-y-1.5">
              {list.map((row) => (
                <li
                  key={row.name}
                  className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <Badge tone={statusTone[row.approval_status] ?? "zinc"}>
                    {row.approval_status}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <code className="font-mono text-xs text-zinc-700">
                        {row.action_type}
                      </code>
                      {row.reference_name && (
                        <a
                          href={referenceLink({
                            reference_doctype: row.reference_doctype,
                            reference_name: row.reference_name,
                          } as PendingRow)}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          {row.reference_name}
                        </a>
                      )}
                      {row.minutes_saved > 0 && (
                        <span className="text-xs text-emerald-600">
                          +{Math.round(row.minutes_saved)}m saved
                        </span>
                      )}
                    </div>
                    {row.rationale && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {row.rationale}
                      </p>
                    )}
                  </div>
                  <div className="whitespace-nowrap text-xs text-zinc-400">
                    {relativeTime(row.executed_at || row.creation)}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function LoadingRow() {
  return (
    <p className="py-10 text-center text-sm text-zinc-400">
      <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden />
      Loading…
    </p>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {message}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  note: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 py-10 text-center">
      <Icon className="mx-auto mb-2 size-6 text-zinc-400" aria-hidden />
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{note}</p>
    </div>
  )
}

function formatMinutes(min: number): string {
  if (!min) return "—"
  if (min < 60) return `${Math.round(min)}m`
  return `${(min / 60).toFixed(1)}h`
}

function relativeTime(iso: string | null): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function referenceLink(row: {
  reference_doctype: string | null
  reference_name: string | null
}): string {
  const dt = row.reference_doctype
  const name = row.reference_name
  if (!dt || !name) return "#"
  if (dt === "Reservation") return `/reservations?q=${encodeURIComponent(name)}`
  if (dt === "Folio") return `/billing/${encodeURIComponent(name)}`
  if (dt === "Guest") return `/guests/${encodeURIComponent(name)}`
  if (dt === "Season") return `/seasons`
  if (dt === "Service Ticket") return `/tickets`
  return "#"
}
