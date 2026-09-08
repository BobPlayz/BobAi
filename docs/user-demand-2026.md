# BobAI user-demand matrix 2026

Updated: 2026-09-08

This is a synthesized product-priority list, not a claim that one survey ranked all 100 items exactly. It combines current user research from Kantar, Google/Kantar India, Pew, Google/Ipsos, and current assistant product patterns. Kantar reports speed as the most valued assistant function (61%), creative ideation second, and strong demand for decision support, budgeting, travel and recommendations. Google/Kantar India reports strong demand for productivity (72%), creativity (77%), communication (73%), time savings (76%) and everyday creativity (84%). Pew's 2026 U.S. survey shows information search and work tasks as leading chatbot uses. Privacy, transparency, control and human oversight repeatedly appear as trust requirements.

## Status legend

- **READY**: BobAI already has the repository capability or a safe implementation path.
- **PARTIAL**: repository groundwork exists but needs completion/provider/environment work.
- **BLOCKED**: requires a real external provider, account, deployment, hardware, or other environment dependency.
- **PRODUCT**: needs a deliberate product/UX decision rather than backend code alone.

## Top 100 user needs and BobAI fit

### Core intelligence

1. Fast answers — READY — model routing and local Ollama support.
2. Accurate answers — PARTIAL — needs stronger verification/evaluation loops.
3. Up-to-date information — PARTIAL — research bridge exists; provider still required.
4. Clear explanations — READY — core chat.
5. Concise answers — READY — prompt behavior.
6. Detailed answers when requested — READY — core chat.
7. Strong reasoning — READY/PARTIAL — Qwen routing exists; quality depends on model.
8. Long-context work — PARTIAL — needs explicit context/token budgeting.
9. Reliable follow-up questions — READY — conversation state exists.
10. Admit uncertainty instead of hallucinating — PARTIAL — needs verification policy/evals.

### Memory and personalization

11. Remember useful preferences — READY — memory storage exists.
12. Remember ongoing goals — READY — memory foundation exists.
13. Project-specific memory — PARTIAL — projects exist; retrieval needs completion.
14. User-controlled memory — READY — memory read/write/clear routes exist.
15. Forget/delete individual memories — READY/PARTIAL — deletion path exists; lifecycle needs more coverage.
16. Memory search — PARTIAL — semantic retrieval still needed.
17. Relevant memory only — PARTIAL — relevance scoring needed.
18. Recency-aware memory — PARTIAL — weighting needed.
19. Sensitive-memory controls — PARTIAL — policy/classification needs expansion.
20. Cross-device continuity — PARTIAL — server persistence exists; conflict reconciliation remains.

### Research and knowledge

21. Web search — PARTIAL — provider-agnostic bridge exists.
22. Deep research — PARTIAL — route exists; real provider/citation pipeline remains.
23. Multiple sources — PARTIAL — depends on research provider.
24. Inline citations — PARTIAL — citation model still needed.
25. Source links — PARTIAL — research schema needs stable source metadata.
26. Source deduplication — PARTIAL — normalization/ranking needed.
27. Source quality signals — PARTIAL — ranking layer needed.
28. Research summaries — READY/PARTIAL — synthesis exists once sources are available.
29. Compare sources — PARTIAL — needs stable source schema.
30. Research from user files + web — PARTIAL — file and research foundations exist separately.

### Files and knowledge bases

31. PDF analysis — READY.
32. Document summarization — READY/PARTIAL.
33. Spreadsheet analysis — PARTIAL — extraction/analysis needs expansion.
34. CSV analysis — READY/PARTIAL.
35. Image understanding — PARTIAL — Ollama vision bridge + Violet.
36. OCR — PARTIAL — Tesseract dependency exists; execution pipeline remains.
37. Large-document processing — PARTIAL — worker/chunking needed.
38. File search — PARTIAL — indexing/retrieval needed.
39. Semantic RAG — PARTIAL — pgvector groundwork exists; ingestion/retrieval needed.
40. Durable file storage — BLOCKED — R2/S3 credentials/deployment required.

### Creation

41. Writing and rewriting — READY.
42. Brainstorming — READY.
43. Summaries — READY.
44. Presentations — PARTIAL — generation workflow/UI needs completion.
45. Tables — READY.
46. Reports — PARTIAL — structured report pipeline can be expanded.
47. Diagrams — PARTIAL — capability groundwork exists.
48. Images — PARTIAL — image route/provider abstraction exists.
49. Image editing — BLOCKED/PARTIAL — external provider needed.
50. Image upscaling — BLOCKED — provider needed.

### Multimodal

51. Screenshot analysis — PARTIAL — Violet + vision model.
52. Exact pixel/color analysis — READY for supported PNGs through Violet.
53. Visual UI critique — PARTIAL — Violet can analyze screenshots.
54. Image-to-code — PARTIAL — Violet + coding agents, model/provider dependent.
55. Voice input — PARTIAL — provider needed.
56. Voice output — PARTIAL — provider needed.
57. Speech transcription — PARTIAL — provider needed.
58. Live camera understanding — BLOCKED — client/device implementation required.
59. Screen sharing analysis — BLOCKED — client/device implementation required.
60. Video understanding — PARTIAL — provider pipeline needed.

### Coding and building

61. Code generation — READY/PARTIAL — Ben + coding bridge.
62. Code explanation — READY.
63. Debugging — READY/PARTIAL — depends on safe coding workspace.
64. Refactoring — READY/PARTIAL.
65. Code review — READY — Ryan role exists.
66. Security review — READY/PARTIAL — Ryan/security capability exists; sandbox remains.
67. Test generation — PARTIAL.
68. Run tests and repair failures — PARTIAL — requires secure execution environment.
69. Screenshot-driven frontend implementation — PARTIAL — Violet + Ben.
70. Full app generation — PARTIAL — coding-agent sandbox required.

### Agents and action

71. One assistant that coordinates specialists — READY — Bob manager architecture.
72. Planner agent — READY — Alex.
73. Coding agent — READY/PARTIAL — Ben.
74. Review agent — READY/PARTIAL — Ryan.
75. Vision agent — READY/PARTIAL — Violet + configured vision model.
76. Background jobs — READY/PARTIAL — queue and recovery groundwork.
77. Long-running agent tasks — PARTIAL — durable execution/sandbox needed.
78. Task cancellation — PARTIAL.
79. Checkpoints and rollback — PARTIAL.
80. Safe approvals before risky actions — PARTIAL/READY — approval groundwork exists; more tool coverage needed.

### Productivity and everyday help

81. Planning — READY.
82. To-do/task management — PARTIAL — workflow/automation layer needed.
83. Recurring reminders — PARTIAL — automation worker needed.
84. Travel planning — PARTIAL — research/provider + optional maps integration.
85. Budgeting help — READY as informational assistance; external financial actions should require integrations and approval.
86. Shopping comparison — PARTIAL — search/product integrations needed.
87. Decision support — READY/PARTIAL — reasoning exists; source-backed workflows improve trust.
88. Learning/study help — READY/PARTIAL.
89. Personalized study plans — PARTIAL — workflow/persistence can be expanded.
90. Creative idea generation — READY.

### Trust, control and platform quality

91. Strong privacy controls — PARTIAL — security foundation exists; privacy UX/policy remains.
92. Transparent data usage — PARTIAL — requires product/legal UX and disclosures.
93. User control over connected data — PARTIAL — integrations permission layer needed.
94. Confirmation before consequential actions — PARTIAL — approval system needs wider tool coverage.
95. Audit history — READY/PARTIAL — audit system exists; coverage needs expansion.
96. Account export — PARTIAL — export must cover all owned data.
97. Permanent account deletion — READY/PARTIAL — deletion implementation exists; worker/verification remains.
98. Fast, resilient service — PARTIAL — distributed rate limiting, monitoring and provider resilience remain.
99. Offline/reconnect reliability — PARTIAL — local fallback exists; reconciliation remains.
100. Cross-platform continuity — PARTIAL — backend foundation exists; mobile/desktop clients and sync remain.

## What the research says matters most

- Speed is the strongest broad preference found in Kantar's 10-country study: 61% selected quick answers as the most useful feature. Creative ideation was second. Kantar also found demand for better decisions (45%), financial planning/budgeting (42%), travel (36%) and entertainment recommendations (33%).
- In Google's 2025 India/Kantar study, 72% wanted more productivity, 77% more creativity, 73% better communication, and 76% wanted to save time on everyday tasks. 84% wanted more creativity in everyday tasks.
- Pew's 2026 U.S. survey found information search (42%) and work tasks (38%) among the leading chatbot uses, followed by fun/entertainment (25%) and image/video creation or editing (24%).
- Trust is not optional. Research from Google and other surveys points to privacy, transparency, user control and understandable security practices as important conditions for continued use.

## BobAI implementation priority

### P0: build now in repository

1. Stream memory/context consistently.
2. Complete server-side conversation search and pagination.
3. Add durable message state for completed, cancelled and failed streams.
4. Finish semantic memory retrieval, deduplication and recency scoring.
5. Finish file chunking/indexing/RAG interfaces.
6. Expand citation/source normalization around research.
7. Complete Bob → Alex/Ben/Ryan/Violet orchestration and visible task state.
8. Expand approval/audit coverage to every consequential tool.
9. Add stronger account export/delete coverage.
10. Add automated regression/evaluation coverage for accuracy, hallucination and security.

### P1: requires a real provider/environment

11. Hosted inference fallback.
12. Search provider.
13. Durable object storage.
14. Production voice/transcription.
15. Production image/video/music providers.
16. Distributed rate limiting and monitoring infrastructure.
17. Production coding sandbox.
18. Production mobile/live-camera clients.

### P2: product expansion

19. Connected apps and write actions.
20. Scheduled automations.
21. Rich canvas/workspaces.
22. Cross-device sync.
23. Sharing/collaboration.
24. Shopping/travel integrations.
25. Audio overviews and richer multimodal experiences.

Nothing in this matrix is marked READY merely because a route or placeholder exists. Provider-dependent features remain PARTIAL/BLOCKED until the real dependency is configured and verified.
