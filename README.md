# ✌️Note:

This is basically me learning agentic coding. The workflow, everything. Cool project nonetheless. 

# LLM Arena

Send one prompt to up to three AI models at once, watch them answer side by side, and vote for the best one. Real votes and real per-call measurements build a leaderboard of which model is actually worth using.

Every model in the arena is free tier, so cost always reads `$0.0000`. That is a real measured number, not a placeholder, and it is shown rather than hidden.

## What it does

- **Arena** (`/`) — pick up to three models, send a prompt, and watch three independent streams arrive. One model failing never affects the other two.
- **Thread** (`/thread/[id]`) — the conversation, readable by anyone with the link. Only its owner can add to it or vote.
- **Leaderboard** (`/leaderboard`) — win rates over real votes, globally or across your own threads.
- **Models** (`/models`) — the live free-tier catalogue, read straight from OpenRouter.
- **Design reference** (`/design`) — every colour token, type step, component state, and measured contrast pair on one page. This project has no test runner by decision, so this is the page you check a styling change against.

## The measurements are the point

The app is built around not reporting a number it cannot defend:

- Anything a provider did not report stays `null` and renders as an em dash — never a zero, never a blank that looks like a bug.
- There are **two** speed figures, because there are honestly two things to say. `tokensPerSecond` is text streamed over the window it arrived in, and is `null` for a model that flushes its whole answer at once, because that has no observable generation speed. `endToEndTokensPerSecond` divides everything produced, thinking included, by the whole wait — the only speed that compares a streaming model against a buffering one fairly, which is why the leaderboard uses it.
- Reasoning tokens are split out from written ones. Counting them together made a three-sentence answer read as absurd verbosity.
- A win rate never appears without the count behind it: always `won 4 of 5`, never a bare percentage. A model nobody has judged shows an em dash, not `0%`, because zero would claim it lost.

## Stack

Next.js 16 (App Router) · TypeScript, strict · Tailwind 4 with shadcn · Prisma with Postgres · Clerk for auth · Arcjet in front of every write and both public reads · PostHog for analytics · OpenRouter via the Vercel AI SDK.

## Running it

**Prerequisites:** Node 20.19+, pnpm 11, and a Postgres database.

```bash
pnpm install
cp .env.example .env.local     # then fill it in, see below
pnpm exec prisma generate      # the client is gitignored, so this is required
pnpm exec prisma migrate deploy
pnpm dev
```

Then open <http://localhost:3000>.

### Environment

Five keys are required, and the server **refuses to start** without them — it throws at startup naming every one that is missing, rather than failing later on someone's first prompt. `.env.example` lists each with a link to where it comes from.

| Key                                 | Where from                     |
| ----------------------------------- | ------------------------------ |
| `OPENROUTER_API_KEY`                | <https://openrouter.ai/keys>   |
| `ARCJET_KEY`                        | <https://app.arcjet.com>       |
| `DATABASE_URL`                      | any Postgres connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | <https://dashboard.clerk.com>  |
| `CLERK_SECRET_KEY`                  | <https://dashboard.clerk.com>  |

**One local-only gotcha.** Some Arcjet rules are keyed on the caller's IP, and localhost has none — so the fingerprint cannot be built, the whole decision errors, and every rule fails open silently. Set `ARCJET_ENV=development` in `.env.local` if you want to exercise bot detection or a rate limit by hand. Never set it in production.

A consequence worth knowing before you debug something: **`curl` is denied on `/thread/[id]` and `/leaderboard`.** A bare `curl` returning `403` is the bot protection working, not the page being broken. Checking those routes by hand needs a realistic browser user agent.

## Checks

```bash
pnpm check   # typecheck, lint, format:check, and a real build
```

Each is also available on its own: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`.

**There is no test runner and no browser automation here, by decision.** Verification is a running dev server and a real browser, or something as light as `curl` — with the caveat above, that the two guarded routes need browser headers before `curl` gets past bot detection. That decision is settled rather than pending: please do not add a test runner to check that something works.

## Layout

Folder by feature, not by shared layer-wide folders. Each directory under `features/` owns its own types, logic, and components, keeps its side effects at the edges, and states its reasoning in the files themselves.

```
app/           routes only — the (app) group is the shell every screen sits in
features/
  arena/       the composer, the live streams, and the two write actions
  catalogue/   the live free-tier model list from OpenRouter
  design/      shared visual components and the one place a number becomes text
  leaderboard/ the aggregates, the ranking, and the board
  model-call/  the contract between a model call and everything downstream
  shell/       sidebar, top bar, and the public-read guards
  thread/      the stored shape of a conversation, its reads and its writes
prisma/        schema and migrations
docs/          the plan, the standards, and the UI sketches
```

## Documentation

- **[`docs/scope.md`](docs/scope.md)** — the living plan, feature by feature. It records what was decided, why, what the build turned out to be when reality disagreed with the plan, and what is still open. Read it before building anything.
- **[`docs/coding-standards.md`](docs/coding-standards.md)** — the conventions, split by which ones a tool enforces and which ones need a person.
- **[`CLAUDE.md`](CLAUDE.md)** — how to work in this repo.

The code comments carry the reasoning too. Where a decision looks odd, the file it lives in usually says why, and if it does not, `scope.md` will.
