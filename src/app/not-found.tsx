import { Container, Section, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <Section>
      <Container className="py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-strong">404</p>
        <h1 className="mt-3 text-4xl">Page not found</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          The page you were looking for doesn&apos;t exist or has moved. Let&apos;s get you back on
          track.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <LinkButton href="/">Back to home</LinkButton>
          <LinkButton href="/contact" variant="ghost">
            Contact Sean
          </LinkButton>
        </div>
      </Container>
    </Section>
  );
}
