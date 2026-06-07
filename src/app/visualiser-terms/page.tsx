import { LegalLayout } from "@/components/ui/LegalLayout";
import { site } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { withBase } from "@/lib/base";

export const metadata = pageMeta({
  title: "Extension Concept Visualiser — Terms",
  description:
    "Important information about the AI Extension Concept Visualiser: it produces concept visualisations only, not architectural drawings or planning advice.",
  path: "/visualiser-terms",
});

export default function VisualiserTermsPage() {
  return (
    <LegalLayout title="Extension Concept Visualiser — Terms & Disclaimer" updated="June 2026">
      <h2>Concept visualisation only</h2>
      <p>
        The Extension Concept Visualiser uses AI to generate a concept-style image based on the
        photo and options you provide. It is provided for inspiration and illustration only. It is{" "}
        <strong>not</strong>:
      </p>
      <ul>
        <li>an architectural drawing;</li>
        <li>a planning application or planning advice;</li>
        <li>a structural design or any form of engineering advice;</li>
        <li>a building-regulations drawing; or</li>
        <li>confirmation that the design shown can actually be built on your property.</li>
      </ul>
      <p>
        {site.name} will always review your property properly before giving any real design advice.
      </p>

      <h2>Your image</h2>
      <p>
        By uploading an image you confirm you have the right to use it and to allow it to be
        processed to generate a concept visualisation. Do not upload images of other people&apos;s
        property without permission, or any image you do not have the right to use.
      </p>

      <h2>Data handling</h2>
      <p>
        Your uploaded source image is deleted promptly after processing. The generated concept image
        is stored briefly so it can be shown to you and, if you choose, sent to us — and then
        expires after a short period (currently {process.env.VISUALISER_RESULT_EXPIRY_DAYS || "7"}{" "}
        days). See our <a href={withBase("/privacy-policy")}>Privacy Policy</a> for more.
      </p>

      <h2>No guarantee of results</h2>
      <p>
        AI image generation is imperfect and results vary. The tool may occasionally produce
        inaccurate or unexpected output, or be unable to process certain images. It is intended as a
        bit of fun and a starting point for a conversation — nothing more.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Please use the tool only for genuine residential design ideas. We apply reasonable limits
        and checks to prevent misuse.
      </p>
    </LegalLayout>
  );
}
