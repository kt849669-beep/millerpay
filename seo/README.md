# Miller Pay search pages

Canonical origin: https://millerpay-official.website

`site.mjs` owns the default keywords, distinct page titles/descriptions and page
inventory. The static HTML and images here are the public SEO source. Do not edit
the generated `public/` output to make permanent changes. The existing public SEO
pages/assets were carried forward without inspecting application source code.

`scripts/prepare-seo.mjs` runs after the normal app packaging step. It copies only
these public pages/assets, updates the built login **head**, and writes a sitemap
with actual HTML image URLs. It does not change the login body, app JavaScript,
admin assets, backend or authentication. Login content remains controlled by the
existing application. `robots.txt` continues to exclude `/admin` and `/api/`.

All ten requested keyword phrases are included in the default metadata. Relevant
phrases also appear in useful titles, headings, guide content and internal links.
Google does not use the keywords meta tag for ranking; it is retained as requested.
FAQ answers are present in the initial HTML and use native expandable details.

## Media sources checked on 12 October 2026

- Deposit tutorial: https://www.youtube.com/watch?v=QqBBriXMJr0
  by teachnical vgx, published 16 April 2026, 2:51. Embedded on the dedicated
  deposit guide, with matching VideoObject metadata and a link to the source.
- Additional review: https://www.youtube.com/watch?v=HoqemwzEfSE
  by Jasim the great, published 30 April 2026. Linked as an independent review.
- Instagram: https://www.instagram.com/bonehpurang/ — public profile mentions
  Miller Pay, but points to a different domain. Listed as an external reference,
  not as this website's verified identity. No social profile is claimed through
  `sameAs` or `rel=me` without ownership verification.
- Gallery images are the project's existing Miller Pay logo and app screenshots.
  Google Images was checked; unrelated search images were not copied. Screenshots
  are examples, not live rates. Public image files remain crawlable.

## Deployment and Google indexing

1. Connect `millerpay-official.website` to the hosting project and configure its
   DNS and HTTPS certificate before enabling the production migration. On
   12 October 2026 the domain returned a parking-style page pointing to `/lander`,
   not the Miller Pay site. Source changes do not change DNS.
2. Deploy this branch through the normal production process. Public-route host
   redirects send alternate hosted domains, including preview hosts, to the
   canonical domain. Keep previously used domains attached and redirecting for
   at least a year. Admin/API routing is unchanged.
3. Check `/login`, `/miller-pay/`, `/robots.txt`, `/sitemap.xml`, the image gallery
   and the deposit video on the live domain. Confirm public pages return 200,
   redirects resolve correctly, and images are accessible without signing in.
4. Verify the new property in Google Search Console and submit
   `https://millerpay-official.website/sitemap.xml`. Use URL Inspection for the
   landing and important guides. Submit Change of Address for old verified
   properties if applicable. No Search Console submission has been made by
   these scripts; robots.txt advertises the sitemap for discovery.

Indexing, image/video inclusion and ranking remain Google's decisions. This
change does not promise an indexing deadline or search position.

References:

- https://developers.google.com/search/docs/crawling-indexing/special-tags
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
- https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- https://developers.google.com/search/docs/appearance/video
