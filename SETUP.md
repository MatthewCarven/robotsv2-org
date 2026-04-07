# robotsv2.org — GitHub + Cloudflare Pages Setup

## Step 1: Create the GitHub repo

On GitHub (github.com), click **New Repository**:
- Name: `robotsv2-org`
- Description: `robots2.txt specification — AI policy for the open web`
- Public (the spec is open, the repo should be too)
- DON'T add a README — we already have files

## Step 2: Push this folder to GitHub

Open a terminal in this folder and run:

```
git init
git add .
git commit -m "Initial commit - robotsv2.org RC1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/robotsv2-org.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username (MatthewCarven).

## Step 3: Connect Cloudflare Pages

1. Go to https://dash.cloudflare.com
2. Sign up / log in (free account is fine)
3. In the sidebar, click **Workers & Pages**
4. Click **Create** → **Pages** → **Connect to Git**
5. Select your GitHub account and the `robotsv2-org` repo
6. Configure the build:
   - **Project name:** `robotsv2`
   - **Production branch:** `main`
   - **Build command:** (leave blank — no build needed, it's static)
   - **Build output directory:** `public`
7. Click **Save and Deploy**

Cloudflare will deploy the site in about 30 seconds. You'll get a
temporary URL like `robotsv2.pages.dev` — check it works.

## Step 4: Add your custom domain

1. In Cloudflare Pages → your project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `robotsv2.org`
4. Cloudflare will tell you to update your DNS. Go to Porkbun:
   - Delete any existing A/AAAA/CNAME records for robotsv2.org
   - Add a CNAME record:
     - Host: `@` (or blank, depending on Porkbun's UI)
     - Answer/Target: `robotsv2.pages.dev`
     - TTL: Auto
   - Also add for www:
     - Host: `www`
     - Answer/Target: `robotsv2.pages.dev`
5. Back in Cloudflare, click **Activate domain**
6. Wait for DNS to propagate (usually 5-30 minutes, sometimes up to 24 hours)
7. Cloudflare automatically provisions SSL — HTTPS just works

## Step 5: Set up the typo redirect (robotv2.org)

In Porkbun for `robotv2.org`:
1. Go to Domain Management → robotv2.org
2. Look for **URL Forwarding** or **Web Forwarding**
3. Set up:
   - Forward to: `https://robotsv2.org`
   - Type: **301 Permanent Redirect**
   - Forward path: **Yes** (so robotv2.org/transparency → robotsv2.org/transparency)

## Step 6: Verify everything works

Open a terminal and run these checks:

```
# Main site loads
curl -I https://robotsv2.org

# robots.txt served correctly
curl -I https://robotsv2.org/robots.txt
# Should show: content-type: text/plain

# robots2.txt served correctly
curl -I https://robotsv2.org/robots2.txt
# Should show: content-type: text/plain

# Typo redirect works
curl -I https://robotv2.org
# Should show: 301 → https://robotsv2.org

# Honeypots serve content
curl -s https://robotsv2.org/public/vote | head -5
# Should show the compliance verification page

# Community baseline downloadable
curl -I https://robotsv2.org/community-baseline.txt
# Should show: content-type: text/plain
```

## Updating the site

After initial setup, updating is just:

```
git add .
git commit -m "Description of what changed"
git push
```

Cloudflare auto-deploys within 30 seconds of every push. No server
restarts, no SSH, no builds. Just push and it's live.

## File structure explained

```
robotsv2-site/
├── .gitignore
├── SETUP.md                  ← You are here
└── public/                   ← This folder IS the website
    ├── index.html            ← Landing page + validator
    ├── transparency.html     ← Transparency register
    ├── robots.txt            ← Standard robots.txt (legacy crawlers)
    ├── robots2.txt           ← Our own robots2.txt (dogfooding)
    ├── community-baseline.txt← Community baseline policy
    ├── _redirects            ← Cloudflare routing rules
    ├── honeypots/
    │   └── vote.html         ← Compliance verification trap page
    └── downloads/
        ├── robots2-template.txt    ← Spec template (user downloads this)
        ├── robots2-ask-python.py   ← Python ask middleware
        └── robots2-ask-node.js     ← Node.js ask middleware
```

The `public/` folder is set as the build output in Cloudflare Pages.
Everything inside it gets served as the website. Everything outside
it (like this SETUP.md) lives in the repo but isn't public.

---

*Matthew, Claude & Gemini — robotsv2.org — 2026*
