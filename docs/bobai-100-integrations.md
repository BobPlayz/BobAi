# BobAI: 100 high-value integrations and capability upgrades

This is the 2026 capability map produced during the final-pass audit. `DONE` means the repository now has the corresponding implementation/foundation. `FOUNDATION` means the architecture already contains the safe seam but a real provider or environment is still required. `NEXT` means a concrete follow-up that fits the current architecture without being worth fabricating as a fake integration.

## Security, privacy, and trust
1. DONE - Refresh-token family rotation and reuse detection.
2. DONE - Multipart array-index abuse limits.
3. DONE - Uploaded image/PDF magic-byte validation.
4. DONE - Conversation payload size and message-shape validation.
5. DONE - Expanded account data export.
6. DONE - Sensitive conversation content removed from browser localStorage persistence.
7. DONE - API request and keep-alive timeouts.
8. DONE - Production provider fail-closed behavior.
9. DONE - MFA with encrypted secrets and challenge protection.
10. DONE - Cookie-auth CSRF protection.
11. DONE - Password-change session revocation.
12. DONE - Permanent account-deletion workflow foundation.
13. DONE - Security headers and production HSTS.
14. DONE - Audit metadata sanitization/capping.
15. DONE - Tool/MCP approval records with hashed approval tokens.
16. DONE - Coding-agent sandbox attestation gate.
17. NEXT - Passkeys/WebAuthn.
18. NEXT - Trusted-device management with explicit device revocation.
19. NEXT - User-visible security activity timeline.
20. NEXT - Secret-rotation reminders and expiry warnings.

## Chat, memory, and personalization
21. NEXT - Server-side conversation search with indexed full-text search.
22. NEXT - Cursor pagination for conversation history.
23. NEXT - Per-message edit history.
24. NEXT - Branching conversations.
25. NEXT - Conversation merge/split.
26. NEXT - Conversation folders and labels.
27. NEXT - Archive/trash with restore window.
28. NEXT - User-controlled memory categories.
29. NEXT - Memory confidence and provenance.
30. NEXT - Memory expiry/forget-after date.
31. NEXT - Memory approval queue for sensitive facts.
32. NEXT - Semantic memory retrieval with pgvector.
33. NEXT - Memory conflict detection.
34. NEXT - "Why does Bob remember this?" provenance UI.
35. NEXT - Per-project memory isolation.
36. NEXT - Shared workspace memory with explicit permissions.
37. NEXT - Conversation summaries generated on idle.
38. NEXT - Automatic context compaction with loss checks.
39. NEXT - Long-context budget visualization.
40. NEXT - User-configurable response preferences.

## Research and knowledge
41. FOUNDATION - Provider-neutral web research.
42. FOUNDATION - Browser/research timeout and retry controls.
43. NEXT - Citation normalization and source deduplication.
44. NEXT - Source credibility metadata.
45. NEXT - Research session replay.
46. NEXT - Saved research collections.
47. NEXT - Claim-to-source mapping.
48. NEXT - Contradiction detection across sources.
49. NEXT - Follow-up research plans.
50. NEXT - Scheduled research briefs.

## Files, RAG, and knowledge bases
51. DONE - Upload size, field, part, and header limits.
52. DONE - File metadata listing/search foundation.
53. NEXT - Durable object storage abstraction.
54. NEXT - Background file extraction jobs.
55. NEXT - File chunking with stable chunk IDs.
56. NEXT - Embedding/indexing pipeline.
57. NEXT - Hybrid lexical + vector retrieval.
58. NEXT - Per-file permissions and share links.
59. NEXT - File version history.
60. NEXT - Malware scanning hook before indexing.

## Bob and employee agents
61. FOUNDATION - Bob as manager/front door.
62. FOUNDATION - Alex planning/research role.
63. FOUNDATION - Ben coding role.
64. FOUNDATION - Ryan review/security role.
65. FOUNDATION - Violet visual coding role.
66. DONE - Workspace authorization before agent task queueing.
67. DONE - Durable agent task persistence/recovery.
68. DONE - Queue concurrency/attempt controls.
69. DONE - Agent mutation audit trail.
70. NEXT - Explicit Bob delegation plans visible to the user.
71. NEXT - Agent handoff artifacts.
72. NEXT - Agent task dependency graphs.
73. NEXT - Agent budget/token accounting.
74. NEXT - Agent confidence and escalation thresholds.
75. NEXT - Human approval checkpoints for risky actions.

## Coding and project work
76. FOUNDATION - Coding-agent localhost bridge with production sandbox gate.
77. NEXT - Real disposable workspace executor.
78. NEXT - Patch preview before application.
79. NEXT - Automatic test/eval selection for patches.
80. NEXT - Dependency-change risk scoring.
81. NEXT - Secret scanning before commit.
82. NEXT - License-policy checks for dependencies.
83. NEXT - Static-analysis result summaries from Ryan.
84. NEXT - Visual regression checks from Violet.
85. NEXT - Rollback to last known-good checkpoint.

## Multimodal and creation
86. FOUNDATION - Vision provider abstraction.
87. FOUNDATION - Image generation provider abstraction.
88. FOUNDATION - Voice provider abstraction.
89. FOUNDATION - Video/media provider seams.
90. NEXT - Unified media asset library.
91. NEXT - Image understanding with OCR/layout extraction.
92. NEXT - Audio transcription and speaker labels.
93. NEXT - Audio summaries and chapter markers.
94. NEXT - Video scene/chapter extraction.
95. NEXT - Cross-modal search across user assets.

## Productivity and external integrations
96. FOUNDATION - Automation capability flagging without fake executors.
97. FOUNDATION - Notification provider seam.
98. NEXT - Calendar read/write integration with approval gates.
99. NEXT - GitHub issue/PR integration with scoped permissions.
100. NEXT - User-defined MCP/connectors registry with per-tool approvals.

## Implementation rule
BobAI must not advertise an item as executable merely because its UI or schema exists. Provider-backed capabilities remain disabled until a real provider, credential, timeout policy, authorization model, and failure path are configured and tested. This prevents the platform from presenting placeholders as working integrations.
