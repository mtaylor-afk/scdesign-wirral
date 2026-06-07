import { LegalLayout } from "@/components/ui/LegalLayout";
import { site } from "@/lib/site";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Privacy Policy",
  description: "How SC Design & Construction collects, uses and protects your personal data.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 2026">
      <p>
        This policy explains how {site.name} (&quot;we&quot;, &quot;us&quot;) handles personal data
        when you use this website, contact us, or use the Extension Concept Visualiser. We are the
        data controller for the information described here.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Contact details you provide (name, email, phone, postcode) when you enquire.</li>
        <li>The content of your message and the project type you select.</li>
        <li>Images you upload to the Extension Concept Visualiser (see retention below).</li>
        <li>Basic, privacy-friendly analytics — only if you accept analytics cookies.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To respond to your enquiry and discuss your project.</li>
        <li>To generate a concept visualisation when you use the visualiser.</li>
        <li>
          To understand, in aggregate, which pages are most useful (analytics only with consent).
        </li>
      </ul>

      <h2>Lawful bases</h2>
      <p>
        We rely on legitimate interests (responding to enquiries you initiate), consent
        (non-essential analytics), and taking steps at your request prior to entering into a
        service.
      </p>

      <h2>Data retention</h2>
      <ul>
        <li>
          Enquiry records are kept only as long as needed to deal with your project and our records.
        </li>
        <li>
          Visualiser source images are deleted promptly after processing. Generated concept images
          expire after a short period (currently {process.env.VISUALISER_RESULT_EXPIRY_DAYS || "7"}{" "}
          days).
        </li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We use trusted processors to run the website and its features (for example, hosting, email
        delivery, image processing and storage). We do not sell your data.
      </p>

      <h2>Your rights</h2>
      <p>
        You have rights under UK GDPR including access, correction, erasure and objection. To
        exercise them, contact us at <a href={`mailto:${site.email}`}>{site.email}</a>. You can also
        complain to the Information Commissioner&apos;s Office (ICO).
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href={`mailto:${site.email}`}>{site.email}</a> or call{" "}
        <a href={`tel:${site.phoneE164}`}>{site.phoneDisplay}</a>.
      </p>
    </LegalLayout>
  );
}
