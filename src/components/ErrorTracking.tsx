"use client";

import { useEffect } from "react";
import { initErrorTracking } from "@/lib/error-report";

/**
 * SC Design Wirral — global client error tracker.
 *
 * Mounts once at the root and installs the capture paths (uncaught errors,
 * resource failures, promise rejections, console.error, plus breadcrumb
 * listeners). Renders nothing. All work is fire-and-forget and never throws, so
 * it can't affect the page. See src/lib/error-report.ts.
 */
export function ErrorTracking() {
  useEffect(() => {
    initErrorTracking();
  }, []);
  return null;
}
