/**
 * The one place the database's failure enum and the app's failure union are
 * tied together.
 *
 * Prisma enum members cannot contain a hyphen, so the generated TypeScript
 * names are `RATE_LIMITED` where the union says `"rate-limited"` — the schema's
 * `@map` keeps the stored column value identical to the union's string, but the
 * two type names still have to be reconciled somewhere.
 *
 * Both directions go through a `Record` keyed by the *other* side, which is the
 * whole trick: `TO_DB` must name every member of the union, and `FROM_DB` must
 * name every member of the enum. Adding a failure kind to one and forgetting
 * the other is a typecheck error rather than a runtime surprise on a row nobody
 * looks at until it matters.
 */

import type { ModelCallFailureKind } from "@/features/model-call/types";
import type { ModelCallFailureKind as StoredFailureKind } from "@/lib/generated/prisma/enums";

const TO_DB: Readonly<Record<ModelCallFailureKind, StoredFailureKind>> = {
  unauthorized: "UNAUTHORIZED",
  "rate-limited": "RATE_LIMITED",
  unavailable: "UNAVAILABLE",
  timeout: "TIMEOUT",
  aborted: "ABORTED",
  "sign-in-required": "SIGN_IN_REQUIRED",
  blocked: "BLOCKED",
  flagged: "FLAGGED",
  unknown: "UNKNOWN",
};

const FROM_DB: Readonly<Record<StoredFailureKind, ModelCallFailureKind>> = {
  UNAUTHORIZED: "unauthorized",
  RATE_LIMITED: "rate-limited",
  UNAVAILABLE: "unavailable",
  TIMEOUT: "timeout",
  ABORTED: "aborted",
  SIGN_IN_REQUIRED: "sign-in-required",
  BLOCKED: "blocked",
  FLAGGED: "flagged",
  UNKNOWN: "unknown",
};

export const toStoredFailureKind = (kind: ModelCallFailureKind): StoredFailureKind => TO_DB[kind];

export const fromStoredFailureKind = (kind: StoredFailureKind): ModelCallFailureKind =>
  FROM_DB[kind];
