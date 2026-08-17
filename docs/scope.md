# Scope: LLM Arena

Send one prompt, watch up to three AI models answer it at the same time, and vote for the best one. Over time those votes and the real per-call numbers, speed, tokens, cost, build an honest leaderboard of which model is actually worth using.

Build it in a thin, working slice first, one prompt actually reaching a model and coming back, before making any single part of it fuller. Then thicken it piece by piece. Before building anything, decide what you're doing and why in a few plain sentences, then build it, and if the plan turns out wrong once it's actually built, say so and fix the plan too, not just the code.

Whenever a "build it" style step actually gets underway, break it into its own short list of what's genuinely being done, and check each part off as it's finished, right in this file. That way this file can be opened fresh, in a brand new conversation, and it's obvious what's already done and what's still left, without anyone re-explaining the feature from scratch.

## Stack

Already decided, nothing open here: Next.js (App Router), TypeScript, Tailwind, shadcn for components (card, button, popover, loading skeleton, and whatever else the UI actually needs as it gets built), Prisma with Postgres, Clerk for auth, Arcjet in front of the endpoint, PostHog for analytics and observability.

## Sketches

There are rough hand-drawn sketches for the arena screen, the leaderboard, and the models page. Treat them as structure only, where things sit, what exists on the page, not as the final design or the actual colors, all of that is already decided elsewhere in this file. If something in a sketch genuinely contradicts what's written here, stop and ask which one actually wins rather than guessing.

## At a glance

| #   | Feature                                     | Phase      | Status      |
| --- | ------------------------------------------- | ---------- | ----------- |
| 1   | Connecting to a model                       | Foundation | done        |
| 2   | Coding standards & tooling                  | Foundation | not started |
| 3   | Data model                                  | Foundation | not started |
| 4   | Design & look                               | Foundation | not started |
| 5   | Model picker                                | Slice 1    | not started |
| 6   | Send a prompt, parallel streams, and voting | Slice 1    | Arcjet done, rest not started |
| 7   | App shell & thread history                  | Slice 2    | not started |
| 8   | Public thread visibility & sharing          | Slice 3    | not started |
| 9   | Leaderboard: global & personal              | Slice 4    | not started |

## Verification pass, 2026-08-17

A deliberate stop to confirm what is actually wired up works, before adding anything else. Everything below was exercised against a running dev server, not read.

**Working, verified live**

- `pnpm build`, `tsc --noEmit`, and `eslint` all clean.
- Env fail-fast: server refuses to start without a required key, naming it.
- OpenRouter streaming: real token deltas and real metrics through the whole path.
- Arcjet shield + bot detection: denies, with our own sentence, never the provider's.
- Arcjet token bucket: 36 rapid calls → 29 allowed then 429, refilling as configured.
- Prisma: connects to Postgres and executes SQL.
- PostHog: `/ingest` proxy rewrites resolve; no client or server errors in the log.

**Found broken, fixed in this pass**

- Prisma had been scaffolded but never installed — `prisma`, `@prisma/client`, `@prisma/adapter-pg`, and `dotenv` were all absent and the build failed on three missing modules. Installed, and `@prisma/engines` allowed to run its postinstall since it fetches the query engine.
- `lib/prisma.ts` imported the client from `app/generated/prisma`, but the schema generates to `lib/generated/prisma`. Pointed at the real path.
- `prisma.config.ts` loaded `.env` via `dotenv/config`, but this project keeps secrets in `.env.local`, so every Prisma CLI command failed on a missing datasource. Now loads `.env.local` first.
- `lib/prisma.ts` read `process.env.DATABASE_URL!`. A non-null assertion on a required secret is exactly the silent failure the rules forbid; it now goes through `getEnv()`, and `DATABASE_URL` joins the startup check.

**Known broken, not fixed**

- **Prompt injection detection is unreliable on this Arcjet account.** Run the same jailbreak payload repeatedly and it denies some and lets others through. `arcjet requests explain` proves the rule is correctly provisioned and configured — when it runs it concludes `DENY` with `state: RUN`. So this is not our config, not the SDK, and not the decision deadline (that was a separate bug, already fixed).

  Two distinct causes, worth keeping apart:

  1. **Availability.** The rule sometimes cannot be evaluated at all, logging `Unable to detect prompt injection - contact Arcjet support`, which fails open. Arcjet's pricing page lists prompt scanning as a metered add-on billed at $2 per million tokens, and says there are "no hard request limits on paid accounts" while the 15-day trial "has usage limits". That points at a trial quota or unconfigured billing on the add-on rather than anything wrong in this repo — which matches the symptom exactly, since a hard failure would never succeed and a broken config would never succeed either.
  2. **Accuracy.** Separately, the rule has been observed running and concluding `ALLOW` on an obvious jailbreak. That is a false negative, not an outage, and no amount of billing fixes it. Detection is a useful layer, never a guarantee.

  Coverage is now measured rather than assumed, in `features/model-call/protection.ts`. Any rule that fails to evaluate is logged and captured as an `arcjet_failed_open` PostHog event carrying `prompt_injection_unchecked`, so the honest question "what fraction of prompts were actually screened?" has a real answer.

  Determining whether the injection rule ran is done by absence, not by reading the error. A rule that runs leaves a result carrying its own type whatever it concluded; a rule that fails leaves a result typed only `ERROR`, with no trace of which rule it was. Verified against live decision payloads — an earlier version of this check looked for `PROMPT_INJECTION_DETECTION` among the errored results and was silently always false.
- ~~**Clerk is not wired at all.**~~ Done. Pulled forward out of feature 3, see below.

## Clerk, pulled forward out of feature 3

Feature 3 originally owned Clerk, alongside the data model. Moved because the IP-keyed rate limit was a live weakness rather than a future one — an office or cafe behind one NAT shared a single 30-token allowance — and because every table feature 3 will add (users, threads, votes) needs a real user id as a foreign key. Building auth first means the schema is designed against something that exists instead of a placeholder to be migrated later. It was also cheap now and expensive later: today it touched a handful of files; after threads and votes exist it would have touched the schema too.

**Public by default, protected at the resource.** `proxy.ts` establishes the auth context and guards nothing. Only `POST /api/model-call` requires a signed-in user, which matches feature 8's rule that a thread is readable by anyone with the link and only sending or voting needs an account. This is also what Clerk recommends over guarding routes from the middleware layer.

**Next.js 16 renamed `middleware` to `proxy`.** Clerk's docs cover both and name `proxy.ts` for 16, so this is not a workaround. The build output lists it as `ƒ Proxy (Middleware)`.

**Clerk v7 is Core 3, and `<SignedIn>` / `<SignedOut>` no longer exist.** They are replaced by a single `<Show when="signed-in" | "signed-out">`. The old components typecheck fine and fail only at render, so the production build caught this where `tsc` could not — a good argument for the rule that a real build has to run, not just a typecheck.

**What changed.** `characteristics: ["userId"]` on the token bucket, with the id from `auth()` on the server and never from a client-supplied header. A refusal for a signed-out caller is a `sign-in-required` failure carrying a plain sentence and `retryable: false`, since retrying changes nothing and signing in does. PostHog now keys on the Clerk id on both sides, so a person's events and their rate limit refer to the same someone across devices. Both Clerk keys joined the startup fail-fast list.

Verified: signed-out `POST` returns 401 with the plain sentence, and `/dev-stream` still loads for a signed-out visitor. The signed-in path needs a browser and is listed below.

- [x] Install, provider, proxy, env fail-fast
- [x] Sign-in required on the model-call route only
- [x] Token bucket keyed by the Clerk user id
- [x] PostHog identified with the Clerk user
- [x] Signed-in end-to-end check in a browser — confirmed working

**No identity ever travels from the browser.** An earlier version passed the PostHog distinct id to the server as an `x-posthog-distinct-id` header. Once `auth()` supplied a trusted id, that header became not just dead but a liability: a client-controlled identity value sitting on the endpoint that enforces the rate limit, one careless change away from being trusted and spoofed. Removed, along with the generic header passthrough that existed only to carry it. Client and server events line up anyway, because both now key on the Clerk id.
- ~~**`tokensPerSecond` is misleading for models that buffer.**~~ Fixed. See "Speed, and why there are two numbers" under feature 1.

## Foundation

### 1. How the app actually connects to a model

The Next.js project itself gets created manually first, `create-next-app`, fast and simple, no reason to spend agent time or tokens on something that easy.

Two real decisions were open once that exists: how the app calls OpenRouter to get a model's answer, and how streaming three models back to the browser at once should actually work. This one's worth real thought: routing all three through one shared connection looks simpler, but if that one connection drops, all three answers die together, which breaks the whole point of one model failing never affecting the others.

#### Decided

**Transport: one request per model, never multiplexed.** Three independent POSTs, each returning its own stream, each with its own `AbortController` on the client. This is the only shape where a 429, a timeout, or a dropped socket on one model is genuinely invisible to the other two. A single multiplexed stream would need per-model framing plus its own reconnect logic just to get back to the same guarantee, which is more code for a weaker failure story. Not revisited.

**Call layer: Vercel AI SDK with the OpenRouter provider** (`ai` + `@openrouter/ai-sdk-provider`). Chosen over a hand-rolled fetch wrapper and over the OpenAI SDK with a custom `baseURL`. It hands us streaming, usage parsing, and React streaming hooks rather than us owning SSE parsing and usage-chunk quirks, and PostHog's LLM analytics has a documented AI-SDK integration path, which matters for feature 6's per-call token/cost/latency capture. The tradeoff accepted: its abstraction sits between us and the raw SSE, so time-to-first-token and tokens-per-second get measured off its stream callbacks rather than read off the wire directly. That's fine as long as the clock starts at request dispatch and stops at the first and last text delta, measured in one place.

**Shape of the code.** A `callModel(modelId, messages)` returning a typed event stream (`delta`, `usage`, `done`, `error`) plus a metrics object carrying TTFT, tokens/sec, and total tokens, computed from real wall-clock at first and last delta. Functional core, side effects at the edge: the route handler's only job is turning that into a streamed `Response`, and the UI only ever renders what the metrics object already says. Errors never leak provider text, they map to a small closed union of human-readable failures with a retry action.

**Env fails fast.** One module parses `process.env` at load and throws a named error listing every missing key. Anything touching config imports it, so a missing key is a startup failure, never a silent runtime one.

#### What the build actually turned out to be

Two places the plan above met reality and the plan is the thing that changed.

**The AI SDK is used for the provider call, not for the transport to the browser.** `streamText().fullStream` gives us deltas, finish reason, and token usage without owning SSE parsing, which is exactly what it was picked for. Its React streaming hooks are deliberately not used, because they carry the SDK's own UI message shape and this app's contract is a per-model metrics object the card, the leaderboard, and PostHog all have to agree on. So the wire is our own: newline-delimited JSON, one typed `ModelCallEvent` per line, decoded through validators that drop anything unrecognised rather than trusting it. Readable with plain `curl`, and it keeps the metrics contract ours end to end.

**Env validation runs from `instrumentation.ts`, not at module load.** `readEnv` is a pure function over a source object; `instrumentation.ts`'s `register` calls it once, before the server takes its first request. Doing it at module load inside the route instead would have made `next build` itself require a live API key, which is wrong — a build is not a run. Verified by hand: starting the server with no key logs `MissingEnvError: Missing required environment variable: OPENROUTER_API_KEY`, naming the key and pointing at `.env.example`.

Files, all under `features/model-call/` except where noted: `types.ts` (the event, metrics, and closed failure union), `metrics.ts` (pure timing maths, nothing derived anywhere else), `failures.ts` (provider error → plain sentence + retryable flag; the real detail goes to the server log only), `request.ts` (strict body validation, model ids matched against a `vendor/model[:tag]` pattern), `call-model.ts` (the generator, dependency-injected clock and model factory), `wire.ts` (encode/decode/split, pure), `stream-response.ts` (the only HTTP-aware file), `client.ts` (browser reader). Plus `env.ts` and `instrumentation.ts` at the root, `app/api/model-call/route.ts`, and the throwaway `app/dev-stream/` harness.

Anything the provider does not report stays `null` and renders as an em dash. Nothing is ever zero-filled to look complete.

#### Speed, and why there are two numbers

The first version of this measured `tokensPerSecond` as output tokens over the span from first delta to last delta, described as "real generation speed". That was wrong in two separate ways, both caught by actually looking at the numbers rather than trusting them.

**Some models do not stream.** They think for seconds, then flush the entire answer at once. The first-to-last-delta window that produces is milliseconds wide, so the division exploded: one real run reported **11,090 tok/s** over an 11ms window. Every input was honestly measured and the output was nonsense.

**Reasoning tokens are not written tokens.** A reasoning model spends its thinking before it emits a word, so those tokens exist nowhere inside the streamed window. Counting them against it inflated a real measurement by roughly ninefold — 281 output tokens over a 483ms window read as 582 tok/s, when only 30 of those tokens were ever streamed as text.

So there are now two speed numbers, because there are honestly two different things to say:

- **`tokensPerSecond`** — generation speed, the tokens actually streamed as text over the window they arrived in. Reported only when the answer genuinely arrived over time: at least four separate chunks, and at least 50ms of window to divide by. Otherwise `null`, and `streamed: false` says why, so the UI can print "arrived in one chunk" instead of an unexplained blank. A single flush has no observable generation speed and we decline to invent one.
- **`endToEndTokensPerSecond`** — everything the model produced, thinking included, over the whole wait from dispatch to close. Always defined, for streaming and buffering models alike, which makes it the only speed that compares fairly across models. **The leaderboard ranks on this one.** Ranking on generation speed would silently exclude every buffering model.

The chunk-count threshold matters more than the time one. An early version used a 250ms floor and threw away a legitimate measurement from a model that sent 36 chunks in 191ms — that model really did stream, it was simply fast. The number of separate arrivals is the honest structural evidence; the time floor only exists to stop the division blowing up.

Output tokens are also split into `textTokens` and `reasoningTokens`. One run reported 480 output tokens for a three-sentence answer, of which 436 were reasoning. Shown as a single figure that reads as absurd verbosity.

Verified across three models: a fast streamer (48 chunks, 178 tok/s), a slow one (68 chunks, 88 tok/s), and one that returned three chunks and correctly reported no generation speed at all.

The `/dev-stream` harness is deliberately unstyled past legibility, labels, and visible focus. It commits to no visual direction, feature 4 still owns that entirely, and the page gets deleted once the real arena screen exists.

#### Scope correction

Feature 1 originally also said to wire Prisma, Clerk, Arcjet, and PostHog here, with PostHog session replay on from the start. That contradicts this file's own "thin, working slice first" rule, and it overlaps features 3 and 6. None of the four are needed for a prompt to reach a model and come back. Feature 1 is now narrowed to: env validation, the OpenRouter call layer, the streaming transport, and one throwaway route plus page proving a real token stream renders in a browser. Prisma and Clerk move to feature 3, Arcjet and all PostHog wiring (funnel events, LLM analytics, session replay tied to the Clerk user) move to feature 6.

- [x] Decide the approach
- [x] Build it: env module that fails fast on missing keys — verified, server refuses to start and names the key
- [x] Build it: `callModel` with typed event stream and honest TTFT / tok-per-sec / total-token metrics
- [x] Build it: per-model streaming route handler, independently abortable
- [x] Build it: throwaway harness page at `/dev-stream`
- [x] Typecheck, lint, and production build all clean
- [x] Verify a real token stream end to end in a browser — confirmed, text renders progressively rather than landing in one lump
- [x] Honest speed metrics: generation speed stated only when the answer genuinely streamed, end-to-end throughput always, reasoning tokens split out

Feature 1 is done.

### 2. Coding standards & tooling

Write down the real conventions for this project once it actually exists, then install linting, formatting, and a pre-commit hook that actually enforces them.

- [ ] Decide the approach
- [ ] Install lint, format, and whatever else is needed, and write it up in a coding-standards doc

### 3. Data model

The core things every feature depends on: users tied to Clerk, threads, each model's own messages inside a thread, and votes. A vote should only ever be possible on a turn where two or more models actually answered.

- [ ] Decide the approach
- [ ] Build it

### 4. Design & look

A coffee or dark brown background, warm, not neutral gray or true black. One accent color, rust, used only for things you interact with, buttons, links, focus states, the win-rate bar, never as decoration. Because the background and the accent are both warm tones from the same family, the accent has to stay clearly brighter and more saturated than the background, enough that a button never blends into the page behind it, that's a real risk with two warm colors this close and worth checking by eye, not just by the numbers. Blue, indigo, and purple are never the accent, under any circumstance. Green is reserved only for marking a winner, red only for errors, never reused for anything else. Contrast should genuinely hold up in both light and dark mode, not just look fine at a glance.

- [ ] Decide the approach
- [ ] Build it

## Slice 1: Core arena loop

### 5. Model picker

An "Add model" popover pulling OpenRouter's live free-tier list, sorted by context window, capped at three models, defaulting to all three selected, with removable chips next to the prompt box. Also render that same catalog as a simple `/models` page, name, context window, and pricing for each one, so anyone can browse the full list without opening the picker.

- [ ] Decide the approach
- [ ] Build it

### 6. Send a prompt, parallel streams, and voting

The heart of the product. One prompt goes to every selected model at once, each streaming and failing independently, so one being slow or down never blocks the others. Each answer shows its own real time-to-first-token, tokens per second, and total tokens. No cost shown, every model here is free tier, so it would always read zero. A vote only exists once two or more models have answered, and picking one writes exactly one vote and marks that answer as the winner, while every answer stays visible the whole time. A follow-up continues each model's own separate conversation.

Arcjet sits in front of this endpoint before any model is ever called: rate limiting, bot protection, and a shield against prompt injection, plus a real limit on how much one person can use across all three models at once, not just a limit on the endpoint overall.

#### Arcjet: built early, ahead of the rest of this feature

Pulled forward out of order, because the route it protects already exists. Lives in `lib/arcjet.ts` (client and rules) and `features/model-call/protection.ts` (decision → this app's own failure vocabulary). `protect()` runs inside the route handler before `callModel`, so a denied request never costs a provider call.

Four rules, all LIVE: `shield`, `detectBot` (empty allow list, so every detected bot is denied), `detectPromptInjection`, and a `tokenBucket` at capacity 30 refilling 10 per minute.

**Why a token bucket and not a plain per-request limit.** Our transport is one HTTP request per model, so a prompt sent to three models is three requests. A per-request limit would quietly punish people for using the arena the way it is meant to be used — three models would burn budget three times faster for the same single prompt, with no way to tell that was happening. The bucket spends one token per model call, so budget tracks real model usage. A three-model prompt genuinely costs three times a one-model prompt, because it genuinely is three times the work.

**Denials keep the app's voice.** Arcjet's reasons never reach the browser. They map to failure kinds — `rate-limited` (429), `flagged` for prompt injection (400), `blocked` for bot/shield/filter (403) — each carrying a plain sentence and a retry flag, exactly like every other failure. The refusal is streamed as a normal one-event NDJSON body with the real HTTP status, so the browser reads it through the same path as a success and the human sentence survives. `isErrored()` fails open, logs, and lets the request through: a bad moment at the security service must not take the app down.

**The decision deadline had to be raised to 5s.** The SDK defaults to 500ms in production and 1s in development. Shield and bot detection answer well inside that, but prompt injection analysis never did — it timed out on every single attempt, and a timeout fails open, meaning the rule silently did nothing at all. A security rule that quietly never runs is worse than no rule, because it looks like protection. Five seconds is spent before a model call that already takes far longer.

Verified by hand against a running server, not by reading the code:

- default `curl` user-agent → 403, `blocked`
- a real jailbreak payload → 400, `flagged`, `reason=PROMPT_INJECTION_DETECTION` in the log
- 35 requests in a loop → exactly 30 allowed, then 429, and the bucket visibly refilled part-way through
- a normal prompt → streams through untouched
- all of it confirmed a second time in the Arcjet console via `arcjet requests list`

**Still open, deliberately.** The bucket keys on IP, because Clerk is not wired into this route yet and there is no trusted user id to key on. Everyone behind one NAT shares a budget. When auth lands this moves to `characteristics: ["userId"]` with the real Clerk id — that is the finished state, IP is the placeholder.

#### Two model-call bugs this work surfaced

Both were pre-existing and are fixed:

- **Retry-wrapped errors read as "unknown".** The AI SDK retries and hands back a `RetryError` wrapping the real one, so an upstream 429 was surfacing to the user as "Something went wrong reaching that model." `toFailure` now unwraps it, and that same case correctly reads "That model is busy at the moment."
- **404 had no mapping.** OpenRouter answers 404 both for a slug that never existed and for one that has stopped being free. Now mapped to `unavailable`.

Also: `meta-llama/llama-3.3-70b-instruct:free` stopped being free and 404s. The dev harness default is now `google/gemma-4-31b-it:free`, pulled from the live list. Free-tier slugs clearly rot, which is an argument for the model picker reading the live catalogue rather than hardcoding anything.

Every prompt sent, every answer finishing, and every vote cast should be tracked as a real PostHog event, so there's an honest funnel from prompt to answer to vote. A model failing should also be logged properly on the server, not just shown to the user and forgotten. Separately from that funnel, every actual model call should also be wrapped so PostHog captures its own real tokens, cost, and latency per call, that's PostHog's own LLM analytics, not the same thing as the funnel events or the numbers already shown on the response card.

- [x] Arcjet in front of the endpoint: shield, bot detection, prompt injection, per-caller token bucket — built and verified
- [x] Switch the bucket from IP to the Clerk user id — done, see the Clerk section above
- [ ] Decide the approach for the rest of this feature
- [ ] Build it

## Slice 2: App shell & thread history

### 7. App shell & thread history

The frame everything else sits inside: a top bar and sidebar that stay in place while the page scrolls, the thread's name, and each model's win record shown right there (shrinking down to a small dot and number if it gets crowded). The sidebar lists a signed-in user's own past threads so the tool actually feels usable across visits, not just in one sitting.

- [ ] Decide the approach
- [ ] Build it

## Slice 3: Public visibility & sharing

### 8. Public thread visibility & sharing

Anyone should be able to open a thread's link and see it, without an account, that's what actually makes it shareable. Only sending a prompt and voting need sign-in. A made-up or deleted thread just shows a plain not-found page either way. The thread's real owner sees everything everyone else sees, plus the ability to actually use it.

- [ ] Decide the approach
- [ ] Build it

## Slice 4: Leaderboard

### 9. Leaderboard: global & personal

Two leaderboards from the same votes, one for everyone, one just for the signed-in user. Each row's win rate is the big, bold number, in the accent color, with a small bar next to it, always written as "won 4 of 5," never a bare percentage or a made-up score. Smaller, quieter numbers underneath for average speed and time-to-first-token, each clearly labeled. No cost or "cheapest" stat, every model is free, so that number never means anything here. First place gets a subtle highlight, nobody else does.

- [ ] Decide the approach
- [ ] Build it

## Not doing right now

Kept here so the plan stays honest about what's deliberately left out.

- A "fastest" label on the leaderboard, tagging whichever model already has the best average speed, only for models with enough votes to mean anything. Nice to have, not required.
- Giving each model's own little icon a distinct look instead of plain gray. Nice to have, not required.
- Privacy policy and terms pages.
- Rich link previews when a thread gets shared somewhere.
- Any kind of admin or moderation page.
- A public API for the leaderboard data. Nobody's asked for this.
