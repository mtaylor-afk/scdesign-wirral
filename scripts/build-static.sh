#!/usr/bin/env bash
# Build the SC site as a static export for GitHub Pages under /sc/site.
# API routes are POST handlers and can't be statically exported, so they are
# moved aside during the build and restored afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p .static-build-tmp
[ -d src/app/api ] && mv src/app/api .static-build-tmp/api || true
restore(){ [ -d .static-build-tmp/api ] && mv .static-build-tmp/api src/app/api || true; rmdir .static-build-tmp 2>/dev/null || true; }
trap restore EXIT

rm -rf out
SC_STATIC_EXPORT=1 NEXT_PUBLIC_STATIC=1 NEXT_PUBLIC_BASE_PATH=/sc/site \
  NEXT_PUBLIC_SITE_URL=https://tailoredquote.co.uk/sc/site \
  npx next build

rm -rf site && cp -r out site
echo "Static site written to sc/site/ ($(find site -name '*.html' | wc -l) pages)"
