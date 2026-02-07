# Casa Celaya — Single-property site (ES/EN)

Static site: plain HTML/CSS/vanilla JS.

## Local preview

From the folder `casacelaya/site`, run a tiny static server:

- Python: `python3 -m http.server 5173`
- Node: `npx serve -l 5173`

Then open: `http://localhost:5173/?lang=es` or `http://localhost:5173/?lang=en`

## Content updates (no code)

Edit `content.json`:

- `property.siteUrl`: your real public URL (used for canonical + WhatsApp link)
- `property.shareImageUrl`: absolute URL to the hero image for WhatsApp/Facebook previews
- `property.contact.whatsappNumber`: include country code (Mexico `+52`)
- `property.contact.phoneNumber`: for `tel:` links
- `property.mapEmbedUrl`: Google Maps embed URL (can be approximate)
- `property.downloads`: point to PDFs in `assets/docs/`
- `property.video.src`: optional MP4 in `assets/video/` (leave empty to hide section)
- `property.gallery.categories[*].images[*].src`: image paths in `assets/images/`

Translations:

- Spanish strings live under `es`
- English strings live under `en`

## Photos

Place photos in `assets/images/` and update the paths in `content.json`.

Recommended: use WebP/AVIF when available (manual export is fine). Keep filenames stable.

## Form handling

The form in `index.html` is Netlify Forms compatible (`data-netlify="true"`) and includes a honeypot.

- On Netlify, submissions can be forwarded to email in the dashboard.
- There is a small client-side rate limit (~45s) to reduce spam. For stronger protection, use a serverless endpoint.

## Analytics events

This site fires events via `window.dataLayer` if present (otherwise logs to console):

- `whatsapp_click`
- `call_click`
- `form_submit`
- `video_play`

## Deploy

Any static host works.

- Netlify: drag-and-drop the `site/` folder or connect the repo.
- Cloudflare Pages / GitHub Pages: upload the folder contents.

After deploy: update `robots.txt`, `sitemap.xml`, and `content.json` with the real domain.
