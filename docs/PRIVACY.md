# BobAI Privacy Notice

**Status:** product/legal draft. It must be completed and reviewed by qualified counsel before public launch.

## What BobAI processes
Depending on features used, BobAI may process account identifiers, contact details, prompts and conversations, saved memories, uploaded files, agent tasks, generated outputs, settings/preferences, and technical/security information.

BobAI should collect only information reasonably necessary for the requested feature.

## Why we process it
We process data to provide requested AI features, authenticate and secure accounts, store user-created content and memories, execute requested agents/tools, process files, operate integrations, prevent abuse, maintain reliability, and comply with applicable law.

## Model improvement and training
**BobAI must not use a user's conversations or preferences to train or improve Bob's model unless the user has explicitly opted in through a separate, understandable model-training control.** The training control is stored server-side as `modelTraining` and is independent from ordinary service consent.

When model-training opt-in is enabled, the training pipeline must:

- use only data belonging to that opted-in user/workspace;
- exclude secrets, credentials, authentication codes, and other sensitive data;
- minimize or remove direct identifiers before dataset creation;
- keep training data logically separated from production conversation storage;
- record dataset/model versions for provenance;
- honor withdrawal for future collection immediately;
- support deletion of eligible training records when required by the applicable policy/law;
- never treat a user's private conversation as public training data merely because it was sent to BobAI.

A model's weights cannot be assumed to contain or reproduce a particular user's conversation. The production training pipeline must include privacy review and memorization testing before a trained model is deployed.

## Notice and consent
Before collecting or using personal data where notice or consent is required, BobAI must provide a clear, standalone notice describing the data and purposes and provide applicable withdrawal and rights mechanisms.

## User rights
Subject to applicable law, BobAI will provide mechanisms for access, correction, deletion, withdrawal of applicable consent, and grievance handling. Backend authorization must scope these operations to the authenticated user and authorized workspace.

## Security
BobAI uses access controls, rate limiting, security headers, input validation, provider allowlisting/configuration, secret protection, and audit controls. Uploaded files and model/tool inputs are treated as untrusted data.

No system can guarantee absolute security.

## Sharing and processors
BobAI may use infrastructure, database, model, storage, media, communications, and other providers needed to deliver requested features. The production provider inventory must be maintained and reflected here before launch.

## Retention
Retention periods must be documented per data category and implemented in storage and cleanup jobs. The final notice must contain the actual periods selected by the operator.

## Children
BobAI must implement an age/child-data policy appropriate to its target users and applicable law before public launch. Where child-specific consent or safeguards are required, the backend must enforce them.

## Contact and complaints
**Privacy contact:** [insert official privacy contact]

**Operator/Data Fiduciary:** [insert legal entity]

## Legal status
This document is a technical/product privacy draft, not legal advice. Final publication requires jurisdiction-specific legal review.
