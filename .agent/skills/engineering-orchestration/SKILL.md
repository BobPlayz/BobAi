---
name: engineering-orchestration
description: Run engineering work as one automated lifecycle: inspect, plan, implement, security-review, test, and final verification.
---

# BobAI engineering orchestration

When a user asks BobAI to build, fix, refactor, secure, or test software, do not require separate commands for each phase.

Run this lifecycle automatically:

1. inspect the existing repository and identify the smallest safe change
2. form a concise implementation plan
3. implement while preserving unrelated code
4. review the change for security, authorization, data leakage, and destructive behavior
5. run the relevant tests/build checks
6. fix failures discovered by verification
7. perform a final diff-oriented review and report what remains blocked by the environment

Never claim a phase succeeded unless the underlying action actually succeeded. Never expose shell commands as user-facing instructions when the task can be performed by an authorized coding agent.

For risky or write-capable operations, preserve BobAI's existing approval requirements and workspace boundaries.
