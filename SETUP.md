# Setting up the password gate + shared ratings

This adds a shared-password login and lets May & Jay each submit a rating +
comment on a title, stored centrally so you both see each other's changes.
It replaces the old `window.storage` calls (which only ever worked inside
Claude.ai's preview, not on a real site) with a small Cloudflare Pages API
backed by Cloudflare KV.

## New files
```
functions/_middleware.js   <- gates every request behind the password
functions/api/login.js     <- checks the password, sets the auth cookie
functions/api/logout.js    <- clears the auth cookie
functions/api/items.js     <- GET/POST the shared library (KV)
functions/api/rate.js      <- POST a rating+comment for May or Jay
login.html                 <- the password screen
```
`index.html`, `script.js`, `style.css`, `data.js` were updated in place.

## 1. Create a KV namespace
In the Cloudflare dashboard: **Workers & Pages → KV → Create namespace**
(free tier is plenty — call it e.g. `mj-library`).

## 2. Bind it to your Pages project
Your Pages project → **Settings → Functions → KV namespace bindings** → Add:
- Variable name: `LIBRARY_KV`
- KV namespace: the one you just created

(This must match the binding name used in `functions/api/items.js` and
`functions/api/rate.js` — `LIBRARY_KV`.)

## 3. Set the two secrets
Your Pages project → **Settings → Environment variables** → add for both
Production and Preview:
- `SITE_PASSWORD` — the shared password you and May will type in. Mark it
  **Encrypt**.
- `COOKIE_SECRET` — any long random string (e.g. generate one with
  `openssl rand -hex 32`). Mark it **Encrypt** too. This just signs the
  login cookie — you never type it in yourself.

## 4. Push to GitHub
Since your Pages project is already connected to GitHub, committing and
pushing these files will trigger a new deploy automatically. No `wrangler`
CLI needed for this part.

## 5. Try it
Visit your site — you should be bounced to `/login.html`. Enter
`SITE_PASSWORD`. You'll get a cookie that lasts 30 days, after which you'd
need to log in again.

Open any title → there's now a **Rate it** section at the bottom of the
modal: pick May or Jay, drag the slider, add an optional comment, hit
**Save rating**. It writes straight to KV, so it's the same library for
both of you regardless of whose browser/device you're on.

## Notes / limitations
- The "May" vs "Jay" toggle is just a UI convenience (remembered in that
  browser's `localStorage`) — since you already share one password, there's
  no separate login per person. Nothing stops either of you from picking
  the other name; that tradeoff is intentional to keep this simple.
- The password cookie is `HttpOnly` + `Secure` + `SameSite=Lax`, so it's
  not readable by page scripts and only sent over HTTPS.
- If you ever want to rotate the password, just change `SITE_PASSWORD` in
  the dashboard — existing logged-in cookies stay valid until they expire
  (they're signed with `COOKIE_SECRET`, not `SITE_PASSWORD`). Rotate
  `COOKIE_SECRET` too if you want to force everyone to log in again
  immediately.
