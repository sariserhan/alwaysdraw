"use client";

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

type EventProperties = Record<string, boolean | number | string | undefined>;

export const posthogConfigured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
export const sentryConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export function captureEvent(name: string, properties?: EventProperties): void {
  if (!posthogConfigured) return;
  posthog.capture(name, properties);
}

export function captureOperationalError(
  error: unknown,
  operation: string,
  properties?: EventProperties,
): void {
  if (sentryConfigured) {
    Sentry.withScope((scope) => {
      scope.setTag("operation", operation);
      if (properties) scope.setContext("operation_details", properties);
      Sentry.captureException(error);
    });
  }
  captureEvent("operation_failed", { operation, ...properties });
}
