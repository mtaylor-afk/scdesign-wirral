import { LegalLayout } from "@/components/ui/LegalLayout";
import { site } from "@/lib/site";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Cookie Policy",
  description: "How SC Design & Construction uses cookies and similar technologies.",
  path: "/cookie-policy",
});

export default function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy" updated="June 2026">
      <p>
        We keep cookies and tracking to a minimum. Non-essential analytics only load after you
        accept them in the consent banner.
      </p>

      <h2>Essential</h2>
      <p>
        A small amount of strictly necessary storage is used to remember your cookie choice and to
        make the site work. These are always on because the site cannot function without them.
      </p>

      <h2>Analytics (optional)</h2>
      <p>
        If you accept, we use privacy-friendly, cookieless analytics to understand which pages help
        people most. We do not use advertising cookies and do not sell your data.
      </p>

      <h2>Google reviews widget (optional)</h2>
      <p>
        Our reviews are shown through a third-party widget (Featurable, which displays Google
        reviews). To respect your privacy it only loads once you accept non-essential content; until
        then we show a simple link to our Google profile instead.
      </p>

      <h2>Spam protection</h2>
      <p>
        The enquiry form may use Cloudflare Turnstile — a privacy-friendly alternative to a CAPTCHA
        — to tell humans from bots. It does not track you across other websites or use advertising
        cookies.
      </p>

      <h2>Managing your choice</h2>
      <p>
        You can change your decision at any time by clearing this site&apos;s storage in your
        browser, or by contacting us at <a href={`mailto:${site.email}`}>{site.email}</a>. Until you
        accept, nothing non-essential is loaded.
      </p>
    </LegalLayout>
  );
}
