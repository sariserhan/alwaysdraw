"use client";

import { useReportWebVitals } from "next/web-vitals";
import { captureEvent } from "@/lib/observability";

export function WebVitals() {
  useReportWebVitals((metric) => {
    captureEvent("web_vital", {
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
    });
  });
  return null;
}
