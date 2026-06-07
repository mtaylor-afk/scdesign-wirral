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

      <h2>Managing your choice</h2>
      <p>
        You can change your decision at any time by clearing this site&apos;s storage in your
        browser, or by contacting us at <a href={`mailto:${site.email}`}>{site.email}</a>. Until you
        accept, nothing non-essential is loaded.
      </p>
    </LegalLayout>
  );
}
