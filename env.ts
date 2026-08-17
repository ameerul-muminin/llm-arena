/**
 * Environment configuration, validated once and loudly.
 *
 * `readEnv` is pure: hand it a source and it either returns a fully-typed,
 * fully-populated config or throws listing every key that is missing. The
 * process-wide check runs from `instrumentation.ts` at server startup, so a
 * missing key stops the server coming up rather than surfacing as a confusing
 * failure on someone's first prompt.
 */

export class MissingEnvError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(
        ", ",
      )}. Add ${missing.length === 1 ? "it" : "them"} to .env.local (see .env.example) and restart the server.`,
    );
    this.name = "MissingEnvError";
    this.missing = missing;
  }
}

export type Env = {
  readonly OPENROUTER_API_KEY: string;
  readonly ARCJET_KEY: string;
  readonly DATABASE_URL: string;
  readonly NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  readonly CLERK_SECRET_KEY: string;
};

type EnvSource = Readonly<Record<string, string | undefined>>;

export const readEnv = (source: EnvSource): Env => {
  const candidate: Env = {
    OPENROUTER_API_KEY: source.OPENROUTER_API_KEY?.trim() ?? "",
    ARCJET_KEY: source.ARCJET_KEY?.trim() ?? "",
    DATABASE_URL: source.DATABASE_URL?.trim() ?? "",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: source.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "",
    CLERK_SECRET_KEY: source.CLERK_SECRET_KEY?.trim() ?? "",
  };

  const missing = Object.entries(candidate)
    .filter(([, value]) => value === "")
    .map(([key]) => key);

  if (missing.length > 0) throw new MissingEnvError(missing);

  return candidate;
};

export const getEnv = (): Env => readEnv(process.env);
