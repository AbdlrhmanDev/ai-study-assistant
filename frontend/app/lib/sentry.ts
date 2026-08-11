/**
 * Optional frontend error monitoring, gated entirely on
 * NEXT_PUBLIC_SENTRY_DSN being set -- with it unset (the default), nothing
 * here does anything, no data leaves the browser, and no extra network
 * calls happen.
 */

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  initialized = true;
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      // Never attach IP/cookies/headers automatically -- keep this to
      // explicit error reports only, matching the backend's send_default_pii=False.
      sendDefaultPii: false,
    });
  });
}

export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/react").then((Sentry) => {
    Sentry.captureException(error, extra ? { extra } : undefined);
  });
}
