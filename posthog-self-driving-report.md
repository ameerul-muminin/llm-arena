# PostHog Self-driving setup report

_Generated 2026-08-16 for project LLM Arena (id: 249640)_

## Summary

PostHog Self-driving has been configured for LLM Arena. Session Replay, Error Tracking, and Support signal sources are wired up, a 7-scout troop (5 built-in + 2 custom) is running, and two Replay Vision scanners are armed and watching. Findings will start appearing in the [Self-driving inbox](https://eu.posthog.com/project/249640/inbox) within ~30 minutes.

---

## AI data processing

**Approved.** Organisation-level AI data processing consent was confirmed before this run started.

---

## GitHub

**Connected during this run.** Account: `ameerul-muminin`. Integration id: 78217. No errors. Self-driving can now research findings in the repo and open fix PRs.

---

## Products enabled

| Product | Status | Notes |
|---|---|---|
| Session Replay | **Follow-up required** | `products-enable` tool unavailable on this deploy. Manual enable needed. Client init has no `disable_session_recording` override — server flip will take effect immediately once enabled. |
| Error Tracking | **Follow-up required** | Same tool gap. Client init has `capture_exceptions: true` — once the product is enabled server-side, exception capture is live. |
| Support (Conversations) | **Follow-up required** | Same tool gap. Additionally, tickets only arrive once an inbound channel (email / inbox / Slack) is connected in PostHog. |

**`posthog.init` check:** Clean. No `disable_session_recording` or `capture_exceptions: false` found in `instrumentation-client.ts`. Server product enables will take effect without any code change.

---

## Signal sources

| source_product | source_type | Action | Config id |
|---|---|---|---|
| `signals_scout` | `cross_source_issue` | **On by default** — no row needed | — |
| `health_checks` | `health_issue` | **Enabled** | 01a0074f-d8a6-7d26-a9dd-a29e446be190 |
| `error_tracking` | `issue_created` | **Enabled** | 01a0074f-dd8e-7828-9a63-866c655d4856 |
| `error_tracking` | `issue_reopened` | **Enabled** | 01a0074f-e077-7d58-8ec1-76745742258a |
| `error_tracking` | `issue_spiking` | **Enabled** | 01a0074f-e36b-7ba2-ad30-3974f8f25fa3 |
| `session_replay` | `session_analysis_cluster` | **Enabled** (sample rate 0.1) | 01a0074f-e70c-7368-b2b9-adb0f05b09df |
| `conversations` | `ticket` | **Enabled** (dormant until a channel is connected) | 01a0074f-e981-7f97-bbea-2e31cc0dc098 |
| `llm_analytics` | — | **Skipped** — internal only, not a user-facing responder |
| `logs` | — | **Skipped** — not a v1 responder |
| `replay_vision` | — | **Skipped** — scanners are self-authorising via `emits_signals`; no source row needed |

---

## Connected tools

| Tool | Status |
|---|---|
| GitHub Issues | **Not used** — not selected |
| Linear | **Not used** — not selected |
| Jira | **Not used** — not selected |
| Sentry | **Not used** — not selected |
| Zendesk | **Not used** — not selected |

No external tools were connected this run.

---

## Scout troop

**Run budget:** 100 runs/day (early-access default, confirmed). 0 runs used today. 3 max per tick. _Banner: "Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more."_

**Enabled (7 total):**

| Scout | Why enabled |
|---|---|
| `signals-scout-general` | Always on — cross-product correlations and uncovered surfaces |
| `signals-scout-ai-observability` | Core product surface: @openrouter + Vercel AI SDK, `features/model-call/` — LLM traces are the central feature |
| `signals-scout-product-analytics` | Prompt → vote funnel; retention tracking for this benchmarking app |
| `signals-scout-web-analytics` | Next.js web app with sessions and pageviews |
| `signals-scout-health-checks` | New project — PostHog setup health checks will catch instrumentation gaps early |
| `signals-scout-model-failures` _(custom)_ | Per-model provider failure rates — see Custom scouts section |
| `signals-scout-arena-funnel` _(custom)_ | Prompt-to-vote completion rate — see Custom scouts section |

**Disabled (22 scouts):** All remaining canonical scouts were already in `paused_by_user` / `enabled: false` state and left unchanged. Notable intentional exclusions:

| Scout | Reason |
|---|---|
| `signals-scout-error-tracking` | Covered by the native `error_tracking` signal source (issue_created / reopened / spiking) |
| `signals-scout-session-replay` | Covered by the native `session_replay` signal source (session_analysis_cluster) |
| `signals-scout-surveys` | No surveys in use |
| `signals-scout-revenue-analytics` | No payment SDK present |
| `signals-scout-feature-flags` | No feature flags in use |
| `signals-scout-experiments` | No A/B experiments in use |
| `signals-scout-logs` | Logs product not in use — enable in PostHog if you add it |
| `signals-scout-csp-violations` | No CSP reporting configured — enable if you add it |
| All others | Surface not active for this project — enable individually from the inbox if needed |

---

## Custom scouts

**2 created. Troop total: 7 enabled (under the 10-scout ceiling).**

### `signals-scout-model-failures`

- **Watches:** Per-model provider failure events (`rate-limited`, `unavailable`, `timeout`, `unauthorized`) from the server-side call layer in `features/model-call/failures.ts`
- **Discriminator:** Ratio of failures for a specific `model_id` vs its 7d baseline. A single-model spike while others hold = model-specific. All models simultaneously = provider incident (disqualified). Any `unauthorized` = API key expiry (P1).
- **Why no built-in covers it:** `signals-scout-ai-observability` watches `$ai_*` LLM analytics events (successful trace metadata). `error_tracking` native source watches `$exception` (unhandled JS). Neither sees intentionally-caught server-side provider failures mapped to `ModelCallFailure` via posthog-node. Genuinely uncovered surface.
- **Quick close-out:** Closes cheaply when Feature 6 events haven't shipped yet.
- **Noise escape hatch:** Set `emit: false` on this scout's config in PostHog to switch it to dry-run if it produces noise.

### `signals-scout-arena-funnel`

- **Watches:** Prompt-to-vote completion rate (`vote_cast / sessions_with_2+_model_answers`)
- **Discriminator:** Rate falling below 7d baseline while prompt volume holds = step-specific friction. Both falling together = overall traffic drop (not this scout's concern).
- **Why no built-in covers it:** `signals-scout-product-analytics` watches saved PostHog funnel insights — requires the user to first create and save a funnel. This scout watches proactively via direct queries before any funnel insight is built.
- **Quick close-out:** Closes cheaply when Feature 6 events (`prompt_sent`, `vote_cast`) haven't shipped yet.
- **Noise escape hatch:** Set `emit: false` on this scout's config in PostHog to switch it to dry-run if it produces noise.

**Surfaces considered and ruled out:**

| Surface | Filter that killed it |
|---|---|
| Per-model latency regression | Already covered by `signals-scout-ai-observability` (LLM traces sliced by model) |
| Leaderboard data freshness | Events don't exist yet (Features 3/9 not built); revisit when voting is live |
| OpenRouter simultaneous outage | Disqualified as noise in `model-failures` scout (multi-model simultaneous = provider incident) |
| Arena vote completion (after saved funnels) | `signals-scout-product-analytics` covers it once funnels are saved — overlap avoided |

---

## Replay Vision scanners

A Replay Vision scanner is an LLM that watches individual session recordings on a schedule, writes an observation per recording, and — with `emits_signals: true` — pushes findings straight to the Self-driving inbox. Findings arrive at half weight; they need corroboration (a second independent scanner seeing the same defect) before promoting into a report. These are the only components in this setup that spend Replay Vision quota.

The project has no recordings yet. Both scanners are armed and start working the day recordings begin, with no second setup needed.

**Credit spend verification:** The `creating-replay-vision-scanners` skill was not available on this deploy. Spend was not formally estimated. Both scanners are narrowly scoped (small queries, `sampling_rate ≤ 1.0`) and showed `estimated_monthly_credits: 0` at creation (no recordings yet), so no budget risk was evident.

| Scanner | Query scope | Sampling rate | What it watches | Status |
|---|---|---|---|---|
| **Broken experiences** | `$current_url exact /` (the arena home, where the prompt/vote flow will live) | 0.5 | Visible product breakage: error messages, blank screens, broken layouts, spinners that never resolve, buttons that do nothing | **Created** (id: 01a0075c-e5a9-7327-a640-d64a3a5a56c5) |
| **User frustration** | Sessions containing `$rageclick` events | 1.0 | User getting stuck: rage-clicking, retrying failed actions, hunting for unavailable things, abandoning flows | **Created** (id: 01a0075d-0cfe-7343-bbf3-a40e0a1d20f4) |

**Query rationale:** Scanner 1 scopes to `/` — the home route where the arena and voting flow will live per `docs/scope.md`. No dedicated arena route exists yet (Feature 6 not built); `/` is the correct scope based on the planned product structure. When the arena gets its own route (e.g. `/arena`), update the scanner's query to match. Scanner 2 uses `$rageclick` as its only filter, keeping the two queries fully disjoint.

---

## Follow-ups

- [ ] **Enable Session Replay** in PostHog: Settings → Session Replay → "Record user sessions". The `products-enable` MCP tool was unavailable this run.
- [ ] **Enable Error Tracking** in PostHog: Settings → Error Tracking → "Enable exception autocapture". Same tool gap.
- [ ] **Enable Support (Conversations)** in PostHog: product sidebar. Same tool gap.
- [ ] **Connect a Support inbound channel** (email / inbox / Slack) in PostHog so the `conversations / ticket` signal source receives tickets. The source row is enabled and waiting.
- [ ] **Instrument Feature 6 events** (`prompt_sent`, `model_answered`, `vote_cast`, and model failure events) via posthog-node / posthog-js when Feature 6 ships. Both custom scouts close cheaply until these events exist.
- [ ] **Instrument `$ai_*` LLM analytics** per PostHog's AI-SDK integration docs when wiring PostHog in Feature 6. This feeds `signals-scout-ai-observability`.
- [ ] **Update Replay Vision scanner 1** (`Broken experiences`) query from `$current_url exact /` to the real arena route if the arena moves off the home page.
- [ ] **Enable any disabled scouts** you later need (feature flags, experiments, logs, etc.) from the [Self-driving inbox](https://eu.posthog.com/project/249640/inbox).

---

## What happens next

The scout coordinator picks up the newly-enabled configs within ~30 minutes and schedules the first runs. Each enabled scout draws one run from the project's daily budget (100 runs/day during early access). Scout findings cluster into reports in the [inbox](https://eu.posthog.com/project/249640/inbox); immediately-actionable reports can spawn coding tasks that Self-driving works on autonomously. Replay Vision scanners begin observing as soon as session recordings start arriving.
