"use client";

import { useSyncExternalStore } from "react";

/**
 * Consent store (PECR/UK-GDPR). No non-essential scripts load until accepted.
 * Uses useSyncExternalStore so components read consent without setState-in-effect.
 */
export const CONSENT_KEY = "sc_consent_v1";
export type Consent = "accepted" | "rejected" | null;

export function getConsent(): Consent {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(CONSENT_KEY);
  return v === "accepted" || v === "rejected" ? v : null;
}

export function setConsent(value: "accepted" | "rejected") {
  window.localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new Event("sc-consent-change"));
}

function subscribe(cb: () => void) {
  window.addEventListener("sc-consent-change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("sc-consent-change", cb);
    window.removeEventListener("storage", cb);
  };
}

export function useConsent(): Consent {
  return useSyncExternalStore(subscribe, getConsent, () => null);
}

/** True only after client hydration — avoids SSR flashes without an effect. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
