# Self-hosted Plausible Analytics for scdesignwirral.co.uk

This folder is the **install package** for standing up a self-hosted [Plausible
Community Edition](https://github.com/plausible/community-edition) instance that
the SC Design Wirral site reports to. The website code is already wired for it —
once the instance is live you just send the script URL and it gets switched on.

> **Why this step is yours:** self-hosted Plausible needs a public, always-on
> server running the Plausible app + **PostgreSQL** + **ClickHouse**. That has to
> be provisioned under your own hosting account. Everything on the website side
> is done.

Target subdomain (assumed): **`analytics.scdesignwirral.co.uk`**
Tracked site domain (must match exactly): **`scdesignwirral.co.uk`**

---

## Easiest route (recommended) — managed / one-click Plausible
If you'd rather not run a server, use a managed Plausible CE host and skip the
DIY section entirely:
- **Railway** — has a Plausible template (deploy, set `BASE_URL`, done).
- **PikaPods** / **Elestio** — one-click managed Plausible, ~£5–9/mo, they handle
  ClickHouse/Postgres/updates/backups.

Whichever you pick: create the instance, **add a site** with domain
`scdesignwirral.co.uk`, then send me the **script URL** it gives you
(usually `https://<your-instance>/js/script.js`). That's all I need.

---

## DIY route — your own VPS with Docker
Plausible CE (v3.2.1) = 3 containers: the app (`ghcr.io/plausible/community-edition`),
`postgres:16-alpine`, `clickhouse/clickhouse-server:24.12-alpine`. ClickHouse wants
~2 GB RAM, so use a **2 GB+ VPS** (e.g. Hetzner CX22, DigitalOcean 2 GB).

### 1. DNS
In Cloudflare DNS add an **A record**: `analytics` → your server's IP.
- Using the **Caddy** option below for HTTPS → set it **DNS only (grey cloud)** so
  Let's Encrypt can validate, or
- Using **Cloudflare Tunnel** (below) → no public A record / open ports needed.

### 2. Install Docker + clone the official repo
```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/plausible/community-edition plausible && cd plausible
```
(The official repo already contains the correct `compose.yml` + the ClickHouse
config files — don't recreate those.)

### 3. Config
Copy `plausible-conf.env.example` from this folder to `plausible-conf.env` in the
cloned repo and fill in the two secrets:
```bash
openssl rand -base64 48   # -> SECRET_KEY_BASE
openssl rand -base64 32   # -> TOTP_VAULT_KEY
```

### 4. HTTPS — pick ONE
Plausible has **no built-in TLS**; put a reverse proxy in front.

**Option A — Caddy (auto Let's Encrypt).** Copy this folder's `Caddyfile` and
`compose.caddy.yml` into the cloned repo, then run with both compose files
(step 5). Caddy serves `analytics.scdesignwirral.co.uk` on 80/443 and proxies to
`plausible:8000`. (Open ports 80+443; DNS record must be grey-cloud.)

**Option B — Cloudflare Tunnel (no open ports, fits your Cloudflare setup).**
```bash
docker run -d --name cloudflared --network plausible_default \
  cloudflare/cloudflared tunnel --no-autoupdate run --token <YOUR_TUNNEL_TOKEN>
```
In the Cloudflare Zero Trust dashboard, create a tunnel, add a public hostname
`analytics.scdesignwirral.co.uk` → service `http://plausible:8000`. Cloudflare
provides TLS. (Network name is usually `plausible_default`; confirm with
`docker network ls`.)

### 5. Start
```bash
# Caddy option:
docker compose -f compose.yml -f compose.caddy.yml up -d
# Otherwise (tunnel / external proxy):
docker compose up -d
```

### 6. Create the admin user + add the site
With `ENABLE_EMAIL_VERIFICATION=false` (in the conf), open
`https://analytics.scdesignwirral.co.uk/register`, create the **first** user
(becomes owner). Then set `DISABLE_REGISTRATION=true` in `plausible-conf.env` and
`docker compose up -d` again so nobody else can register.
In the dashboard, **Add a website** with domain exactly `scdesignwirral.co.uk`.

### 7. Hand back to me
Confirm `https://analytics.scdesignwirral.co.uk/js/script.js` loads (200, JS), then
send me that URL. I'll set `NEXT_PUBLIC_PLAUSIBLE_SRC` + `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`,
merge to `main`, deploy, and verify tracking live (accept + reject flows).

---

## What's already done on the website (no action needed)
- `src/components/Analytics.tsx` loads your instance's cookieless `script.js` and
  exposes `track()`.
- **Consent model:** page views + events fire **always** (cookieless, anonymous);
  the richer event **props** are only attached after the visitor accepts in the
  banner ("track always, collect more on consent").
- `src/components/ClickTracking.tsx` already fires goals: `phone_click`,
  `email_click`, `whatsapp_click`, `google_review_click`, `cta_click`,
  `service_click`, `location_click`, plus the visualiser events
  (`visualiser_start/complete/refine/error/download/send_concept`). Add these as
  **Goals** in your Plausible dashboard to see conversions.
- Privacy + cookie policies and the consent banner already describe this model.

## Maintenance (self-hosting reality)
You own updates (`docker compose pull && up -d`), backups (the `db-data` /
`event-data` volumes), server uptime and security. Managed hosts (top of this doc)
do this for you.
