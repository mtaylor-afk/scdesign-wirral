import type { Metadata } from "next";
import { ErrorTestClient } from "./ErrorTestClient";

/**
 * TEMPORARY error-logging test page. Delete this folder (src/app/error-test)
 * once testing is confirmed. Noindex so it never reaches search engines.
 */
export const metadata: Metadata = {
  title: "Error logging test",
  robots: { index: false, follow: false },
};

export default function ErrorTestPage() {
  return <ErrorTestClient />;
}
