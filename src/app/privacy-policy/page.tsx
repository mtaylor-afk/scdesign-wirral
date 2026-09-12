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
    <LegalLayout title="Privacy Policy" updated="September 2026">
      <p>
        This policy explains how {site.name} (&quot;we&quot;, &quot;us&quot;) handles personal data
        when you use this website, contact us, or use the Extension Concept Visualiser. We are the
        data controller for the information described here.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Contact details you provide (name, email, phone, postcode) when you enquire.</li>
        <li>
          The content of your message and the project details you select (project type, stage,
          timescale, rough budget and so on).
        </li>
        <li>The page you enquired from, to help us understand your enquiry.</li>
        <li>
          When you use the Extension Concept Visualiser: the photo you upload, the concept image it
          creates, and the details you enter (email, optional phone number, options and notes).
        </li>
        <li>
          Anonymous, cookieless traffic analytics — Cloudflare Web Analytics and our own
          first-party analytics. No cookies, no stored IP addresses and no personal data; used only
          to understand site usage in aggregate.
        </li>
      </ul>
      <p>
        We do not ask for or collect payment-card details, bank details or any special-category data
        through this website.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To respond to your enquiry and discuss your project.</li>
        <li>
          To send your enquiry to us by email and keep a secure record of it, so it can&apos;t get
          lost. We may also email you to confirm we&apos;ve received it.
        </li>
        <li>
          To generate a concept visualisation when you use the visualiser and email you the result.
          A copy of your photo, the concept and the details you entered is also emailed to{" "}
          {site.shortName} and our website administrator, so we can see what the tool produced and
          help if you get in touch.
        </li>
        <li>To protect the forms from spam and abuse.</li>
        <li>
          To understand, in aggregate, which pages are most useful (anonymous, cookieless analytics).
        </li>
      </ul>
      <p>
        The cost estimator runs entirely in your browser — it gives an indicative range from the
        options you choose and does not, by itself, send any personal data to us. We only hear from
        you if you then choose to enquire.
      </p>

      <h2>Lawful bases</h2>
      <p>
        We rely on legitimate interests (responding to enquiries you initiate, keeping our forms
        secure, and anonymous cookieless analytics), consent (the third-party reviews widget), and
        taking steps at your request prior to entering into a service.
      </p>

      <h2>Data retention</h2>
      <ul>
        <li>
          Enquiries are delivered to us by email and also stored in our secure enquiry database
          (access is restricted to us). We keep them for up to 24 months after our last contact with
          you, then delete them — unless we need them for longer for an ongoing project or to meet
          a legal obligation.
        </li>
        <li>
          Visualiser: your photo is sent to our image-generation provider to create the concept and
          is not kept on our website servers afterwards. The copies emailed to us (your photo, the
          concept and the details you entered) are kept for up to 24 months after our last contact,
          then deleted.
        </li>
      </ul>

      <h2>Who processes your data for us</h2>
      <p>
        We use a small number of trusted providers (&quot;processors&quot;) to run the website and
        its features. We do not sell your data, and we only share what each provider needs to do its
        job:
      </p>
      <ul>
        <li>
          <strong>Cloudflare</strong> — hosts the website, provides privacy-friendly, cookie-free
          <strong> Web Analytics</strong> (anonymous, aggregate page-view counts; no cookies, no
          personal data), and (where enabled) the &quot;Turnstile&quot; anti-spam check on the
          enquiry form.
        </li>
        <li>
          <strong>Vercel</strong> — runs the small serverless functions that process your enquiry,
          the visualiser, and our first-party, cookieless website analytics.
        </li>
        <li>
          <strong>Supabase</strong> — stores our anonymous, cookieless analytics events (page views
          and on-site actions — no cookies, no IP addresses), and the secure record of the enquiries
          you send us.
        </li>
        <li>
          <strong>Apple (iCloud Mail)</strong> — delivers enquiry and visualiser emails to us, and
          any confirmation or visualiser-result email to you.
        </li>
        <li>
          <strong>OpenAI</strong> — processes the photo you upload to the visualiser to generate a
          concept image. Your photo is not used to train its models.
        </li>
        <li>
          <strong>Featurable / Google</strong> — supplies the Google-reviews widget, which only
          loads if you accept it.
        </li>
      </ul>

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
