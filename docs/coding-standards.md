# Coding standards

These conventions were not invented in a meeting. They are what feature 1 already
does, consistently, across the model-call code — read [`features/model-call/`](../features/model-call/)
and you will find every one of them in use. This file writes them down and says
which ones a machine enforces.

The split matters more than the list. **A green lint does not mean the standards
were met**, because half of what this project cares about cannot be checked by a
tool. Those live in their own section below, and they are the ones that need a
person.

`CLAUDE.md` holds the rules; [`scope.md`](./scope.md) holds the reasoning and the
plan. This file is the mechanical layer between them.

## One command

```
pnpm check
```

Typecheck, lint, formatting, and a real production build. That is the whole gate,
and it is what `pre-push` runs.

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Dev server                                        |
| `pnpm typecheck`    | `tsc --noEmit`                                    |
| `pnpm lint`         | ESLint, type-aware                                |
| `pnpm lint:fix`     | ESLint with `--fix`                               |
| `pnpm format`       | Prettier, writes                                  |
| `pnpm format:check` | Prettier, reports only                            |
| `pnpm build`        | Real production build                             |
| `pnpm check`        | All of the above, in the order that fails fastest |

**The build is not redundant with the typecheck.** Clerk v7 removed `<SignedIn>`
and `<SignedOut>`; both typechecked clean and failed only at render. `next build`
is what caught it. Anything that only breaks when a page actually renders is
invisible to `tsc`.

## Hooks

Husky, two of them, split by cost.

- **`pre-commit`** — Prettier and ESLint over staged files only. A couple of
  seconds. Committing has to stay cheap, or people start reaching for
  `--no-verify` and then the hook protects nothing.
- **`pre-push`** — the full `pnpm check`, including the build. Slow checks belong
  at the boundary where the cost is paid once, not on every commit.

Type-aware linting of individual staged files can occasionally report a problem
caused by an unstaged change elsewhere. That is a known cost of the approach and
it is worth paying; the alternative is linting the whole project on every commit.

## Formatting: Prettier only

Prettier owns formatting. ESLint owns correctness. `eslint-config-prettier` goes
last in the ESLint chain and switches off every stylistic rule the other configs
turn on, so the two tools can never disagree about the same line.

`printWidth` is 100 because that is already the codebase's implicit ceiling —
when this was set up, 18 lines sat in the 91–100 band and only 5 exceeded it.
Everything else in [`.prettierrc.json`](../.prettierrc.json) is a Prettier
default, written out explicitly rather than left implied.

`prettier-plugin-tailwindcss` sorts class strings into canonical order. That is
not cosmetic: `CLAUDE.md` says three copies of the same handful of classes is a
component, and that rule is unenforceable by eye if two identical class lists are
written in different orders.

Line endings are LF everywhere, pinned by [`.gitattributes`](../.gitattributes).
Without it, `core.autocrlf=true` rewrites files to CRLF on checkout while Prettier
writes LF, and `format:check` fails on every file in a fresh clone.

## Enforced by the linter

Linting is type-aware (`strict-type-checked` plus `stylistic-type-checked`, with
`projectService`). It roughly doubles lint time and buys `no-floating-promises` —
the one failure class this app is most exposed to, since it is built out of three
concurrent, independently abortable streams where a dropped rejection shows up as
a missing answer rather than a crash.

On top of that set, these rules are configured deliberately. Each one traces to a
rule in `CLAUDE.md` or to a bug this repo actually had.

| Rule                                                   | Why it is here                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-explicit-any`                                      | `CLAUDE.md` says no `any`. Error, not a warning nobody reads.                                                                                          |
| `no-non-null-assertion`                                | Not hypothetical. `lib/prisma.ts` shipped `process.env.DATABASE_URL!` — a non-null assertion standing exactly where a fail-fast check belonged.        |
| `no-restricted-syntax` on `process.env`                | The fail-fast env rule, made mechanical. Configuration is read in one place, so a missing key is a named startup failure.                              |
| `consistent-type-definitions: "type"`                  | Every type here is a `type`. Nothing needs declaration merging.                                                                                        |
| `no-console`, `warn`/`error` allowed                   | Server-side failure logging is required and already uses those two. This catches a debugging `console.log` left behind.                                |
| `no-unused-vars`, `^_` escape hatch                    | Error, not warning.                                                                                                                                    |
| `restrict-template-expressions`, `allowNumber`         | Interpolating a number into a log line is not a mistake. The rule's real value is catching an object or a possibly-undefined value stringifying badly. |
| `no-confusing-void-expression`, `ignoreArrowShorthand` | `(msg) => console.error(msg)` is idiomatic and its return type is already void.                                                                        |

### The env rule, precisely

Banned: reading a secret from `process.env` anywhere except [`env.ts`](../env.ts)
and the bootstrap entry points (`instrumentation.ts`, `instrumentation-client.ts`,
`prisma.config.ts`).

Always allowed, anywhere: `NODE_ENV` and `NEXT_PUBLIC_*`. Next substitutes those
at build time, and the substitution only happens on a literal `process.env.X` —
routing them through a function call breaks it on the client. Neither is a secret,
so neither needs the fail-fast treatment.

**There is exactly one sanctioned exception**, in [`lib/arcjet.ts`](../lib/arcjet.ts),
with the reason written inline next to the disable comment: it runs at module
scope, `next build` evaluates route modules, and reaching for a validated key
there would make building the app require a live secret. A build is not a run.

That pattern is the point of the rule. **When you disable it, write down why.**
An inline disable carrying a real reason is a better outcome than a silent
allow-list, because the next person reads the reason instead of guessing at it.

## Conventions the linter cannot check, but which still hold

Every item here is real and none of it shows up in a lint run.

**Naming and shape**

- Filenames are kebab-case. Types are `type`, never `interface`. Exports are
  named — no default exports outside the files Next requires them in.
- Functions are arrow-function `const`s, except generators, which cannot be.
- `readonly` on every property of every type, `const` everywhere, `map`/`filter`/
  `reduce` over mutating loops.

**Structure**

- **Folder by feature**, not by layer. Everything a feature owns lives in
  `features/<name>/`. `lib/` is for genuinely shared clients only.
- **Pure core, effects at the edge.** One file per feature is allowed to know
  about HTTP; the rest is pure and dependency-injected. `call-model.ts` takes its
  clock and its model factory as arguments, which is what makes it testable by
  hand and what keeps `stream-response.ts` the only HTTP-aware file.
- Derived numbers are computed in exactly one place. `metrics.ts` owns all of the
  timing maths so the response card, the leaderboard, and PostHog agree by
  construction rather than by three copies of the same division.
- **Cross-feature imports run one way, along a published contract.** There is a
  second feature now, and it needed one: `features/thread/` imports
  `ModelMetrics`, `ModelCallFailure`, and `ChatMessage` from
  `features/model-call/types.ts`, whose own doc comment calls itself "the
  contract between a model call and everything downstream of it". Copying those
  types would create a second place for them to drift, which is exactly what the
  derived-numbers-in-one-place rule exists to prevent. What is not allowed is the
  reverse direction, or importing anything from another feature that is not part
  of its stated contract — `model-call` knows nothing about threads and must stay
  that way. `features/design/` is the second case and points the same way: the
  answer card renders a `ModelMetrics` and a `ModelCallFailure` and derives
  neither.

**Vendored UI**

- `components/ui/` and `lib/utils.ts` are generated by the shadcn CLI. They are
  meant to be edited, but treat an edit the way you would treat a lint disable:
  write down why, inline. There is exactly one so far — the outline button draws
  its border from `--input` rather than shadcn's default `--border`, because an
  outline button's edge _is_ the control's boundary and WCAG asks 3:1 of it,
  while `--border` is this app's decorative hairline at 1.31:1.
- They are not exempt from the linter, and it has earned its keep on them twice:
  `sidebar.tsx` returned a void expression from `toggleSidebar`, and
  `hooks/use-mobile.ts` seeded state from an effect — which was also a real
  behaviour bug, since it reported "not mobile" on the first client render
  whatever the viewport actually was.
- **`shadcn add --overwrite` reverts your edits without saying so.** Adding
  `sidebar` silently restored the stock outline button and undid the contrast fix
  above. After any `shadcn add`, check the files it touched; a reason written in a
  comment is documentation, not protection.
- `hooks/` is a layer-wide folder, which folder-by-feature otherwise forbids. It
  exists because `components.json` points shadcn's generated hooks at it.
  Vendored code keeps its own conventions; re-pathing it would mean fighting
  every future `shadcn add`.
- **Never restyle a shadcn component at the call site to fix a colour.** Every
  slot it reads is mapped onto this app's tokens in `globals.css`, so a colour
  that looks wrong is a token mapping to fix once, not a `className` to patch in
  one place and forget in three.

**Honesty about data**

- **Never zero-fill to look complete.** Anything the provider did not report stays
  `null` and renders as an em dash. A number that would be a lie is not printed.
- If a measurement cannot be taken honestly, say why rather than inventing one.
  `tokensPerSecond` is `null` for a model that flushed its answer in one chunk,
  and `streamed: false` explains it, so the UI can print "arrived in one chunk"
  instead of an unexplained blank.
- Cost always reads $0.0000, because every model here is free tier. That is
  correct, not a bug, and it is still shown — it is a real measured number.

**Errors**

- **A provider error never reaches a user.** It maps to a closed union of failure
  kinds, each carrying a plain human sentence and a `retryable` flag. The real
  detail goes to the server log only.
- That includes refusals from Arcjet. A denial is streamed as a normal one-event
  body with the real HTTP status, so the browser reads it through the same path as
  a success and the human sentence survives.

**Comments**

Comments explain _why_, never _what_. The codebase's convention is a doc comment
at the top of each module stating what contract it holds and what it deliberately
does not know about, and inline comments only where a reader would otherwise
reasonably ask "why is it done this way" — usually because the obvious version was
tried and was wrong. Several comments here record a measurement that changed a
decision. Keep doing that; it is the most useful kind.

**Design and accessibility**

Both are decided in [`scope.md`](./scope.md), not here. The baseline on every
screen: real contrast, visible focus, full keyboard operation. Shared spacing and
color live in `globals.css` or a shared component, never copy-pasted Tailwind.

## Deliberately not installed

- **No test runner, no browser automation.** Decided project-wide. Verification is
  a running dev server and a real browser, or something as light as `curl`. Do not
  install one to check that something works.
- **No `eslint-plugin-functional`.** The functional-style rules matter, but this
  plugin fights idiomatic React and Prisma hard enough that the disable comments
  would outnumber the catches.
- **No commitlint or conventional-commit enforcement.** Single author, no
  changelog automation. Pure ceremony.
- **No `prefer-readonly-parameter-types`.** Sounds aligned with the immutability
  rule; in practice flags essentially every React and library type it touches.
