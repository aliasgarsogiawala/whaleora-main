# Whaleora content studio

Open `/admin` to edit product copy, Safety Hub checklists and habits, journal posts (shown at `/blog`), written testimonials, video reviews, media, ordering, visibility, headings and marquee speed. Prices, photos and SKUs stay in Shopify. The original storefront palette is unchanged.

## Local development

Run `npm run dev`, visit `http://localhost:3000/admin`, and sign in with `ADMIN_PASSWORD` from `.env.local` (or create a password of 8+ characters if that is unset). First-time setup is only available on a local development hostname. Credentials are scrypt-hashed; the browser receives an eight-hour HttpOnly session cookie.

Content lives in Convex whenever `NEXT_PUBLIC_CONVEX_URL` is set — including locally, under the `CONTENT_NAMESPACE` you configure (default `whaleora`, kept separate from the deployed namespaces). With no Convex URL it falls back to a file in `.whaleora/`, which is gitignored; back up that directory. `CONTENT_DATA_DIR` can point to another private persistent directory. Do not put it inside `public/`. The file fallback is for a single server process only.

New items start hidden. Complete all required fields before saving, even for hidden items. Keep the demo checkbox enabled for fictional content. Real testimonials require permission from their authors.

- **Save draft:** persists edits without changing the live site.
- **Preview:** shows the current unsaved text and playable media. The live store displays video thumbnails in a horizontal 3D coverflow; Watch review opens the video player.
- **Publish:** validates, saves and publishes the current edits after confirmation. Reload the storefront to see them.
- **Reload saved draft:** available after an error; warns before discarding unsaved edits. Concurrent edits in another tab cannot silently overwrite newer saves.

Local uploads accept MP4 videos up to 30 MB and JPG/PNG/WebP thumbnails up to 5 MB. They are served through `/api/media/…` with video range requests supported. Uploads are public to anyone with the URL; never upload private media. Removing a review does not delete its uploaded file. Unused media is retained to avoid breaking existing published links.

## Production / Vercel

Set these server-only environment variables before deployment:

```text
ADMIN_PASSWORD=<a unique password, at least 8 characters>
ADMIN_SESSION_SECRET=<random secret, at least 32 characters>
ADMIN_ORIGIN=https://your-store-domain.example
NEXT_PUBLIC_CONVEX_URL=<Convex deployment URL>
ORDERS_INGEST_SECRET=<the same secret set in the Convex deployment>
CONTENT_NAMESPACE=whaleora-production
UPLOADTHING_TOKEN=<UploadThing app token, for customer review photos>
CONVEX_DEPLOY_KEY=<production deploy key from the Convex dashboard>
```

Generate a session secret with `openssl rand -hex 32`. Never prefix these variables with `NEXT_PUBLIC_`. Changing the password or secret invalidates existing sessions. `ADMIN_ORIGIN` must exactly match the origin used to visit the panel (no trailing slash); set it when using a reverse proxy. Use HTTPS in production.

### Deploying the Convex functions

Anything under `convex/` runs on Convex, not on Vercel, and a `git push` does not carry it there. The build command in `vercel.json` therefore deploys both halves together:

```text
npx convex deploy --cmd 'npm run build'
```

This pushes the functions and schema, then runs the Next build against the deployment it just wrote, so the two always match. It needs `CONVEX_DEPLOY_KEY` in the Vercel environment; generate one in the Convex dashboard under Settings -> Deploy keys.

Deploying the two halves separately is what breaks quietly: the storefront reads through `lib/convex.ts`, which falls back to an empty result whenever a query is missing or fails. A page that calls a function the deployment does not have yet renders as "no data" rather than as an error, so a half-deploy looks like a feature that was never built.

Vercel saves require Convex and local uploads are disabled there. Upload videos/images to Shopify Files or your media host and paste their HTTPS URLs. Convex holds the content document, not video files. An empty namespace starts with the bundled demo reviews; to migrate local content, paste `.whaleora/reviews.json` into a `content` row with that `namespace` before editing on the new host. Take a backup first. Keep preview and production namespaces separate — they are rows in the same table, so a shared name means one environment overwrites the other.

The content document is a single row in the Convex `content` table, written through `convex/content.ts`. Convex mutations are transactional, so the revision check that detects concurrent edits is an ordinary read-compare-write. The `save` mutation is guarded by `ORDERS_INGEST_SECRET`, which must match between the Next.js server and the Convex deployment — a Convex mutation is otherwise callable by anyone holding the deployment URL. If storage is unavailable, the public storefront falls back to bundled demos and the admin refuses to save; errors do not overwrite saved content.

For a self-hosted Node server, a persistent private `CONTENT_DATA_DIR` can be used instead of Convex. Use one server process and back up both credentials and content. Configure the password and session secret through environment variables in production.

## Customer review photos

Reviews carry up to four photos each, uploaded from the review form to [UploadThing](https://uploadthing.com) — Vercel has no writable disk, so the local `/api/media/…` uploads the studio uses are unavailable there.

To turn it on, create an app in the UploadThing dashboard, copy its token, and set `UPLOADTHING_TOKEN` in the environment (and in `.env.local` for development). Nothing else needs configuring: `app/api/uploadthing/route.ts` picks the token up, and the review form shows its photo picker only when the variable is set — with it unset the form works exactly as it did before, minus the picker.

The limits live in `app/api/uploadthing/core.ts`: images only, 4 MB each, four per review, and the browser must be on this store's own origin. `ADMIN_ORIGIN` is the origin checked when it is set; otherwise the request's own `Host` is. Convex stores only URLs on UploadThing's hosts (`utfs.io` and `<appId>.ufs.sh`), which are also the only hosts `next/image` will optimise a review photo from — `lib/images.ts`, `next.config.ts` and `convex/reviews.ts` each hold a copy of that list, so change them together.

Photos publish with the review, on the same terms: immediately unless the abuse filter holds it. They appear in the moderation queue at `/admin` → Customer reviews, where taking the review down hides them. Taking a review down does not delete the file from UploadThing; remove it there if it has to go.

A product page shows the average rating, the 5-to-1 spread and the newest customer photos above its reviews, and a compact rating under the product title. Only customer reviews with a rating count towards it — the editorial quotes from the studio carry no rating and are excluded on purpose.

## Checks

For an isolated end-to-end run: create a temporary directory with `mktemp -d`, then start `CONTENT_DATA_DIR=<that-directory> NEXT_DIST_DIR=.next-admin-test npm run dev -- --port 3002`. Visit `http://localhost:3002/admin` and set the test-only password `Whaleora-test-only-2026!`. Run `ADMIN_ISOLATED_TEST=1 node tests/admin-integration.mjs`. Never use this test password for your actual store. The test exercises publish/save, authentication, CSRF, conflict detection, uploads, ranges and rate limits against port 3002 only.

`npm run lint` and `npx tsc --noEmit` check the implementation. `node --experimental-strip-types --test tests/content.test.mjs` validates content input. The admin APIs enforce session authentication, same-origin mutations, request size limits and login throttling. This is a single-admin content editor, not a multi-user role-management system.
