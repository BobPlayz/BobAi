# BobAI handoff — 2026-09-13

BobAI now presents one user-facing native model rather than separate named model personalities. The same model is the central decision-maker for normal chat and tool selection. Tool requests are validated against a separate registry and policy boundary, and coding requests can be dispatched through the existing controlled worker queue.

The repository contains the central model tool-decision layer, chat integration, fail-closed validation, and tests. General verified execution adapters for every registered tool, multi-step tool-result feedback into the same model loop, real unified-model training, final datasets, hardware/native-media builds, live production transport/database wiring, external security testing, multi-worker target-environment verification, and final release validation remain environment-dependent and are not claimed complete.

Future changes must inspect the current main branch first and update roadmap.md and this handoff together. Never invent files, features, test results, model quality, or environment results.
