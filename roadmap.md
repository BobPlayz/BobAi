# BobAI roadmap

## Repo-side
- [x] Unified Bob runtime and bounded tool loop
- [x] Input, approval, audit, cancellation, network, provider, media, bundle, result, and agent-plan safeguards
- [x] Repository preflight and CI validation
- [x] Obsolete lockfile write workflows removed
- [x] CI executes the full checked-in API test suite
- [x] Automated lockfile synchronization keeps roadmap and handoff in the same commit
- [x] GitHub Actions model-training dependencies are pinned to immutable action commits
- [x] Lighthouse CI uses a pinned Node runtime and exact CLI version
- [x] Production OAuth redirect base is explicitly validated as HTTPS and canonical
- [x] Malware scanner responses are bounded before parsing
- [x] Backup verification output is bounded
- [x] BobHS durable queue state, payload, result, and error sizes are bounded
- [x] SSRF target checks reject mapped and reserved IP ranges
- [x] Public web metadata includes canonical URLs, Open Graph/Twitter metadata, favicon, and structured application data
- [x] Public sitemap.xml and robots.txt cover public pages and exclude private application routes
- [x] Web app manifest and machine-readable llms.txt are published
- [x] Public landing-page headings and navigation are crawlable and accessible, with contextual tooltips
- [x] FAQ structured data is published from the same public FAQ content
- [x] Distributed rate limiting has a database-backed implementation and is selectable for multi-instance deployments
- [x] Public readiness endpoints avoid exposing deployment capability and model-detail information in production
- [x] Machine-readable product documentation lists the same public pages exposed by the sitemap
- [ ] Verify target-environment BobHS workers
- [ ] Verify real/local providers
- [ ] Final training and model evaluation
- [ ] Real artifact workflow verification
- [ ] Native media build on target Windows

## Environment
- [ ] Production and scale verification
