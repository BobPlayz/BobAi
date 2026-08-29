# BobAI launch checklist

## site

- [x] internal navigation links
- [x] custom 404 page
- [x] breadcrumbs on public content pages
- [x] primary CTA above the fold via the global `Try Bob AI` navigation CTA
- [x] five FAQs
- [x] thank-you page
- [x] accessible image strategy: no raw `<img>` tags are currently present; meaningful future images must include descriptive alt text
- [ ] real user reviews — requires genuine user feedback; no testimonials are fabricated
- [x] unique titles/descriptions for public launch pages
- [x] responsive navigation bar
- [x] analytics consent gate; provider is opt-in and configured through `NEXT_PUBLIC_ANALYTICS_DOMAIN`
- [ ] real team photo — requires an actual approved team photo
- [ ] complete production authorization/RLS audit across every data endpoint
- [x] SEO metadata, sitemap, robots, Open Graph metadata and favicon
- [x] waitlist page UI
- [x] cookie/analytics consent UI
- [x] about page
- [x] contact page UI
- [x] favicon configured from the existing Bob AI icon

## before launch

1. Configure `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SITE_DOMAIN` for the real domain.
2. Configure the analytics provider only if analytics are wanted.
3. Connect the waitlist form to a real persistence/provider endpoint before accepting signups.
4. Configure the real contact destination before advertising the contact page.
5. Add genuine reviews only after receiving them.
6. Add the approved real team photo if BobAI has a team section.
7. Complete the production authorization/RLS review and integration tests.
