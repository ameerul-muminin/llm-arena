import { readEnv } from "./env";

/**
 * Runs once, before the server accepts its first request. A missing key is a
 * startup crash with a readable message, never a silent runtime surprise.
 */
export const register = (): void => {
  readEnv(process.env);
};
