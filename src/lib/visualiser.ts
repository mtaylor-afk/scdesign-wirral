import "server-only";
import sharp from "sharp";

// Re-export the pure options/prompt so server callers can keep one import path.
export * from "./visualiser-options";

export type GeminiResult =
  | { ok: true; buffer: Buffer; mime: string }
  | { ok: false; reason: "refused" | "error" };

/**
 * Call the Gemini image-edit model. Returns the first image part as a Buffer.
 * Caller is responsible for watermarking/processing afterwards.
 */
export async function callGeminiImageEdit(
  imageBuffer: Buffer,
  mime: string,
  prompt: string
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  if (!apiKey) return { ok: false, reason: "error" };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mime, data: imageBuffer.toString("base64") } },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      console.error("[visualiser] gemini http", res.status, await res.text());
      return { ok: false, reason: res.status === 400 ? "refused" : "error" };
    }

    const data = (await res.json()) as {
      candidates?: {
        content?: {
          parts?: {
            inline_data?: { data?: string; mime_type?: string };
            inlineData?: { data?: string; mimeType?: string };
          }[];
        };
      }[];
    };

    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const inline = part.inline_data || part.inlineData;
      const b64 = inline?.data;
      const partMime =
        (inline as { mime_type?: string })?.mime_type ||
        (inline as { mimeType?: string })?.mimeType ||
        "image/png";
      if (b64) return { ok: true, buffer: Buffer.from(b64, "base64"), mime: partMime };
    }
    // No image returned — treat as a refusal/empty result.
    return { ok: false, reason: "refused" };
  } catch (err) {
    console.error("[visualiser] gemini call failed", err);
    return { ok: false, reason: "error" };
  }
}

const WATERMARK_TEXT =
  "Concept visualisation by SC Design & Construction · powered by TailoredQuote";

/** XML-escape for safe inclusion inside the SVG <text> element. */
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function watermarkSvg(width: number, height: number): string {
  const pad = Math.round(width * 0.02);
  const fontSize = Math.max(13, Math.round(width / 58));
  const boxH = Math.round(fontSize * 2.1);
  const textPad = Math.round(fontSize * 0.9);
  const boxW = Math.min(
    width - pad * 2,
    Math.round(WATERMARK_TEXT.length * fontSize * 0.49) + textPad * 2
  );
  const x = width - pad - boxW;
  const y = height - pad - boxH;
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="${Math.round(boxH / 2)}" fill="black" fill-opacity="0.42"/>
    <text x="${x + boxW - textPad}" y="${y + boxH / 2}" text-anchor="end" dominant-baseline="central"
      font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="white" fill-opacity="0.92">${xmlEscape(WATERMARK_TEXT)}</text>
  </svg>`;
}

/**
 * Resize, watermark (bottom-right, tasteful, semi-transparent) and strip EXIF.
 * `.rotate()` auto-orients from EXIF; not calling `.withMetadata()` strips it.
 */
export async function processResultImage(input: Buffer): Promise<Buffer> {
  const targetWidth = 1600;
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  const svg = watermarkSvg(info.width, info.height);
  return sharp(data)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 86, progressive: true })
    .toBuffer();
}

/** Read dimensions + validate basic sanity. */
export async function inspectImage(buffer: Buffer) {
  const meta = await sharp(buffer).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0, format: meta.format };
}
