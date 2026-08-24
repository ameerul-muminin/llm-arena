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
| 2   | Coding standards & tooling                  | Foundation | done        |
| 3   | Data model                                  | Foundation | done        |
| 4   | Design & look                               | Foundation | done        |
| 5   | Model picker                                | Slice 1    | done        |
| 6   | Send a prompt, parallel streams, and voting | Slice 1    | done        |
| 7   | App shell & thread history                  | Slice 2    | done        |
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

Feature 3 originally owned Clerk, alongside the data model. Moved because the IP-keyed rate limit was a live weakness rather than a future one — an office or cafe behind one NAT shared a single 30-token allowance — and because every table feature 3 will add (threads, votes) needs a real user id to hang off. Building auth first means the schema is designed against something that exists instead of a placeholder to be migrated later. (Written before feature 3 was built, and one word of it turned out wrong: those ids are indexed Clerk strings, not foreign keys, because there is no `User` table to point at. The reasoning is under feature 3.) It was also cheap now and expensive later: today it touched a handful of files; after threads and votes exist it would have touched the schema too.

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

**The AI SDK is used for the provider call, not for the transport to the browser.** `streamText().stream` gives us deltas, finish reason, and token usage without owning SSE parsing, which is exactly what it was picked for. (This said `fullStream` until feature 2's linter flagged it as deprecated; `stream` is the SDK's own replacement and the rename is verified live — see feature 2.) Its React streaming hooks are deliberately not used, because they carry the SDK's own UI message shape and this app's contract is a per-model metrics object the card, the leaderboard, and PostHog all have to agree on. So the wire is our own: newline-delimited JSON, one typed `ModelCallEvent` per line, decoded through validators that drop anything unrecognised rather than trusting it. Readable with plain `curl`, and it keeps the metrics contract ours end to end.

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

#### Decided

The conventions are not being invented here. Feature 1 already established them in working code, consistently: kebab-case filenames, named exports only, arrow-function `const`s, `type` never `interface`, `readonly` on every property, doc comments that explain _why_ rather than restate the signature, and a strict split between pure cores and the one file per feature allowed to touch HTTP. This feature's job is to write that down and make a machine hold the line, not to redesign it.

**Prettier owns formatting; ESLint owns correctness. No overlap.** Two tools arguing about the same line is a permanent low-grade tax. Prettier gets configured to match what the code already looks like — 100-column width, double quotes, semicolons, two-space indent, trailing commas — so installing it reformats nothing and the first commit is not a whole-repo diff that buries real changes. `eslint-config-prettier` goes last in the chain to switch off every stylistic ESLint rule. `prettier-plugin-tailwindcss` sorts class strings into canonical order, which matters ahead of feature 4: identical class lists have to look identical, or the "if the same handful of classes shows up in three places, that's a component" rule is unenforceable by eye.

**ESLint goes type-aware.** `eslint-config-next` alone checks almost nothing about types. Turning on typescript-eslint's `strict-type-checked` with `projectService` costs lint time (11s today, expect roughly double) and buys `no-floating-promises` and `no-misused-promises` — precisely the failure class that matters in an app whose whole shape is three concurrent aborted streams, and precisely the kind of bug that produces a silently dropped error rather than a crash.

**Six rules carry their weight; each one traces to a rule in `CLAUDE.md` or to a bug this repo already had.** Not a wall of plugins.

- `no-explicit-any` → error. `CLAUDE.md` says no `any`; that should be a failure, not a warning nobody reads.
- `no-non-null-assertion` → error. This is not hypothetical: the verification pass found `process.env.DATABASE_URL!` in `lib/prisma.ts`, a non-null assertion standing exactly where a fail-fast check belonged. A linter catches that class of thing every time; a code read caught it once, late.
- `process.env` restricted outside `env.ts` and the root bootstrap files (`instrumentation.ts`, `instrumentation-client.ts`, `prisma.config.ts`). This is the mechanical form of the fail-fast env rule — one module is the source of truth for what configuration exists. `NODE_ENV` and `NEXT_PUBLIC_*` reads stay legal everywhere, because Next inlines those at build time and they genuinely cannot go through a function call on the client.
- `consistent-type-definitions: "type"` → matches the codebase exactly as written today.
- `no-console`, allowing `warn` and `error`. Server-side failure logging is required by the rules and already uses `console.error`/`console.warn` behind `[model-call]` and `[arcjet]` prefixes. What this catches is a stray `console.log` left in after debugging.
- `no-unused-vars` with an `^_` escape hatch, error not warning.

**One known violation, and the rule is doing its job.** `lib/arcjet.ts` reads `process.env.ARCJET_KEY ?? ""` at module scope. That is not actually a silent failure — `ARCJET_KEY` is in the startup check, so the server cannot come up without it — but the `?? ""` exists for a real second reason: `next build` evaluates route modules, and reaching for a validated key there would make a build require a live secret, which feature 1 already rejected as wrong. So this one gets an inline disable with that reason written next to it. Forcing the reason to be written down is the entire point of the rule, and it beats both a silent allow-list and a refactor to lazy initialisation that nothing else needs.

**Hooks: fast commit, strict push.** Husky plus lint-staged. `pre-commit` runs Prettier and ESLint over staged files only, a couple of seconds, so committing stays frictionless and nobody starts reaching for `--no-verify`. `pre-push` runs the full gate — typecheck, lint, and a real `next build` — because a production build catches things a typecheck cannot. That is not a guess either: Clerk v7's removal of `<SignedIn>`/`<SignedOut>` typechecked clean and failed only at render, and the build is what caught it. Slow checks belong at the boundary where the cost is paid once, not on every commit.

**Scripts** get filled in properly: `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, and a `check` that runs the whole gate in one command, so the "actually run it" rule is one thing to type rather than three to remember.

**Half of this project's rules cannot be linted, and the doc says so out loud.** Folder-by-feature, side effects pushed to the edges, immutable data, no copy-pasted Tailwind, honest `null`s never zero-filled, a plain sentence instead of a provider error, and the accessibility baseline are all review-by-eye. Listing them as unenforceable next to the enforced set is more useful than implying a green lint means the standards were met. Cross-feature import boundaries are the one item here that could be mechanised later — pointless today with a single feature, worth revisiting at the second.

**Deliberately not installing.** No test runner or browser automation, already decided project-wide. No `eslint-plugin-functional`: it fights idiomatic React and Prisma hard enough that the disable comments would outnumber the catches. No commitlint or conventional-commit enforcement: single author, no changelog automation, pure ceremony. No `prefer-readonly-parameter-types`, which sounds aligned with the rules but flags essentially every React and library type it touches.

#### What the build turned out to be

Four places reality differed from the plan above. The standards themselves survived intact; what changed is that turning the linter on found real defects, which is the entire argument for doing this feature before there is more code to point it at.

**"Installing Prettier reformats nothing" was overstated.** Ten files changed. But the shape of that diff is the useful part: of feature 1's hand-written code, exactly two files moved — one manually-wrapped import in `wire.ts` that Prettier rejoined, and a missing trailing newline in `lib/prisma.ts`. Everything else was the `create-next-app` scaffold (`app/page.tsx`, `app/layout.tsx`, mostly Tailwind class reordering, and feature 4 replaces those pages anyway) plus markdown table realignment. `printWidth: 100` was confirmed against the code rather than guessed: 18 lines already sat in the 91–100 band and only 5 exceeded it.

**Line endings needed `.gitattributes`, which was not in the plan.** Git here runs `core.autocrlf=true`, rewriting files to CRLF on checkout, while Prettier writes and checks LF. Left alone, `pnpm format:check` would fail on every file in a fresh clone and the pre-commit hook would reformat files nobody had touched. `* text=auto eol=lf` pins it. This surfaced only because `git diff` printed twenty CRLF warnings — worth recording, because nothing about it is visible from reading the config.

**Type-aware linting found four real defects, not just style.** All fixed:

- `lib/prisma.ts` typed the global singleton as `{ prisma: PrismaClient }`, always present. It genuinely is absent on first load, so the `??` beside it was dead code as far as the compiler was concerned — and any future reader of that global would have been told a null check was unnecessary when it is not. Now optional.
- `features/model-call/protection.ts` interpolated `decision.reason.type`, which is optional on Arcjet's own type, straight into the security log. The line someone reads to find out why a request was refused could print the word "undefined" and look like a bug in the logging. Now `?? "unknown"`.
- `lib/posthog-server.ts` had a nested `if (!client)` assignment; now `??=`.
- `prisma.config.ts` used bracket access for `DATABASE_URL`.

**The AI SDK deprecated `fullStream`, and this is a correction to feature 1.** `no-deprecated` caught `result.fullStream` in `call-model.ts`. The SDK's replacement is `result.stream` — identical type, identical doc comment, a pure rename. Feature 1's write-up above names `fullStream` and is now wrong; `stream` is the property in use.

That rename was verified live rather than by typecheck, since types cannot prove a stream still delivers. A throwaway `.mts` script ran `streamText(...).stream` against OpenRouter directly (Node 24 runs TypeScript natively, so this needed no test runner and no browser): 4 real incremental deltas, 47 characters, and a `finish` event carrying the full usage breakdown — 184 output tokens of which only 18 were text and 166 reasoning. That last detail independently corroborates feature 1's decision to split text from reasoning tokens. Script deleted after running.

The first attempt hit a 429 on `google/gemma-4-31b-it:free`, the dev harness default, with OpenRouter naming an upstream shared-pool limit at Google AI Studio. Not our bug, but more evidence that free-tier slugs rot and that feature 5 must read the live catalogue.

**Two `require-await` disables, both structural.** The one-event refusal generator in `stream-response.ts` is `async` because that is the shape its consumer takes, so a refusal travels the identical path as a real stream; `rewrites` in `next.config.ts` is `async` because Next's own type declares it returning a promise. Each carries its reason inline.

**Both hooks were verified by actually firing them.** A file with an `any`, a `console.log`, and a stray `process.env` read was staged and committed: the hook blocked it, all three project rules reported, `HEAD` did not move, and lint-staged reverted its own formatting. Then the hook was run against clean staged files and passed. `pnpm check` — typecheck, lint, format, and a real build — is green.

Lint went from 11s to 17s with type awareness on. Worth it.

- [x] Decide the approach
- [x] Prettier + `eslint-config-prettier` + Tailwind class-order plugin, configured to match existing code
- [x] Type-aware ESLint with the six project rules, and the documented disable in `lib/arcjet.ts`
- [x] `.gitattributes` pinning LF, which the plan missed
- [x] Husky: `pre-commit` staged format/lint, `pre-push` full gate
- [x] `package.json` scripts, `.editorconfig`, `engines`
- [x] Fix the four defects the linter found, and the deprecated `fullStream`
- [x] `docs/coding-standards.md`, splitting enforced from review-by-eye
- [x] Verify: lint, typecheck, format, and build all clean, and both hooks actually fire and actually block

Feature 2 is done.

### 3. Data model

The core things every feature depends on: users tied to Clerk, threads, each model's own messages inside a thread, and votes. A vote should only ever be possible on a turn where two or more models actually answered.

Clerk already landed, pulled forward out of this feature — see the Clerk section above. What is left here is the schema, the first migration, and a typed data-access layer.

#### Decided

**Four tables: `Thread`, `Turn`, `ModelResponse`, `Vote`. No `User` table.** Clerk stays the single source of truth for identity; `Thread.ownerId` and `Vote.voterId` are plain indexed Clerk id strings. A mirrored user table would be a second copy of identity that can drift, plus either an upsert on every write path or a webhook route to secure, and no feature currently needs anything Clerk does not already hand us at render time. The cost is real and accepted: those two columns get no foreign-key integrity, and the personal leaderboard is a `WHERE ownerId = ...` rather than a join. Revisit only if we ever need to store something about a person that Clerk does not hold.

**A `Turn` is the unit of the arena, not a message.** One `Turn` holds one user prompt; the models' answers hang off it as `ModelResponse` rows, one per model. This falls straight out of feature 6: a prompt goes to every selected model at once, and the vote is a judgement about that one prompt. Model X's own separate conversation — which feature 6 needs to send a follow-up — is reconstructed by walking the thread's turns in order and taking X's response from each, so the "each model keeps its own thread" behaviour is a read, not a second copy of the history. A flat `Message` table with a role column and a nullable `modelId` would model the same data while making both the grouping and the vote target awkward to express.

**Metrics are real columns on `ModelResponse`, mirroring `ModelMetrics` field for field.** Not a JSON blob: feature 9 averages speed and time-to-first-token across every response for a model, and that has to be a plain SQL aggregate over indexed numeric columns. They are all nullable, because a failed call honestly has none of them and `ModelMetrics`' own rule is that nothing is ever zero-filled to look complete. A single mapper turns an answered row back into a `ModelMetrics`, so the card, the leaderboard, and PostHog keep agreeing by construction.

**No cost column.** Every model here is free tier, so a cost column would be a table of zeros restating a constant. The `$0.0000` the rules require on screen is a fact about the tier, not a per-call measurement, and storing it as one would imply it was measured.

**Failures store the kind, never the sentence.** `ModelResponse.failureKind` is a Prisma enum mirroring `ModelCallFailureKind`; the human sentence stays derived by `failures.ts` at render time. Persisting the wording would freeze it, so improving a message later would leave old threads reading the old way. A compile-time assertion pins the enum to the TypeScript union, so adding a failure kind to one and not the other is a typecheck error rather than a runtime surprise.

**The winning answer cannot point outside its own turn.** `Vote` carries `turnId` and `winningResponseId` together, against a composite unique `(id, turnId)` on `ModelResponse` — Postgres itself then refuses a vote for an answer that belongs to a different turn. `turnId` is unique on `Vote`, so a turn has at most one vote, which matches feature 8's reading that the thread's owner is the only one who can vote on it.

**"Two or more models answered" is enforced in the write path, not by the schema.** Postgres cannot express "this row may exist only if a sibling table has at least two rows in a given state" without a trigger or a denormalised counter, and both are more machinery than the rule is worth. The single transaction that writes a vote counts the turn's answered responses first and refuses below two. Written down here so the gap is a known one rather than an assumed guarantee.

**Rows are written server-side when a stream closes, never by the browser.** The metrics are the whole point of the leaderboard, so a client-supplied number is a forgeable number — the same reasoning that removed the `x-posthog-distinct-id` header. The thread and turn are created in one write _before_ the three model calls are dispatched, and each per-model request carries the `turnId`; each route then writes its own `ModelResponse` on close. Creating the turn up front is what avoids three parallel requests racing to create the same one.

**Known gap, stated rather than papered over:** if a browser disconnects mid-stream the route is cancelled and that model's row may never be written, so re-opening the thread shows the turn with that model simply absent. Preferred over writing a fabricated "incomplete" row.

**Win rate's denominator is turns that were actually judged.** `won N of M`, where M counts turns in which this model answered _and_ a vote was cast. Counting unvoted turns would drag every model's rate toward zero and make the honest phrasing feature 9 insists on into a lie.

**Ids are `cuid(2)` everywhere.** Thread ids go in shareable URLs, so they want to be short and opaque rather than 36 characters and sequential. `uuid(7)`'s time-ordered index locality is a real advantage at a scale this app will not reach.

Deletes cascade `Thread → Turn → ModelResponse → Vote`. Indexes: `Thread(ownerId, createdAt)` for feature 7's sidebar, unique `Turn(threadId, index)` for ordering, unique `ModelResponse(turnId, modelId)` so one model answers a turn once, `ModelResponse(modelId)` for feature 9's aggregates, and `Vote(voterId)` for the personal leaderboard.

The data-access layer lives in `features/thread/`, folder by feature: pure row↔domain mappers, reads, and the transactional writes, with `lib/prisma.ts` the only thing that touches the client. Nothing outside that folder writes SQL.

#### What the build turned out to be

The design above survived intact. Five places the tooling had opinions, and one decision the plan did not anticipate having to make.

**The first real cross-feature import, and the rule needed sharpening.** `features/thread/` needs `ModelMetrics`, `ModelCallFailure`, and `ChatMessage`, all owned by `features/model-call/types.ts`. `coding-standards.md` said cross-feature imports "should not happen", written when there was only one feature to import from. Copying those types would have created a second place for them to drift, which is precisely what the derived-numbers-in-one-place rule exists to stop — and `types.ts` already describes itself as "the contract between a model call and everything downstream of it". So the rule is now directional rather than absolute: a feature may import another's stated contract, one way, and `model-call` still knows nothing about threads. Written up in `coding-standards.md` rather than left as an unexplained exception.

**Prisma enum members cannot contain a hyphen**, so the generated TypeScript names are `RATE_LIMITED` where the union says `"rate-limited"`. `@map` keeps the _stored_ value identical to the union's string — the column reads `rate-limited`, so the database is legible on its own — and `features/thread/failure-kind.ts` reconciles the two type names through a `Record` keyed by each side in turn. That is the compile-time assertion the plan promised: `TO_DB` must name every member of the union, `FROM_DB` every member of the enum, so adding one and forgetting the other fails the typecheck.

**Prisma refused the composite reference until it also had `@@unique([winningResponseId, turnId])`.** Strictly redundant — `turnId` is already unique on `Vote`, which is a stronger constraint — but it is what Prisma requires before it will type the relation as one-to-one. Kept, with the redundancy noted in the schema, since the index it creates is also the one feature 9 wants for "did this response win?".

**Prisma 7's client generator suffixes row types**: `ThreadModel`, `TurnModel`, `ModelResponseModel`. The unsuffixed names belong to query-argument types.

**An honest guard read as dead code.** `createThread` checks that the nested create actually produced its first turn; Prisma types the returned array as always-populated, so `turns[0]` made the check `no-unnecessary-condition` bait. `.at(0)` returns `T | undefined` and restores it. Worth keeping — a fabricated turn id would hide a real disagreement between Prisma and the database.

**Verification ran through a throwaway route, not a script.** A standalone `.mts` file cannot resolve the `@/` alias or the `server-only` import, so `app/dev-thread/route.ts` did the round trip inside Next and `curl` read the JSON back. Deleted after running, same as feature 2's throwaway script. Every step below is from that run, against the real Postgres:

- All four refusals fire with their plain sentences: voting with one answer (`too-few-answers`), voting for a failed response, voting as a non-owner, voting twice.
- The real vote succeeds, and `findThread` reads back the turn with its winner marked.
- **A cross-turn vote inserted by raw SQL, going around the data layer entirely, is refused by Postgres: `23503 violates foreign key constraint "Vote_winningResponseId_turnId_fkey"`.** That is the guarantee the composite key was for, proven with the application code bypassed.
- `conversationFor` gives alpha its four-message history and beta only the two prompts it never answered — no invented replies.
- Deleting the thread cascades: turns, responses, and votes all zero.

One consequence of the design worth stating plainly, since it showed up in that run: a model that answered turn 1 and failed turn 2 sends two user messages in a row on its next call. That is legal in the chat format and it is the honest representation of "asked twice, answered once".

- [x] Decide the approach
- [x] Four models, two enums, and the enum-to-union compile-time assertion in `prisma/schema.prisma`
- [x] First migration, applied against the real Postgres
- [x] `features/thread/` — `types`, `failure-kind`, `mappers`, `conversation`, `refusals`, `queries`, `writes`
- [x] Verify: a real round trip — create, answer, fail, vote, follow up, read back, delete
- [x] Verify: a vote below two answers is refused, and a cross-turn winner is refused by Postgres itself
- [x] Typecheck, lint, format, and a real build all clean

Feature 3 is done. What it deliberately does not include: nothing calls any of this yet. Wiring the model-call route to create a turn before dispatch and record its own response on close is feature 6's job, and the leaderboard's aggregate queries are feature 9's.

### 4. Design & look

A coffee or dark brown background, warm, not neutral gray or true black. One accent color, rust, used only for things you interact with, buttons, links, focus states, the win-rate bar, never as decoration. Because the background and the accent are both warm tones from the same family, the accent has to stay clearly brighter and more saturated than the background, enough that a button never blends into the page behind it, that's a real risk with two warm colors this close and worth checking by eye, not just by the numbers. Blue, indigo, and purple are never the accent, under any circumstance. Green is reserved only for marking a winner, red only for errors, never reused for anything else. Contrast should genuinely hold up in both light and dark mode, not just look fine at a glance.

#### The plugin did not fire on its own

`CLAUDE.md` requires Anthropic's `frontend-design` plugin for any UI work and says to invoke it directly if it doesn't fire. It didn't, because it is not installed — it exists in the official marketplace at `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/` but is not an active skill in this project. Its `SKILL.md` was read and applied directly for this decision. **Installing it properly is a real action item before features 5–9**, otherwise every future UI feature repeats this workaround.

Its own calibration note matters here: it warns that AI design clusters around three default looks, one of which is "near-black background with a single bright accent." It also says the brief's own words always win. This brief pins the palette, so warm brown and rust are not negotiable and are not the thing to argue with. The freedom left is typography, structure, and the signature — and that is where this deliberately does not spend itself on a default.

#### Direction: a bench instrument, not a chat app

The product's actual subject is honest measurement. Feature 1 already went to real trouble to refuse a number it could not defend — `tokensPerSecond` is `null` when an answer arrived in one flush, reasoning tokens are split out from written ones, nothing is zero-filled. The design's whole job is to look like the thing that behaves that way: a warm-lit measuring bench, three identical instruments running the same sample side by side. Not a leaderboard-as-marketing-page, and not a chat UI with stats bolted on.

That thesis decides the small stuff by itself. No gradients, no glow, no soft shadow stack, no decorative iconography. Surfaces separate by a one-pixel warm line and a small step in ground tone, the way panels on an instrument do. Radii stay small and consistent — `--radius` is `0.5rem`, which lands controls at 8px and cards at 11px through shadcn's own scale — because a bench is machined, not pillowy. (This first said 6px and 10px, picked before the scale existed. The built numbers are the real ones.)

#### Type: two faces, and one rule about which

Geist and Geist Mono are `create-next-app`'s defaults and are being replaced. Two faces, both from Google Fonts, both loaded through `next/font/google`:

- **Instrument Sans** — everything written for a person to read. Body, headings, buttons, prose. Slightly narrow and sharp, so it holds up in a 1/3-width column without feeling cramped, and it isn't Inter.
- **IBM Plex Mono** — measured facts and identifiers only, always with tabular figures.

**The rule is the interesting part: monospace means "this is a number we measured, or a name a provider gave us."** Every metric, every token count, every model id, every `won 4 of 5`, every `$0.0000`, every em dash standing in for a number we refuse to invent. Prose is never mono; a measurement is never not. That is a structural device that encodes something true about the content rather than decorating it, which is exactly the test the plugin sets — and it means a reader learns, without being told, that the mono text is the part that came from the wire.

Heading scale is small and tight, four steps only: 28 / 20 / 15 / 13. This app has no hero and does not need one.

#### Color: named tokens, both modes, no raw hex anywhere else

All of it lives in `globals.css` as CSS custom properties surfaced through Tailwind 4's `@theme`, per the rule that shared values never get copy-pasted as Tailwind classes. Dark is the primary mode and what the sketches show; light is a real design, not a inverted afterthought.

Dark: ground `#17110E`, surface `#1E1714`, raised `#261D19`, line `#332721`, text `#F2E9E1`, muted `#B3A296`, accent `#E2673B`, accent-hover `#F07E52`, accent-ink `#1A120E`, win `#7FC08C`, fail `#E8806F`.

Light: ground `#FAF4ED`, surface `#FFFCF7`, line `#E3D6C8`, text `#241A15`, muted `#6B594C`, accent `#A8401F`, accent-hover `#8E3517`, accent-ink `#FFF6EF`, win `#2F7D4F`, fail `#B03A28`.

**The brief's warning about two warm tones was right, and the first rust failed it.** `#C8532A` was the intuitive pick and it computes to 4.17:1 against the dark ground — under the 4.5 floor as link text, and only 3.71:1 with parchment text sitting on it as a button fill. Both directions fail. `#E2673B` reaches 5.50:1 against the ground, and a button is that rust as the fill with near-black-brown `#1A120E` as its label, which is the same 5.50:1 read the other way. Muted text lands at 7.52:1 dark and 6.09:1 light. These are computed, not eyeballed, and they still get checked in a browser in both modes before this feature is called done — the brief asks for both and it is right to.

Rust appears on: buttons, links, focus rings, the pick-this-answer control, the active nav item, and the win-rate bar. Nothing else, ever. Green appears on exactly one thing, the winner badge and its card's marked edge. Red appears on exactly one thing, a failed call's message and retry affordance.

#### Signature: one shared time axis across the three answers

The single element this app gets remembered by. Under each answer card sits a hairline track, and **all three tracks in a turn share one time scale**, so the cards are literally a race chart drawn in place. On each track: a tick at that model's first token, and a filled band spanning first delta to last. Watching it fill is watching the thing the product claims to measure.

It is honest by construction, which is why it earns its place over a prettier chart:

- A model that buffers has no generation window, so it gets a single solid mark at the moment it flushed, not a band. The visual says exactly what `streamed: false` says.
- A model that fails gets a track that stops where it stopped. No band, no invented endpoint.
- The scale is the turn's own slowest finisher, so it is a real comparison within that turn and never a comparison against a made-up ceiling.

**The track is drawn in muted foreground, not rust.** Rust is reserved for what you interact with plus the win-rate bar the brief explicitly names, and letting a measurement bar borrow it would spread the accent until it stops meaning anything. One bold thing, kept quiet everywhere around it.

It needs no new data: TTFT, first-delta and last-delta wall clock, and `streamed` all already exist on `ModelMetrics` from feature 1.

#### Layout, from the sketches

The sketches are structure and are followed as such: persistent left sidebar (brand, Arena / Leaderboard / Models, a rule, then the thread list and New Thread, with user avatar and theme toggle pinned at the bottom), a top bar with the sidebar toggle, breadcrumb, and the per-model win chips on the right, then the answer grid, then the composer pinned at the bottom with model chips and Add model inside it.

The answer grid is `1fr` per selected model, one to three columns, collapsing to stacked full-width cards under 900px with the shared time axis still shared — that is the one thing that must survive the reflow, or the signature stops meaning anything on a phone.

Nothing in the sketches contradicts anything written above, so there is nothing to stop and ask about.

#### Mechanics

- **shadcn is not installed yet** and this feature installs it, Tailwind 4 / CSS-variables mode, wired to the tokens above rather than to its default neutral ramp. Components actually needed now: button, card, popover, skeleton, tooltip, separator, scroll-area, avatar, dropdown-menu. Nothing installed speculatively.
- **`next-themes` with `attribute="class"`.** The current `globals.css` switches on `prefers-color-scheme`, which cannot support the theme toggle the sketch puts in the sidebar. System preference on a first visit, explicit choice remembered after.
- **Accessibility baseline, per the rules:** a visible rust focus ring on every interactive element with a ground-colored offset so it reads on both surfaces, focus never removed only restyled, the whole arena operable by keyboard including picking a winner, `prefers-reduced-motion` collapsing the time axis to its final state instead of animating, and the winner never signalled by green alone — it carries a badge with a word in it.
- **Streaming has three real states and each is designed, not defaulted:** waiting (a skeleton in the card body, metrics row showing em dashes), streaming (text appearing, track filling, metrics still dashes until they exist), done (metrics resolve, pick control enables once two models have answered). A failure replaces the body with the plain sentence from `failures.ts` and a Retry button, and the card stays in the grid rather than disappearing.
- **Copy is written from the reader's side.** The pick control reads "Pick this answer" and produces a badge that reads "Winner". Speed is labelled "time to first token" and "tokens/sec", never abbreviated to something only we understand. A model that flushed reads "arrived in one chunk" rather than a blank. Empty arena reads as an invitation to send something, not as an apology.
- ~~`app/dev-stream/` is deleted as part of this feature.~~ Wrong, and corrected below — it moves to feature 6.

#### Deliberately not doing

No animation library. No dark/light "auto" gimmicks beyond the toggle. No per-model brand colors or logos — feature 4's "not doing right now" list already parks distinct model icons, and coloring them would fight the one-accent rule. No charting library; the time axis is a handful of divs over already-computed numbers.

#### What the build turned out to be

The direction survived intact — every decision above is what shipped. Six places reality had something to say, and one of them was a real accessibility defect that the plan would not have caught.

**The palette failed its own contrast check a second time, on a pair nobody had thought to look at.** The rust was checked by hand while choosing it, and that caught the first failure. Running the full set found another: `--line-strong`, the token behind every control boundary, measured **1.72:1 in light and 1.73:1 in dark**. shadcn's outline button draws its edge from `--border` in light mode, which is this app's decorative hairline at **1.31:1** — an outline button whose boundary is effectively invisible. WCAG asks 3:1 of a control's boundary, and both numbers are less than half of that.

The fix separates two things that had been one idea:

- **`--line` is decorative** and stays quiet. It is the hairline between surfaces — card edges, table rules, dividers. A card is already delineated by its own background, so this line is not carrying the boundary on its own, and no threshold applies to it.
- **`--line-strong` is a control's boundary** and now clears 3:1 against ground, surface, and raised alike, in both modes. `#8f7660` light, `#8a7365` dark.

`components/ui/button.tsx`'s outline variant was changed from `border-border` to `border-input` so it draws from the strong token in both modes rather than only in dark. That is a one-word edit to vendored code with the reason written inline next to it.

The contrast table on the reference page reports a decorative pair as measured-but-unthresholded rather than quietly dropping it. Showing 1.31:1 next to the word "Decorative" is honest; deleting the row to make the summary read green would not be.

**Every threshold now passes in both modes**, verified twice over: once by a throwaway Node script reading the tokens straight out of `globals.css` (deleted after running, same as features 2 and 3), and once by the page itself reading what the browser actually resolved.

**React 19's `set-state-in-effect` rule killed the theme toggle's `mounted` guard, and the replacement is better.** The standard next-themes pattern keeps a `mounted` flag and flips it in an effect, purely to learn whether hydration has happened — the linter correctly calls that a cascading render. Letting the `dark` class pick the icon in CSS removes the problem instead of silencing it: both icons and both accessible labels are rendered, the theme shows one, and the button is real markup on the first paint with no placeholder and no flash. The contrast table had the same shape and moved to `useSyncExternalStore` with a `MutationObserver` on the `<html>` class, which is the honest description of what it is doing — the theme class genuinely is an external system, written by next-themes' inline script before React exists.

**The `eyebrow` utility deliberately sets no color, and very nearly did.** The time axis prints its caption in `--fail` when a call stops short. A color baked into the utility would have sat in the same cascade layer as `text-fail` and won or lost by declaration order rather than by intent — a bug that would have shown up as "the failure caption is the wrong colour sometimes". The utility owns the shape; callers state the colour.

**shadcn's CLI has changed shape and the old flags are gone.** `--base-color` no longer exists; there is now a `--base` (radix / base / aria) and a named preset. Initialised with `--base radix --preset nova`. Two consequences worth knowing: the preset writes a neutral OKLCH ramp into `globals.css` that this feature replaced wholesale, and `shadcn` itself is now a runtime dependency rather than only a CLI, because `globals.css` imports `shadcn/tailwind.css` for its custom variants and keyframes. That file was read before being kept — it is variants and keyframes only, no visual opinions, so it does not fight the design.

**Mapping shadcn's slots onto our tokens meant an unmodified component already wears the design**, which is what made the component work small. One clash is documented at the top of `globals.css` because it will bite someone: **shadcn's `--accent` is not our accent.** In its vocabulary `--accent` is the faint tint behind a hovered menu row; our rust is its `--primary`. Reaching for `bg-accent` expecting rust produces a brown smudge.

**`app/dev-stream/` is not deleted, and the plan above was wrong to say it would be.** It said the harness goes "once a real screen exists to replace it". A design reference page is not that screen — the real arena is feature 6, and `/dev-stream` is currently the only live proof of the streaming path. Deleting it now would remove the only way to exercise streaming until feature 6 lands. The deletion moves to feature 6, where it belongs.

**`app/design/` is meant to outlive this feature.** With no test runner and no browser automation by decision, a single page showing every token, every state, and every measured contrast pair is what makes "verify it in a real browser" a workable instruction rather than a hunt across screens that do not exist yet. Any future token edit gets checked there first.

Files: `app/globals.css` (the whole visual language, and the only file allowed a hex value), `app/layout.tsx` (fonts and the theme provider), `app/page.tsx` (a holding page wearing the real design instead of Vercel's boilerplate), `features/design/` (`format.ts`, `time-axis.tsx`, `metrics-row.tsx`, `model-mark.tsx`, `win-rate.tsx`, `answer-card.tsx`, `theme.tsx`), `app/design/` (the reference page, its fixture-driven arena preview, and the contrast table), plus `components.json`, `lib/utils.ts`, and nine vendored `components/ui/` files.

`features/design/` imports `ModelMetrics` and `ModelCallFailure` from `features/model-call/types.ts`. That is the second use of the directional cross-feature contract rule feature 3 established, and it points the same way — `model-call` still knows nothing about anything downstream.

- [x] Decide the approach
- [x] `frontend-design` plugin installed and enabled — note that plugin skills register at session start, so it could not be invoked through the skill tool in the session that built this; its `SKILL.md` was applied directly from the same file the plugin ships
- [x] Tokens in `globals.css`: both modes, Tailwind 4 `@theme`, no raw hex outside this file
- [x] Fonts swapped to Instrument Sans + IBM Plex Mono, Geist removed — confirmed absent from the rendered HTML
- [x] shadcn installed and themed to the tokens
- [x] `next-themes`, class-based, with the toggle
- [x] Shared components: answer card, metrics row, time axis, win chip, win-rate bar
- [x] Found and fixed a real 3:1 control-boundary failure in both modes
- [x] Every thresholded contrast pair passes in both modes, measured twice by independent paths
- [x] Reduced motion honoured, and the time axis reads its final state rather than animating into it
- [x] Typecheck, lint, format, and a real build all clean
- [x] Both pages served 200 from a running dev server with a clean server log
- [ ] Tab through `/design` in a real browser and confirm the focus ring is visible on every control, in both themes — the one item that genuinely needs a person

Feature 4 is done bar that last check. What it deliberately does not include: no sidebar, no top bar, no composer. Those are the app shell, which is feature 7, and building them here would have meant designing screens before the features that own them had been thought about.

## Slice 1: Core arena loop

### 5. Model picker

An "Add model" popover pulling OpenRouter's live free-tier list, sorted by context window, capped at three models, defaulting to all three selected, with removable chips next to the prompt box. Also render that same catalog as a simple `/models` page, name, context window, and pricing for each one, so anyone can browse the full list without opening the picker.

#### Decided

**The catalogue is fetched on the server, never by the browser.** One `features/catalogue/` module owns `getFreeModels()`, cached through Next's own `fetch` revalidation at an hour. That gives one cache shared by every visitor rather than one request per person, keeps a third-party URL off the client, and means the picker and `/models` read the identical function, so they cannot disagree about what is free. Verified before deciding: the endpoint takes no API key, returns the whole list in one response, and has no pagination.

**The response is untrusted input and gets parsed like it.** A pure parser over `unknown` keeps only entries whose fields are the right shape and drops the rest, exactly the posture `wire.ts` takes on the provider's stream and `request.ts` takes on a request body. Someone else's server changing a field name should thin our list, never crash a page.

**"Free" means the price is zero, not that the slug ends in `:free`.** Checked against the live list and the two are genuinely different: 19 models cost nothing, only 15 carry the suffix. Pricing is the fact behind the `$0.0000` this app prints on every card, so pricing is what the filter reads. Two further exclusions, both for honesty rather than taste:

- **Text in, text out only.** The zero-price set includes Lyria, which emits audio. It would arrive in the arena as a card that never produces readable text.
- **`openrouter/free` is excluded, because it is a router, not a model.** It forwards to whichever free model it likes. A leaderboard row for it would claim a win rate for a name that is several models wearing one label, which is precisely the kind of number this project refuses to print.

**The default three are the top of the context sort, one per vendor.** Walk the sorted list and skip a vendor already taken. Fully deterministic and still exactly the sort the scope names — the tiebreak only decides between models that were otherwise adjacent. The reason it earns its keep is visible on today's list: a flat top-three returns two NVIDIA Nemotrons, and a bench where two of three instruments come from the same lab is a weaker comparison for no gain. A thread you remember as "Gemma against Qwen" is the thing the sidebar row design already bet on.

**No new API route, and no spinner inside the popover.** The arena page is a server component and hands the catalogue to the client composer as a prop. The list is a fact about the page, known before it renders, so making the browser ask for it separately would add a loading state, a fetch, and a route for nothing.

**A failed catalogue fetch degrades, it does not break.** The page still renders, the picker states in one plain sentence that the list could not be loaded and offers a retry, and the real reason goes to the server log only — the same rule every other failure in this app already follows. Nothing hardcoded gets substituted in: showing a stale trio while claiming it is the live list is worse than saying the list is unavailable.

**Provider names get parsed once, in one pure function.** OpenRouter returns `"NVIDIA: Nemotron 3 Ultra (free)"`; the app wants vendor `NVIDIA` and name `Nemotron 3 Ultra`. Splitting that at the call site would put string surgery in three components. A slug the catalogue does not know falls back to rendering the slug itself, never a blank — a thread saved before a model stopped being free still has to read as something.

**`/models` and the picker share the data, not the presentation.** The page keeps its card grid, the popover keeps its list; both read `getFreeModels()`. Feature 5's real work is swapping the source and deleting both fixture blocks, since the cap at three, the chips, and their removal were built as real rules in feature 7 rather than as placeholders.

**No search box.** Fifteen models fit in a popover. A filter input over a list that short is furniture.

**`/api/model-call` is not changed to validate the slug against the live catalogue.** It would put a network hop in front of every model call to re-check something the picker already constrained, and feature 6 already maps a dead slug to `unavailable` — OpenRouter answers 404 both for a slug that never existed and for one that stopped being free. The `vendor/model[:tag]` regex stays the gate.

**The rot this feature exists to fix is already measurable.** Of the three slugs hardcoded in the current fixtures, `qwen/qwen3-14b:free` and `meta-llama/llama-3.3-8b-instruct:free` are both gone from the live free list; only `google/gemma-4-31b-it:free` survives. That is on top of the two models feature 6 already watched stop being free. Any hand-written list in this app is wrong within weeks.

#### What the build turned out to be

Every decision above shipped as written. One of them was quietly broken by the
framework in a way no amount of reading the code would have shown, and finding it
is the reason this feature took a production server rather than a dev one.

**The retry button did not retry, and both pages had to stop being static.** With
the pages left to prerender, `next build` rendered them once, at build time, and
every request for the next hour was served that HTML. Measured on a production
server against a catalogue stand-in that answered 500: three requests to
`/models` produced **zero** outbound attempts. The failure had been baked in at
build time, and `router.refresh()` re-served the identical bytes. So a build that
happened while OpenRouter was unreachable would have shipped "the model list
didn't load" to everyone for an hour, under a button promising otherwise. A retry
that cannot retry is worse than no retry, because it looks like one.

Both routes now set `dynamic = "force-dynamic"`, with the reason written once in
`catalogue.ts` and pointed at from each page. **Crucially this costs nothing that
the plan actually wanted**, and that was measured rather than assumed, because the
cache being relied on is the fetch's and not the route's:

- Four renders across the two routes, catalogue answering normally → **one**
  upstream call. The hour-long cache is still shared by every visitor.
- Four renders, catalogue answering 500 → **four** upstream calls. A failed
  response is never stored, so `Try again` genuinely tries again.

**The Data Cache also survives a rebuild**, which briefly made a test lie: the
second run was still serving the first run's cached payload until
`.next/cache/fetch-cache` was cleared by hand. Worth knowing before trusting any
future measurement of this path.

**"Free means zero" is not a pedantic distinction, it is four extra models and
three exclusions.** Live numbers: 19 models priced at zero, only 15 carrying the
`:free` suffix. After the filters, **16 render** — the two Lyria music models drop
on output modality, `openrouter/free` drops as a router, and one zero-price model
with no suffix is correctly kept. Vendor spread on the day: NVIDIA 5, Google 2,
Poolside 2, Thinking Machines 2, and one each from Cohere, Dots Studio, LiquidAI,
Z.ai, and an anonymised preview model.

**One model has no vendor, and it reads lowercase.** OpenRouter names most models
`"NVIDIA: Nemotron 3 Ultra (free)"`, and the parser splits that. A cloaked preview
model is named just `"Ox Alpha"`, so there is no vendor to split off and the
fallback prints the slug's own vendor segment — `stealth`, in lowercase, next to
`NVIDIA` and `Google`. Left as it is, deliberately: title-casing it would invent a
proper name for a vendor that has not given one, and this project prints the name
it has. Worth knowing that it is also currently the **first** default pick, since
it happens to advertise the largest context window on the list.

**The default selection's vendor rule earns itself on the live data.** A flat
top-three returns two NVIDIA Nemotrons; one-per-vendor opens the arena with three
different labs. Confirmed in the rendered HTML, not in principle.

**The picker states the context window it sorts by.** A list ordered by an
invisible number looks arbitrary, so the number is on every row, right-aligned
under a `Context` column label, in mono like every other measured fact. That is
the whole visual addition this feature makes — feature 4's signature is the shared
time axis, and inventing a second signature here would dilute it.

**Deleting `.next` breaks the typecheck, and `pnpm check` cannot fix itself.**
Feature 7 already recorded that a stale `.next` fails `tsc` on a route that no
longer exists — that recurred here when the throwaway route was deleted. The new
half is worse: clearing `.next` to fix it makes `tsc` fail on `LayoutProps`, which
Next generates into `.next/types`. Since `pnpm check` runs the typecheck before
the build, a clean checkout needs one `pnpm build` before the gate can pass at
all. Written up in `coding-standards.md`.

**The failure path was verified by hand, not reasoned about.** A throwaway route
stood in for OpenRouter — the same pattern feature 3 used, deleted after the run.
Both screens print the plain sentence and a `Try again`, no card grid, no chips,
no `Add model` control, and the real reason (`OpenRouter answered 500.`) appears
in the server log only. No status code and no provider text reaches the HTML.

Files: `features/catalogue/` (`types.ts`, `parse.ts`, `catalogue.ts`,
`selection.ts`, `copy.ts`, `retry.tsx`), with `features/arena/composer.tsx`,
`app/(app)/page.tsx`, and `app/(app)/models/page.tsx` rewired to it. The
hand-written catalogue on `/models` is gone along with its `PlaceholderNote`, and
the composer no longer reads `features/arena/fixtures.ts` — that module now serves
only the fixture turn, which is feature 6's to delete.

`features/catalogue/` imports nothing from another feature except `formatTokens`
and `ModelMark` from `features/design/`, which is the same one-way contract rule
features 3 and 4 established, pointing the same way.

- [x] Decide the approach
- [x] `features/catalogue/`: typed catalogue entry, pure parser, pure name/vendor formatter
- [x] `getFreeModels()` — server-only fetch, hour-long revalidate, zero-price + text-only + no-router filter, sorted by context window
- [x] Default selection: top three by context, one per vendor
- [x] Composer reads the live catalogue through a prop; the fixture model list retired
- [x] `/models` renders the live catalogue; its fixture block and `PlaceholderNote` deleted
- [x] Unavailable-catalogue state: plain sentence, retry, real reason logged server-side only
- [x] Found and fixed a retry button that could not retry, because both pages were being prerendered
- [x] Verified live: 16 models, the count line agreeing, three distinct vendors chosen by default
- [x] Verified by hand with the catalogue forced to fail, on a production server
- [x] Typecheck, lint, format, and a real build all clean
- [ ] Open the picker in a real browser and tab through it in both themes: the popover scrolls, every row takes focus with a visible ring, escape closes it and returns focus to `Add model` — needs a person

Feature 5 is done bar that last check. What it deliberately does not include:
sending the prompt. The chips are now the real, live models a turn will be sent
to, but the send control is still disabled and still says so — that is feature 6.

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

#### Decided: the rest of the feature

**A turn exists before any model is called, and the browser is only ever told its id.** Feature 3 already settled that the thread and turn are one write up front, so three parallel requests cannot race to create the same turn. That write becomes a server action, `startTurn`, doing one of two things: `createThread` on the arena's empty screen, `appendTurn` on a thread that already exists. It returns `{ threadId, turnId }` and nothing else.

**The model-call route takes `{ turnId, modelId }` and works out the messages itself.** The browser stops sending conversation history entirely. `conversationFor(thread, modelId)` is already built, already verified, and already the definition of "this model's own separate conversation" — having the client send a history the server could just read is a second copy of the truth that can disagree with the stored one, and it lets a caller put words in a model's mouth by claiming it said something it never did. It costs one thread read per model call, three reads against a prompt that takes seconds. `request.ts` narrows to a `turnId` and a `modelId`, and the route refuses a turn whose thread belongs to someone else via `findTurnOwner`, before spending anything.

**Prompt-injection detection moves to `startTurn`; every other Arcjet rule stays on the per-model route.** One prompt currently gets screened three times, because three model calls carry it. That is three times a metered add-on's token cost for one question, and three independent chances to reach different conclusions about the same text — the accuracy problem already written up above, made three times more visible for no gain. Screening once, where the prompt is actually submitted, also means a flagged prompt never creates a turn at all rather than creating one and then refusing it three times. The token bucket stays per model call, because that is where the real cost is and because a bucket spent at turn creation would leave a known `turnId` re-postable for free. Shield and bot detection stay on both, since both are endpoints.

**A refusal that never reached a model writes no row.** A `ModelResponse` records what happened to a model call; if there was no call, there is nothing to record about the model. The consequence is stated rather than hidden: if the bucket is empty, the turn is created, all three calls are refused, and re-opening that thread later shows a prompt with no answers under it. That is the same family as feature 3's known gap for a browser disconnecting mid-stream, and it is preferable to writing rows that blame three models for a limit the person hit.

~~**Streaming happens in place, and the URL catches up afterwards with `history.replaceState`.**~~ Wrong, and replaced during the build — see "What the build turned out to be" below. The empty arena creates the thread and then navigates; the answers stream on the far side of that navigation.

**Voting is by `(turnId, modelId)`, never by a response id.** The client never learns a `ModelResponse` id, because putting one on the wire would mean adding a thread-shaped event to `ModelCallEvent`, and `model-call` is not allowed to know threads exist — that one-way rule is the whole reason features 3, 4, and 5 could import its contract safely. The vote action takes the turn and the model, resolves the row through the unique `(turnId, modelId)` index, and hands `castVote` the id. Every refusal `refusals.ts` already writes a sentence for is surfaced as that sentence.

**The model line-up locks once the first prompt is sent.** After that the chips are a readout of who is in this thread, not a control; changing the cast means a new thread. A thread is one sample run on a fixed set of instruments, which is what makes the top bar's win records describe a stable group and what keeps a follow-up a genuine like-for-like comparison. It also avoids the lopsided history a late joiner would get — `conversationFor` correctly hands it every earlier prompt with no answers attached, which is honest, but it is not a comparison anyone asked for.

**Retry is per card and replaces, it does not append.** `recordAnswer` and `recordFailure` already upsert on `(turn, model)` precisely so a second attempt overwrites the first. The card's `onRetry` re-dispatches that one model against the same turn; the other two are untouched, which is the entire point of one request per model.

**Titles are not generated.** `Thread.title` stays null and every surface falls back to the first prompt, truncated. Asking a model to name a thread would spend a call, add a failure mode, and put an invented sentence where a real one already exists.

**The sidebar and the top bar stop being fixtures, and one query has to grow.** `features/shell/fixtures.ts` is deleted whole. The sidebar reads `listThreadsForOwner`, which currently returns only `ThreadSummary` — feature 7's row design also needs the models that were in a thread and its turn count, so the query gains both. The top bar's title and standings are server facts about a nested route the shell layout cannot see, so they arrive through a parallel-route slot: `app/(app)/@thread/thread/[id]/page.tsx` renders them and `@thread/default.tsx` renders nothing for every other route. A client store seeded from an effect was rejected — it flashes empty on first paint, and it is the same set-state-in-effect shape this project has already had to unpick three times. A cast vote calls `router.refresh()`, which is cheap because it happens at most once per turn.

**One hook owns a live turn.** `features/arena/` gets the state: a map of `modelId` to `AnswerState`, a per-model `AbortController`, the dispatch-time clock each `AxisSpan` needs, and a `requestAnimationFrame` tick that runs only while at least one model is still going, so elapsed time advances on the axis between deltas. `axisScaleFor` over the live spans gives the shared scale, so the signature works while the race is happening rather than only after it. Reduced motion skips the tick and renders on events alone. `AnswerCard`, `TimeAxis`, and `MetricsRow` are unchanged — they already take exactly this shape, which is what feature 4 built them against.

**Signed-out visitors see the composer and are asked to sign in by it.** The route already refuses with `sign-in-required` and that stays as the real enforcement, but a send control that fails after the fact is worse than one that says what it needs up front.

**PostHog: the funnel is captured server-side, and `$ai_generation` is emitted from the numbers already measured.** Prompt sent, answer finished, model failed, and vote cast all happen in server code that already holds the Clerk id, so capturing there keeps the funnel out of reach of an ad blocker and keeps one identity across devices. LLM analytics gets `$ai_generation` events built from `ModelMetrics` rather than from `@posthog/ai`'s wrapper: this app measures time-to-first-token, generation speed, and the reasoning/text token split itself, deliberately, with rules about when it refuses to report one at all — and a wrapper reporting its own version of those numbers would be a second source for a figure that already has one. Cost is sent as `0`, which is true, and is the same number the cards print.

**Deliberately not in this feature.** No stop button mid-stream, no regenerate-all, no editing a sent prompt, and no resuming a stream after a reload — a reload shows whatever rows were written and no more. Each is a real product decision that would need its own thinking, and none is required for a prompt to reach three models and get judged.

#### What the build turned out to be

Most of the plan shipped as written. Two decisions did not survive contact with
the rest of the app, and running it surfaced a real honesty bug in feature 1's
metrics that no amount of reading would have shown.

**The empty arena navigates before it streams, and the plan above was wrong.**
`history.replaceState` rewrites the address without telling the server anything,
which is exactly the problem: the top bar's standings, the sidebar's thread
list, and the page's own data are all server-rendered, so after a shallow URL
change every one of them would still be describing a thread that, as far as they
knew, did not exist. Worse, the model line-up would have had nowhere to live —
the new screen has to know who to ask, and a turn with no responses yet cannot
say. So the empty arena calls `startTurn`, navigates to
`/thread/<id>?live=<turnId>`, and the thread screen dispatches. The cost is one
server round trip before the first call, and it is paid where nothing measures
it: time-to-first-token starts at dispatch on the server, on the far side of the
navigation.

`?live=` is then stripped from the address with `replaceState` as soon as the
calls are away, and it is honoured only for the thread's owner and only while
that turn genuinely has no answers. Otherwise a pasted link would re-ask a
finished thread's last question, and every reload would spend three more calls.

**The line-up became a real column, `Thread.modelIds`.** It was going to be
inferred from whichever `ModelResponse` rows existed. That is fine for reading a
finished thread and useless at the only moment it matters — dispatch, when there
are no responses yet. It is also lossy: a turn where every call was refused
before it reached a model would leave a thread with no idea who was in it. Since
today's decision fixes the line-up at creation, it is a property of the thread,
and storing it is what makes the lock real rather than implied. The route
re-checks every request against it, which is where the lock is actually
enforced — the composer merely stops offering the control.

**One prompt was being screened for injection three times.** Moving
`detectPromptInjection` onto the submit action and leaving the token bucket on
the model call needed two Arcjet clients over one base — shield and bot
detection on both, one extra rule each. Worth stating plainly what this saves,
since prompt scanning is metered: a three-model prompt now pays for one scan
instead of three, and there is one verdict on a given piece of text rather than
three that can disagree.

**A model reported minus twenty-six written tokens.** Measured live, twice, from
two different vendors: `outputTokens` 361, of which `reasoningTokens` 387 — a
thinking figure larger than the whole output, which the SDK turns into a
`textTokens` of **-26**. The card would have printed `-26` under "Written". The
number that was actually wrong is unknowable from here, so neither half of the
split is kept: `metrics.ts` now checks that the split can be true at all and
nulls both when it cannot, which renders as the em dash every other missing
number already uses.

Generation speed goes with it, deliberately. The obvious move is to fall back to
dividing by `outputTokens`, and that is exactly the ninefold inflation feature 1
already fixed once — if the thinking figure is wrong, no estimate of how much of
the output was written survives it. Overall throughput still stands, because it
divides everything produced by the whole wait and never needed the split.
Confirmed on a model that reports a coherent split: 23 written tokens, 0
thinking, `18.4 tok/s` generation — the guard only bites on the broken case.

**OpenRouter answers 400, not 404, for a slug it does not recognise at all.**
Feature 6's earlier note recorded 404 for a model that stopped being free, which
is still right. A slug that was never valid returns `400 ... is not a valid model
ID`, which maps to `unknown` — "Something went wrong reaching that model."
Deliberately left there: a 400 can equally mean a request we got wrong, and
claiming "that model isn't available" for every one of them would be inventing a
diagnosis. Written down because the two codes look interchangeable and are not.

**The recording wrapper moved out of the route.** `route.ts` was carrying the
generator that writes the row and captures the analytics, which is not what
feature 1 says a route handler is for — its job is turning events into a
`Response`. It lives in `features/thread/record-call.ts` now, which also made it
callable from the verification harness, so what was exercised by hand is the
same function the route runs rather than a copy of it.

**`features/shell/fixtures.ts` is gone; the arena's fixture turn moved rather
than died.** The design reference page is the only thing that still wants a fake
turn, and it wants it for a reason that has not expired: a model that streams,
one that buffers and flushes, and one that fails partway, all on screen at once,
on demand, with a replay button. It moved to `app/design/` beside its only
caller. The thread and standings fixtures were deleted outright — those are real
now.

**Verified by hand, against a running server and the real Postgres**, through a
throwaway route deleted afterwards — the same pattern features 3 and 5 used:

- Three models dispatched at once against one turn: two answered (29 and 10
  chunks), one failed, and the failure was invisible to the other two.
- Metrics stored and read back: `ttft=1315ms`, generation `18.7 tok/s`, overall
  `10.2 tok/s`, written 30, thinking 0 — and em dashes where the broken split
  was refused.
- The vote round trip: `findResponseId` resolves `(turn, model)` to the right
  row, the vote lands, a second vote is refused with "You've already picked a
  winner for this prompt", and a stranger's vote with "This conversation belongs
  to someone else".
- Follow-up histories are each model's own: `user>assistant>user` for the two
  that answered, `user>user` for the one that failed — asked twice, answered
  once, with nothing invented in between.
- Retrying the failed model wrote **one** row, not two.
- Standings derived from real votes: `1/1` for the winner, `0/1` for the other
  answerer, `0/0` for the model that never answered.
- The sidebar row carries the first prompt as its title, three models, two turns.
- `/thread/<id>` served 200 to a **signed-out** reader with both prompts, the
  winner badge, `won 1 of 1` in the top bar from the parallel-route slot, the
  failed card's plain sentence, and the composer replaced by "you can read it but
  not add to it". Fourteen em dashes on the page, every one of them a number the
  app declined to invent.
- Refusals on the endpoint: signed-out `POST` → 401 with `sign-in-required`
  carried as a normal one-event stream; a body still carrying `messages` → 400
  `Expected \`turnId\` to be an id.`
- Typecheck, lint, format, and a real production build all clean.

**What still needs a person**, because there is no browser automation here by
decision: Clerk's `<Show>` renders nothing server-side, so the signed-in send
control and the signed-out "Sign in to send" both appear only after hydration —
neither is in the served HTML, and only a real browser session can exercise the
whole loop.

- [x] Arcjet in front of the endpoint: shield, bot detection, prompt injection, per-caller token bucket — built and verified
- [x] Switch the bucket from IP to the Clerk user id — done, see the Clerk section above
- [x] Decide the approach for the rest of this feature
- [x] `startTurn` server action: create-or-append, ownership checked, prompt-injection screening moved here
- [x] `Thread.modelIds`: the line-up stored, migrated, and enforced on every model call
- [x] `/api/model-call` takes `{ turnId, modelId }`, derives messages through `conversationFor`, refuses a turn it does not own
- [x] The route records its own `ModelResponse` on close: an answer with metrics, or a failure with whatever partial text arrived
- [x] Live turn state in `features/arena/`: per-model abort, dispatch clock, shared axis scale, reduced-motion tick
- [x] Composer sends for real, locks its line-up after the first turn, and asks a signed-out visitor to sign in
- [x] `/thread/[id]` renders stored turns; the empty arena hands the new turn over through the URL
- [x] Vote action by `(turnId, modelId)`, with every `refusals.ts` sentence surfaced
- [x] Per-card retry, replacing that model's row rather than adding one
- [x] Sidebar reads `listThreadsForOwner`, grown to carry model ids and turn count
- [x] Top bar title and standings through the `@thread` parallel-route slot, refreshed after a vote
- [x] `features/shell/fixtures.ts` deleted; the fixture turn moved to `app/design/`; every `PlaceholderNote` this feature retires is gone
- [x] PostHog: server-side funnel events, and `$ai_generation` built from the measured metrics
- [x] `app/dev-stream/` deleted — the real arena replaces it
- [x] Found and fixed a negative token count reaching the screen, and the generation speed that would have been invented from it
- [x] Verified by hand against a running server: three models streaming independently, one failing without touching the other two, a vote landing, a follow-up continuing each model's own history, and a reload reading it all back
- [x] Typecheck, lint, format, and a real build all clean
- [ ] Send a real prompt while signed in, in a browser: three cards fill at once on one time axis, picking a winner marks it and updates the top bar, a follow-up continues each model's own thread — needs a person
- [ ] Check the same screen at mobile width and with reduced motion on — needs a person

Feature 6 is done bar those two checks. What it deliberately does not include: no
stop button mid-stream, no regenerate-all, no editing a sent prompt, and no
resuming a stream after a reload — a reload shows whatever rows were written and
no more.

Files: `features/arena/` (`actions`, `live`, `view`, `use-arena`, `composer`,
`turn-board`, `thread-arena`, `new-thread`), `features/thread/` (`standings`,
`title`, `record-call`, with `queries`, `writes`, `types` and `mappers`
extended), `features/catalogue/naming.ts`,
`features/design/reduced-motion.ts`, `features/shell/thread-bar.tsx`, the
`app/(app)/thread/[id]` and `app/(app)/@thread` routes, and a migration adding
`Thread.modelIds`.

## Slice 2: App shell & thread history

### 7. App shell & thread history

The frame everything else sits inside: a top bar and sidebar that stay in place while the page scrolls, the thread's name, and each model's win record shown right there (shrinking down to a small dot and number if it gets crowded). The sidebar lists a signed-in user's own past threads so the tool actually feels usable across visits, not just in one sitting.

#### Decided

**The shell is a route group, not a component people remember to use.** `app/(app)/layout.tsx` owns the sidebar and top bar; `/` (arena), `/leaderboard`, and `/models` live inside it and cannot forget to be framed. `/design` deliberately stays outside — it is a reference instrument for the palette, not a screen of the product, and wrapping it in the app chrome would make it lie about what it is.

**shadcn's `sidebar`, not a hand-rolled one.** The pieces this needs — an off-canvas drawer under `lg`, focus trapped inside it, focus returned on close, an escape key that works — are precisely the things that should never be hand-rolled, because the failure mode is a keyboard user stuck behind an invisible panel. It also already reads the `--sidebar-*` tokens, which feature 4 mapped onto our palette, so it arrives wearing the design without a single override. The cost accepted: it pulls in `sheet` and a few primitives we do not otherwise need.

**The win records are one instrument, not three badges.** The sketch shows three pills floating in the top bar. Grouped into a single bordered cluster with hairline dividers, they read as what they actually are — this thread's standings, one readout — which is the same bench vocabulary the rest of the app speaks. That also makes scope's "shrinking down to a small dot and number if it gets crowded" fall out as a real ladder rather than an arbitrary breakpoint, with each step dropping the least informative thing first:

1. Wide — model mark, short name, and the record.
2. Medium — mark and record. The name is the first thing to go, because the mark already identifies the model.
3. Narrow — a single control reading the leader's record, opening the full standings in a popover. Below a certain width three records cannot be shown honestly, and a popover is better than three illegible ones.

**A thread row carries its models and its turn count.** A list of titles is what any chat app does and it is not what makes a thread findable here — you remember "the one where I put Gemma against Qwen" far better than you remember what you called it. So each row is the title, the marks of the models that were in it, and the number of turns in mono. Both facts are true of the content and both help you find the thread again.

**No date grouping.** "Today / Previous 7 days / Older" is the chat-app default, and it earns its place in a product where you scroll hundreds of conversations. Here it would be three headings over four rows.

**Every stub is marked, in one voice, by one component.** Fixture data that looks real is worse than no data, because it quietly becomes the thing people evaluate. A single `PlaceholderNote` marks each surface that is not yet wired, so the marker is consistent, greppable, and deleted feature by feature rather than hunted for. It says what the real thing will do, in the reader's terms, without narrating our issue tracker.

**One fixture module, shared.** Feature 4's design reference already owns a fake turn — a streamer, a buffering model, and a failure. The arena placeholder needs the same three. They move to one module both import, because two copies of the same fake turn is a second place for them to drift, which is the same reasoning that put the timing maths in `metrics.ts` alone.

**What is genuinely placeholder, and what is not:**

| Surface                                     | Now                                               | Becomes real in |
| ------------------------------------------- | ------------------------------------------------- | --------------- |
| Model picker and chips                      | ~~Three fixed slugs~~ live catalogue              | 5 — done        |
| `/models` catalogue                         | ~~Fixture cards~~ live catalogue                  | 5 — done        |
| Answer streaming and voting                 | ~~Fixture turn~~ real streams and real votes      | 6 — done        |
| Thread list                                 | ~~Fixture threads~~ the owner's real threads      | 6 — done        |
| `/leaderboard`                              | Fixture rows through the real `WinRate` component | 9               |
| Sidebar, top bar, standings, routing, theme | **Real, and finished here**                       | —               |

**The thread list is fixtures rather than a live-but-empty query.** `listThreadsForOwner` is built and works, but nothing writes a thread until feature 6, so a real read renders the empty state and nothing else — and the row design, its truncation, and the crowded case would go unreviewed until the feature that depends on them is already being built. A `NODE_ENV` branch falling back to fixtures was rejected outright: a branch whose only job is to show fake data is exactly the kind that survives into production.

**Composer UI, not composer behaviour.** The prompt box, the model chips, and the submit control are part of the frame someone has to look at to judge it, so they get built and styled here. Sending is feature 6's, and the control says so rather than failing silently when pressed.

**Accessibility, beyond the baseline.** A skip link to the main content, because a fixed sidebar puts a lot of links between the top of the page and the answers. Real landmarks — one `nav`, one `main`, one `header`. The sidebar toggle names what it does and reports its state. The current page in the nav carries `aria-current`, not just a rust tint, so it is not signalled by colour alone.

#### What the build turned out to be

The plan held. What it did not anticipate was that the interesting bugs would all be in vendored code and in one line of glue nobody looks at.

**`cn()` was silently deleting every font size in the design system.** `tailwind-merge` resolves conflicts by class group, and it cannot tell `text-micro` — a size from feature 4's scale — from `text-ink-muted`, a colour. Both are `text-*`, so it kept the last one and threw the other away. `cn("measured text-micro text-ink-muted")` returned `measured text-ink-muted`, and the size simply vanished.

Nothing errors when this happens. The element inherits a size, the page looks nearly right, and the type scale quietly stops being a scale. It surfaced only from reading the rendered HTML of a model mark in the top bar and noticing a class that should have been in the list was not. `lib/utils.ts` now names the five sizes through `extendTailwindMerge`, which fixes it without weakening anything — `text-detail text-body` still collapses to `text-body`. **Every component that composes a size and a colour through `cn` was affected**, which is most of them.

**Two vendored shadcn files failed the linter, and both were worth fixing rather than exempting.**

- `hooks/use-mobile.ts` kept the viewport width in state and seeded it from an effect — the same `set-state-in-effect` shape feature 4 already hit twice. Rewritten onto `useSyncExternalStore`, which is what a media query actually is. That also fixed a real behaviour bug the rule was pointing at: the original returned `false` on the first client render regardless of the viewport, so a phone briefly got the desktop layout.
- `sidebar.tsx`'s `toggleSidebar` returned the result of a `setState` — a callback claiming a value it does not have.

**`shadcn add --overwrite` silently reverted feature 4's accessibility fix.** The outline button's border had been moved from `--border` to `--input` because an outline button's edge is a control boundary and WCAG asks 3:1 of it. Adding `sidebar` re-fetched `button.tsx` and put the 1.31:1 version back. Caught and re-applied. **After any `shadcn add`, check the vendored files it touched** — `--overwrite` means what it says, and the reason comments are not protection.

**`SidebarInset` is not used, though it is the obvious partner to `SidebarProvider`.** It renders a `<main>`. The layout already has one, and the top bar belongs outside it: using both would leave every page with two of a landmark that permits one, and put the banner inside the content it labels.

**The vendored `SidebarTrigger` hardcodes "Toggle Sidebar" and reports no state**, so the shell has its own toggle. A control should say what it does and, when it toggles something, say which way it currently is — `aria-expanded`, and a label reading "Hide the sidebar" or "Show the sidebar" rather than naming the widget.

**`WinChip` was deleted.** `ThreadStandings` supersedes it, and once the top bar used the cluster the pill was left with exactly one caller: the design reference page showing it off. A component that exists only to appear on its own reference page is not a shared component. The reference page now shows the real cluster, including its collapse behaviour.

**Deleting `app/page.tsx` broke the typecheck until `.next` was cleared.** Next's generated route validator still imported the removed module, so `tsc` failed on a file nobody wrote. Worth knowing, because the error names a path inside `.next` and reads like a compiler problem rather than a stale-cache one.

**`hooks/` is a layer-wide folder, which this project's folder-by-feature rule otherwise forbids.** It exists because `components.json` points shadcn's generated hooks at it. Left as-is and noted in `coding-standards.md` alongside `components/ui/`: vendored code keeps its own conventions, and pretending otherwise would mean fighting every future `shadcn add`.

Files: `app/(app)/` (the shell layout and the arena, leaderboard, and models screens), `features/shell/` (`app-sidebar`, `top-bar`, `standings`, `skip-link`, `placeholder-note`, `nav`, `fixtures`), `features/arena/` (`fixtures`, `fixture-turn`, `composer`), plus `hooks/use-mobile.ts` and four more vendored `components/ui/` files.

- [x] Decide the approach
- [x] `app/(app)/` route group with the shell layout, and `/`, `/leaderboard`, `/models` inside it
- [x] Sidebar: brand, nav, thread list with model marks and turn count, user and theme in the footer
- [x] Top bar: sidebar toggle, thread name, and the standings cluster with its three-step ladder
- [x] `PlaceholderNote`, used on every surface that is not yet wired
- [x] Shared fixture module, with feature 4's design reference moved onto it
- [x] Arena screen: composer UI and the answer grid on the fixture turn
- [x] `/leaderboard` and `/models` placeholder screens
- [x] Skip link, landmarks, `aria-current`, and a labelled toggle that reports its state — one `main`, one `header`, verified in the rendered HTML
- [x] Found and fixed a silent font-size bug affecting every component in the design system
- [x] Typecheck, lint, format, and a real build all clean; all four routes serve 200 with a clean server log
- [ ] Check it at mobile width in a real browser: drawer opens, traps focus, closes on escape, returns focus — needs a person

Feature 7 is done bar that last check. What it deliberately does not include: sending a prompt, a live model catalogue, and persisted votes, all of which are marked on screen and belong to features 5 and 6.

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
