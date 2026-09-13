# BobAI roadmap

## Repo-side
- [x] Unified Bob runtime and bounded tool loop
- [x] Input, approval, audit, cancellation, network, provider, media, bundle, result, and agent-plan safeguards
- [x] Repository preflight and CI validation
- [x] Obsolete lockfile write workflows removed
- [x] CI executes the full checked-in API test suite
- [x] Automated lockfile synchronization keeps roadmap and handoff in the same commit
- [x] Production OAuth redirect base is explicitly validated as HTTPS and canonical
- [x] Malware scanner responses are bounded before parsing
- [x] Backup verification output is bounded
- [x] BobHS durable queue state, payload, result, and error sizes are bounded
- [x] SSRF target checks reject mapped and reserved IP ranges
- [ ] Verify target-environment BobHS workers
- [ ] Verify real/local providers
- [ ] Final training and model evaluation
- [ ] Real artifact workflow verification
- [ ] Native media build on target Windows

## Environment
- [ ] Production and scale verification
