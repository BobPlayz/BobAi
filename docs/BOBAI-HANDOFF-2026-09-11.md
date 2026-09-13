# BobAI handoff — 2026-09-13

BobAI now presents one user-facing native model rather than separate named model personalities. The same model is the central decision-maker for chat and tool selection, while the tool registry remains a separate policy boundary that validates requested tools, arguments, permissions, approvals, and bounded call counts.

The repository contains the central model tool-decision layer and fail-closed tests. Actual verified execution adapters for every registered tool, result feedback into a multi-step model/tool loop, real unified-model training, final datasets, hardware/native-media builds, live production transport/database wiring, external security testing, multi-worker target-environment verification, and final release validation remain environment-dependent and are not claimed complete.

Future changes must inspect the current main branch first and update roadmap.md and this handoff together. Never invent files, features, test results, model quality, or environment results.
