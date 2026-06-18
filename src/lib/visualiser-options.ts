/**
 * Pure visualiser options + prompt builder — NO native/server deps (no Sharp),
 * so it is safe to import from client components AND the server route.
 */

export const PROJECT_TYPES = [
  { value: "rear", label: "Rear extension" },
  { value: "side", label: "Side extension" },
  { value: "wraparound", label: "Wraparound extension" },
  { value: "loft-dormer", label: "Loft conversion (dormer)" },
  { value: "general", label: "General design idea" },
] as const;

export const STOREYS = [
  { value: "single", label: "Single storey" },
  { value: "two", label: "Two storey" },
  { value: "unsure", label: "Not sure" },
] as const;

export const STYLES = [
  { value: "modern", label: "Modern" },
  { value: "traditional", label: "Traditional" },
  { value: "brick-match", label: "Brick match" },
  { value: "rendered", label: "Rendered" },
  { value: "glass-steel", label: "Glass & steel" },
  { value: "warm-contemporary", label: "Warm contemporary" },
] as const;

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_DIMENSION = 320;
export const MAX_DIMENSION = 8000;

/**
 * gpt-image-1 only outputs at three discrete native sizes. Pick the one whose
 * aspect ratio matches the input photo so the model never has to pad/crop/
 * re-render the scene at a different ratio (the root cause of the "shrunken
 * room" artefact on portrait phone uploads). Pure — safe on client and server.
 */
export type NativeSize = "1024x1024" | "1536x1024" | "1024x1536";

export function pickNativeSize(width: number, height: number): { size: NativeSize; w: number; h: number } {
  if (!width || !height) return { size: "1024x1024", w: 1024, h: 1024 };
  const ar = width / height;
  if (ar > 1.18) return { size: "1536x1024", w: 1536, h: 1024 }; // landscape
  if (ar < 0.85) return { size: "1024x1536", w: 1024, h: 1536 }; // portrait
  return { size: "1024x1024", w: 1024, h: 1024 }; // square-ish
}

// NOTE: the image-edit PROMPT is built server-side in the visualiser backend
// (api/sc-visualise.js, TailoredQuote repo) — see CLAUDE.md "Visualiser". The
// former client-side buildPrompt() was dead code (never imported, never sent —
// the POST body carries only the option keys + notes) and has been removed so
// there is no misleading second copy of the prompt logic.
