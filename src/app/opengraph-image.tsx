import { ImageResponse } from "next/og";
import { brandAssets } from "@/lib/brand-assets";

export const dynamic = "force-static";

export const alt =
  "SC Design Wirral — Architectural Design across Wirral, Liverpool, Cheshire, Warrington & North Wales";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card Google, Facebook, LinkedIn and WhatsApp show beside a link, and the
 * `image` on the LocalBusiness JSON-LD (lib/seo.ts).
 *
 * Sean asked for the brand lockup here instead of the old text-only card, so the
 * thumbnail beside a search result is the SC Design Wirral wordmark rather than
 * whichever page photo Google happened to pick.
 *
 * The artwork comes from the generated brand-assets module rather than being
 * read off disk: `output: "export"` renders this at build time, and a disk read
 * would resolve against process.cwd(), which is whatever directory the build or
 * dev server started in.
 *
 * Note: this is the strongest signal we can send, not a guarantee. Google still
 * chooses what it shows, and the image beside a Business Profile panel comes
 * from that profile, not from the website.
 */
const wordmark = brandAssets.brandWordmark;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // Matches the wordmark PNG's own background so the artwork sits
          // flush rather than reading as a pasted-on rectangle.
          background: "#f6f0eb",
          color: "#211e1b",
          padding: "72px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wordmark.src} alt="" width={820} height={266} />
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 30,
            textAlign: "center",
            lineHeight: 1.35,
            color: "#46413b",
            maxWidth: 940,
          }}
        >
          Architectural design for extensions, loft conversions and planning drawings across Wirral,
          Cheshire &amp; Merseyside
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 24,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#9b1b1b",
          }}
        >
          Sean Corser MCIAT · 15+ years
        </div>
      </div>
    ),
    { ...size }
  );
}
