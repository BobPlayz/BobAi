# BobAI Architecture & Development Context

This file is the single architectural source of truth for BobAI.

Cline and Qwen must read this file before making significant architectural changes.

Do not assume that future architecture described here already exists. Always inspect the actual repository and current implementation before changing code.

---

## PROJECT IDENTITY

Project name:

BobAI

BobAI is a standalone AI platform.

BobAI is intended to eventually power:

- BobAI Web
- BobAI Mobile
- BobAI Desktop
- BobBot
- Public API
- Third-party integrations
- AI agents
- Future BobAI products

BobAI is NOT a Discord bot.

BobBot is a client of BobAI.

The fundamental relationship is:

BobBot
  ↓
BobAI API
  ↓
BobAI Core
  ↓
Models / Tools / Memory / Storage

BobAI must work independently of Discord and BobBot.

---

## CORE ARCHITECTURAL PRINCIPLES

1. BobAI is the platform.
2. BobBot is only a client.
3. Discord-specific logic belongs in BobBot, never in BobAI core.
4. BobAI must not depend on Discord.
5. Web, mobile, desktop, and BobBot should use the same BobAI API.
6. AI providers must be abstracted behind provider interfaces.
7. Tools must be abstracted behind controlled interfaces.
8. Permanent application data belongs in PostgreSQL.
9. Vector data belongs in pgvector.
10. Temporary/high-speed state belongs in Redis.
11. Secrets must never be hardcoded.
12. Never commit real API keys or credentials.
13. User input is untrusted.
14. Uploaded files are untrusted.
15. Model output is untrusted.
16. External API responses are untrusted.
17. Existing working functionality must not be casually broken.
18. Do not rewrite the architecture unnecessarily.
19. Do not introduce dependencies without a real reason.
20. Prefer simple, maintainable TypeScript.
21. Avoid unnecessary abstraction.
22. Keep business logic out of route handlers when it can live in reusable services.
23. Features should work end-to-end instead of being permanently mocked.
24. Do not pretend unfinished functionality is complete.
25. Inspect the existing code before changing it.
26. Preserve existing APIs unless there is a deliberate migration.
27. Prefer backwards-compatible changes.
28. Keep BobAI provider-agnostic.
29. Keep BobAI client-agnostic.
30. Keep BobAI extensible for future AI capabilities.

---

## HIGH-LEVEL ARCHITECTURE

The intended architecture is:

Clients:

BobAI Web
BobAI Mobile
BobAI Desktop
BobBot
External API Clients

all communicate with:

BobAI API

which communicates with:

BobAI Core

which communicates with:

Model Providers
Tool Providers
Storage Systems

Conceptually:

Clients
  ↓
BobAI API
  ↓
Authentication / Authorization
  ↓
Chat / Conversation Services
  ↓
BobAI Core
  ↓
Context / Memory / Personality / Tools / Models
  ↓
Providers
  ↓
Storage

---

## CLIENTS

### BobAI Web

The web application is a client of BobAI.

It must communicate through the BobAI API.

The browser must never directly access:

- PostgreSQL
- Redis
- private API keys
- internal model credentials
- internal services
- private infrastructure

Correct:

Browser
  ↓
BobAI API
  ↓
Backend

Incorrect:

Browser
  ↓
Database

---

### BobAI Mobile

Future mobile application.

Potential stack:

- React Native
- Expo
- TypeScript

It should use the same BobAI API as the web application.

There should not be a separate AI backend specifically for mobile.

---

### BobAI Desktop

Future desktop application.

Potential technologies:

- Electron
- Tauri

It should use the same BobAI API.

Desktop may eventually have additional local capabilities such as:

- local files
- local code
- terminal access
- desktop automation
- local model execution

Local capabilities must be permission-controlled.

---

### BobBot

BobBot is a BobAI client.

Architecture:

Discord
  ↓
BobBot
  ↓
HTTP / HTTPS
  ↓
BobAI API
  ↓
BobAI Core
  ↓
BobAI API
  ↓
BobBot
  ↓
Discord

BobAI must never contain Discord-specific entities such as:

DiscordGuild
DiscordChannel
DiscordMessage
DiscordInteraction

BobBot translates Discord concepts into BobAI concepts.

Example:

Discord User
  ↓
BobBot mapping
  ↓
BobAI User

Discord Channel
  ↓
BobBot mapping
  ↓
BobAI Conversation

BobBot should contain only Discord-side logic and client-specific behavior.

---

## MONOREPO

BobAI uses a monorepo.

Current known structure:

BobAI/
  apps/
    api/
    web/

  packages/
    db/

  package.json
  turbo.json
  tsconfig.json
  BOBAI_AGENT_RULES.md
  ARCHITECTURE.md
  ROADMAP.md
  .env.example

Potential future structure:

BobAI/
  apps/
    api/
    web/
    mobile/
    desktop/

  packages/
    core/
    ai/
    db/
    memory/
    tools/
    agents/
    config/
    types/

  docs/
  scripts/

  BOBAI_AGENT_RULES.md
  ARCHITECTURE.md
  ROADMAP.md
  package.json
  turbo.json
  tsconfig.json
  .env.example

Do not create every future directory immediately.

Create packages only when their functionality is needed.

---

## BOBIA API

Location:

apps/api

The API is the main backend entry point.

Technology:

- Node.js
- TypeScript
- Express

Responsibilities:

- authentication
- authorization
- request validation
- chat
- conversations
- messages
- users
- memory
- files
- models
- tools
- agents
- usage
- streaming
- rate limiting
- API keys

The API should be relatively thin.

Routes should call services/core functionality rather than containing huge amounts of business logic.

---

## API ROUTES

The API should eventually use versioned routes.

Planned structure:

/v1/auth
/v1/users
/v1/chat
/v1/conversations
/v1/messages
/v1/memory
/v1/models
/v1/files
/v1/tools
/v1/agents
/v1/usage

Public clients should use versioned APIs.

Do not randomly change existing routes if existing clients depend on them.

When changing an API contract, consider backwards compatibility.

---

## AUTHENTICATION

Authentication should eventually support:

- account creation
- login
- logout
- sessions
- password hashing
- password reset
- email verification
- API keys
- device sessions

Passwords must never be stored in plaintext.

Authentication answers:

"who is this?"

Authorization answers:

"is this user allowed to access this?"

Basic flow:

Client
  ↓
Authentication
  ↓
Identity
  ↓
Session
  ↓
Authenticated Request
  ↓
Authorization
  ↓
Resource

---

## AUTHORIZATION

User-owned resources must have ownership or permission checks.

Potential user-owned resources:

- conversations
- messages
- memories
- files
- projects
- agents
- agent runs
- API keys
- settings

Never assume that knowing an ID gives access to a resource.

The server must verify ownership or permission.

---

## CORE AI ENGINE

The AI engine is the heart of BobAI.

It should not depend directly on Express.

Conceptually:

Chat Request
  ↓
Context Engine
  ↓
Memory Retrieval
  ↓
Personality
  ↓
Tool Planning
  ↓
Model Router
  ↓
AI Model
  ↓
Response Processing
  ↓
Memory Processing
  ↓
Final Response

The core should be reusable by:

- API
- BobBot
- Web
- Mobile
- Desktop
- Agents
- Background workers
- Future integrations

---

## CHAT ENGINE

The chat engine handles normal conversations.

Responsibilities:

- receive messages
- validate messages
- authenticate requests
- load conversations
- retrieve relevant memory
- build context
- select models
- execute tools when required
- stream responses
- save messages
- update conversation state
- trigger memory processing

Basic conceptual flow:

User Message
  ↓
Validation
  ↓
Authentication
  ↓
Conversation
  ↓
Memory
  ↓
Context
  ↓
Model
  ↓
Tools if required
  ↓
Response
  ↓
Persistence
  ↓
Memory Processing

---

## CONTEXT ENGINE

The context engine builds the information given to the model.

Possible context:

- system instructions
- BobAI personality
- user preferences
- custom instructions
- project context
- conversation history
- relevant memories
- tool definitions
- tool results
- current user message

The context engine must respect the model's context window.

Do not blindly send the entire lifetime conversation to every model request.

Older conversations may need:

- summarization
- compression
- selective retrieval
- pruning

---

## PERSONALITY ENGINE

BobAI should support configurable personality.

Personality context may be built from:

Base Personality
  +
User Preferences
  +
Custom Instructions
  +
Conversation Context
  ↓
Final Personality Context

Potential settings:

- tone
- verbosity
- creativity
- response style
- custom instructions
- preferred name
- behavior preferences

Instruction priority must be respected.

Conceptually:

System Instructions
  >
User Instructions
  >
Conversation Content

Conversation text must not automatically override higher-priority instructions.

BobAI should be capable of having a strong, recognizable conversational personality while remaining configurable.

---

## MODEL PROVIDERS

BobAI must support multiple model providers.

Potential providers:

- OpenAI
- Anthropic
- Google
- Ollama
- local models
- future providers

Do not hardcode the application around one provider.

Conceptual interface:

ModelProvider

  chat()
  stream()
  embed()
  listModels()

Different providers may expose different capabilities.

The system should detect capabilities instead of assuming all models support everything.

---

## MODEL CAPABILITIES

Potential capabilities:

- chat
- streaming
- vision
- audio
- image generation
- embeddings
- tool use
- structured output
- reasoning

Example:

Model A:
  chat
  streaming
  tool use

Model B:
  chat
  vision
  streaming
  reasoning

BobAI should adapt to available capabilities.

---

## MODEL ROUTER

The model router determines which model should handle a request.

Possible factors:

- user-selected model
- task type
- capabilities
- model availability
- speed
- cost
- context length
- local/cloud preference
- provider availability
- fallback configuration

Conceptual behavior:

User Request
  ↓
Model Router
  ├── coding → coding model
  ├── reasoning → reasoning model
  ├── fast chat → fast model
  ├── vision → vision model
  ├── image → image model
  └── default → default model

Fallback support:

Primary Model
  ↓
Failure
  ↓
Fallback Model

The router must not assume a provider is permanently available.

---

## MEMORY

BobAI should support multiple memory layers.

### Short-term memory

Current conversation context.

Conversation
  ↓
Recent Messages

### Conversation memory

Important information specific to a conversation.

Conversation
  ↓
Important Facts

### User memory

Long-term information that is useful across conversations.

Examples:

- preferences
- recurring projects
- stable settings
- useful non-sensitive context

Do not store sensitive information unnecessarily.

### Project memory

Information related to a project.

Example:

Project
  ├── Architecture
  ├── Decisions
  ├── Preferences
  └── Technical Context

---

## MEMORY PIPELINE

Memory processing:

Conversation
  ↓
Memory Candidate Extraction
  ↓
Importance / Relevance Check
  ↓
Permission / Safety Check
  ↓
Memory Storage
  ↓
Embedding
  ↓
Vector Storage

Memory retrieval:

User Message
  ↓
Memory Search
  ↓
Relevant Memories
  ↓
Context Engine
  ↓
Model

Memory should eventually be:

- inspectable
- editable
- deletable
- user-controllable

BobAI must not blindly remember everything.

---

## DATABASE

PostgreSQL is the primary permanent database.

Potential entities:

- users
- sessions
- conversations
- messages
- memories
- memory embeddings
- models
- providers
- files
- projects
- tools
- agents
- agent runs
- API keys
- usage
- settings

The actual schema should evolve with implementation.

Do not create database tables for hypothetical features unless needed.

---

## DRIZZLE ORM

Database access should use Drizzle ORM.

Responsibilities:

- schema definitions
- migrations
- typed queries
- relations
- database type safety

Prefer typed Drizzle queries.

Use raw SQL only when there is a real technical reason.

Database schema changes must be version controlled.

---

## PGVECTOR

pgvector is used for semantic/vector search.

Potential uses:

- memory retrieval
- document search
- file search
- semantic conversation search
- project knowledge
- RAG
- future knowledge systems

Conceptual flow:

Text
  ↓
Embedding Model
  ↓
Vector
  ↓
pgvector

Search:

Query
  ↓
Embedding
  ↓
Vector Search
  ↓
Relevant Results
  ↓
Context

---

## REDIS

Redis handles temporary and high-speed state.

Potential uses:

- caching
- sessions
- rate limiting
- queues
- temporary agent state
- streaming state
- distributed locks

Redis is not the primary permanent database.

Permanent data belongs in PostgreSQL.

---

## FILE STORAGE

Files should generally not be stored directly inside PostgreSQL.

Conceptual architecture:

User
  ↓
Upload API
  ↓
Validation
  ↓
Object Storage
  ↓
File Metadata → PostgreSQL

Possible metadata:

- fileId
- userId
- filename
- mimeType
- size
- storageKey
- createdAt

Future processing:

Upload
  ↓
Storage
  ↓
Background Worker
  ↓
Extraction
  ↓
Chunking
  ↓
Embeddings
  ↓
pgvector

---

## FILE ANALYSIS

BobAI should eventually support:

- text files
- PDFs
- documents
- spreadsheets
- images
- source code
- structured data

Uploaded files must be treated as untrusted.

File processing must validate:

- file type
- file size
- content
- permissions
- processing limits

---

## TOOLS

Tools allow BobAI to interact with external systems.

Potential tools:

- Web Search
- File Reader
- File Analyzer
- Code Execution
- Image Generation
- Voice
- Calculator
- External APIs
- Database Tools
- GitHub
- Other integrations

Conceptual tool interface:

Tool
  ├── name
  ├── description
  ├── inputSchema
  └── execute()

Tools must have controlled permissions.

---

## TOOL PERMISSIONS

Tools must not automatically receive unlimited access.

Conceptual permission levels:

- none
- ask
- allowed

Potentially dangerous or externally impactful operations should require appropriate approval.

Conceptual flow:

User
  ↓
AI
  ↓
Permission Check
  ↓
Tool
  ↓
Execution
  ↓
Result
  ↓
AI

---

## WEB SEARCH

Web search is a tool.

Conceptual flow:

User Question
  ↓
AI
  ↓
Determine whether current web information is required
  ↓
Web Search Tool
  ↓
Search Provider
  ↓
Results
  ↓
AI
  ↓
Answer

Search results should be provided to the model as structured information.

---

## CODE EXECUTION

Code execution is a high-risk capability.

Never execute arbitrary model-generated code directly inside the main BobAI API process.

Future architecture:

AI
  ↓
Code Execution Tool
  ↓
Sandbox
  ↓
Isolated Runtime
  ↓
Result
  ↓
AI

The sandbox should eventually enforce:

- CPU limits
- memory limits
- execution time limits
- filesystem restrictions
- network restrictions
- process isolation
- cleanup

---

## AGENTS

Agents are multi-step AI workflows.

Conceptual flow:

User Goal
  ↓
Agent
  ↓
Planner
  ↓
Task
  ↓
Tool
  ↓
Result
  ↓
Planner
  ↓
Next Task
  ↓
...
  ↓
Final Result

Agents should have:

- goals
- state
- tools
- permissions
- limits
- timeouts
- execution history

Agents must not have unrestricted capabilities.

---

## AGENT STATE

Agent runs should eventually be persisted.

Potential fields:

- agentRunId
- userId
- agentId
- status
- currentStep
- tasks
- toolCalls
- results
- createdAt
- updatedAt

Potential statuses:

- queued
- running
- waiting
- completed
- failed
- cancelled

---

## BACKGROUND WORKERS

Long-running operations should not block the main API.

Potential jobs:

- file processing
- embeddings
- memory processing
- agent execution
- document indexing
- notifications
- scheduled tasks
- other asynchronous operations

Conceptual architecture:

API
  ↓
Queue
  ↓
Worker
  ↓
Job
  ↓
Database / Storage

Redis may be used for queue infrastructure.

---

## STREAMING

AI responses should support streaming.

Conceptual flow:

Client
  ↓
API
  ↓
AI Model
  ↓
Token Stream
  ↓
API
  ↓
Client

Possible technologies:

- Server-Sent Events
- WebSockets
- streaming HTTP

Use the simplest reliable option appropriate for the current implementation.

---

## ERROR HANDLING

Errors should be structured.

Example response shape:

{
  "error": {
    "code": "MODEL_UNAVAILABLE",
    "message": "The selected model is currently unavailable.",
    "requestId": "..."
  }
}

Never expose to normal users:

- database credentials
- API keys
- internal secrets
- stack traces
- private infrastructure details

Internal logs may contain additional debugging information where safe.

---

## LOGGING

Useful backend log fields include:

- requestId
- userId
- route
- method
- status
- duration
- error
- timestamp

Never log:

- passwords
- API keys
- authentication tokens
- private secrets

Logs should be useful for debugging without becoming a privacy risk.

---

## SECURITY

Security must be considered in every feature.

Requirements:

- validate input
- authenticate requests
- authorize resources
- rate limit appropriate endpoints
- protect secrets
- validate uploaded files
- restrict tool access
- isolate code execution
- prevent unauthorized data access
- protect internal services
- use secure transport in production

Never trust:

- user input
- uploaded files
- model output
- external API responses
- tool results
- web content

Treat all of them as untrusted data.

---

## ENVIRONMENT VARIABLES

Secrets belong in environment variables.

Potential variables:

DATABASE_URL=
REDIS_URL=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=

JWT_SECRET=

STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

The actual variables may change.

Never hardcode secrets.

Never commit .env files containing real credentials.

Keep an .env.example file containing placeholders.

---

## REQUEST FLOW

A normal chat request should conceptually work like this:

Client
  ↓
HTTPS
  ↓
API
  ↓
Authentication
  ↓
Authorization
  ↓
Validation
  ↓
Conversation Service
  ↓
Memory Service
  ↓
Context Engine
  ↓
Personality Engine
  ↓
Model Router
  ↓
AI Provider
  ↓
Tool Calls if needed
  ↓
Response
  ↓
Memory Processing
  ↓
PostgreSQL
  ↓
Streaming / Final Response
  ↓
Client

---

## EXAMPLE CHAT

Example request:

User:
"remember that i'm building bobai"

Conceptual processing:

User Message
  ↓
BobAI Web
  ↓
POST /v1/chat
  ↓
Authentication
  ↓
Conversation Lookup
  ↓
Memory Processing
  ↓
Context Building
  ↓
Model Selection
  ↓
AI Response
  ↓
Memory Candidate Detection
  ↓
Memory Storage
  ↓
PostgreSQL
  ↓
Response Stream
  ↓
BobAI Web

The exact implementation may differ.

---

## API DESIGN PRINCIPLES

API endpoints should:

- validate input
- authenticate
- authorize
- call appropriate services
- return consistent responses
- handle errors safely
- avoid leaking internal implementation details

Route handlers should not become massive files.

Prefer:

Route
  ↓
Controller / Handler
  ↓
Service
  ↓
Core Logic
  ↓
Repository / Provider

when the complexity warrants it.

For small functionality, do not create unnecessary layers just to follow a pattern.

---

## PACKAGE RESPONSIBILITIES

Potential package responsibilities:

### packages/core

Shared BobAI business logic and core abstractions.

Potential contents:

- chat logic
- context handling
- shared interfaces
- common services

### packages/ai

AI provider abstractions and model implementations.

Potential contents:

- provider interface
- model router
- OpenAI provider
- Anthropic provider
- Google provider
- Ollama provider
- local model provider

### packages/db

Database layer.

Potential contents:

- Drizzle schema
- migrations
- database client
- database repositories

### packages/memory

Memory-specific logic.

Potential contents:

- memory extraction
- memory storage
- retrieval
- vector search
- memory ranking

### packages/tools

Tool framework and tool implementations.

Potential contents:

- tool interface
- permissions
- web search
- file tools
- calculators
- integrations

### packages/agents

Agent framework.

Potential contents:

- agent definitions
- planning
- execution
- agent state
- tool orchestration

### packages/config

Shared configuration.

Potential contents:

- environment parsing
- configuration validation
- shared constants

### packages/types

Shared TypeScript types where genuinely useful.

Do not turn this package into a dumping ground for random types.

---

## DEPENDENCY DIRECTION

The architecture should avoid circular dependencies.

Preferred direction:

apps
  ↓
core packages
  ↓
infrastructure packages

For example:

Web
  ↓
API

API
  ↓
Core

Core
  ↓
AI / Memory / Tools

Infrastructure
  ↓
Database / Redis / Providers

Do not create circular dependencies between packages.

---

## DATABASE OWNERSHIP

PostgreSQL owns permanent structured data.

Redis owns temporary/high-speed state.

pgvector owns vector representations/search.

Object storage owns large uploaded files.

Conceptually:

PostgreSQL
  = permanent structured data

Redis
  = temporary/high-speed state

pgvector
  = semantic vector search

Object Storage
  = large files

Do not use the wrong storage system simply because it is convenient.

---

## PERFORMANCE

Performance should matter, but premature optimization should be avoided.

Priorities:

1. Correctness
2. Reliability
3. Security
4. Maintainability
5. Performance
6. Optimization

Optimize actual bottlenecks.

Do not make the architecture complicated just to chase theoretical scale.

---

## SCALABILITY

BobAI should be capable of growing from a personal project into a larger platform.

Future scaling possibilities include:

- multiple API instances
- worker pools
- Redis queues
- database connection pooling
- caching
- object storage
- load balancing
- provider routing
- asynchronous jobs

The initial implementation should remain simple enough to develop quickly.

---

## OBSERVABILITY

Future production infrastructure should support:

- structured logs
- request IDs
- error tracking
- performance monitoring
- worker monitoring
- model usage tracking
- provider failure tracking
- API usage tracking

Observability should help answer:

- what failed?
- where did it fail?
- which user/request was affected?
- which model/provider was involved?
- how long did it take?
- how often is it happening?

---

## USAGE TRACKING

BobAI should eventually track model/API usage.

Potential information:

- user
- model
- provider
- request count
- input tokens
- output tokens
- estimated cost
- latency
- success/failure
- timestamp

This supports:

- user usage limits
- analytics
- provider comparisons
- cost monitoring
- debugging

Do not expose private internal cost information to users unless intentionally designed as a feature.

---

## PROJECTS

BobAI should eventually support projects.

A project can contain:

- conversations
- files
- instructions
- memories
- project settings
- project knowledge
- agents
- tools

Conceptual structure:

Project
  ├── Conversations
  ├── Files
  ├── Memory
  ├── Instructions
  ├── Knowledge
  └── Agents

This allows BobAI to maintain context across long-running projects.

---

## KNOWLEDGE / RAG

BobAI should eventually support retrieval-augmented generation.

Conceptual pipeline:

Documents
  ↓
Extraction
  ↓
Chunking
  ↓
Embeddings
  ↓
pgvector
  ↓
Semantic Search
  ↓
Relevant Chunks
  ↓
Context Engine
  ↓
Model

RAG should be modular rather than deeply coupled to chat.

---

## CUSTOMIZATION

BobAI should eventually allow users to customize:

- personality
- custom instructions
- model
- memory behavior
- response style
- tools
- projects
- agent behavior
- interface preferences

Customization should be stored separately from core system instructions.

---

## MODEL INDEPENDENCE

BobAI must never assume:

"the AI = one specific model."

Instead:

"the AI = an orchestration system capable of using many models."

This allows BobAI to support:

- cloud models
- local models
- free models
- paid models
- specialized models
- future models

A user should eventually be able to change models without rebuilding the application.

---

## LOCAL AI

BobAI should support local model providers where practical.

Ollama may be used as one local provider.

Potential architecture:

BobAI
  ↓
Model Router
  ↓
Ollama
  ↓
Local Model

Local models should be treated as providers, not as the entire BobAI architecture.

---

## CLOUD AI

Cloud providers should also be supported.

Potential architecture:

BobAI
  ↓
Model Router
  ↓
Provider
  ↓
Cloud Model

Provider API keys belong only on the backend.

Never expose provider API keys to the browser.

---

## TOOL EXECUTION SAFETY

Tools should be categorized by risk.

Low-risk examples:

- calculator
- text processing

Moderate-risk examples:

- web search
- file reading

Higher-risk examples:

- code execution
- sending messages
- modifying external systems
- deleting data
- executing commands
- financial or account actions

Higher-risk tools require stronger permission controls.

---

## AGENT SAFETY

Agents must have execution limits.

Potential limits:

- maximum steps
- maximum runtime
- maximum tool calls
- maximum token usage
- maximum cost
- allowed tools
- allowed domains
- allowed files
- allowed actions

An agent should never be allowed to run indefinitely.

---

## TERMINAL / COMPUTER CONTROL

Future BobAI desktop or coding-agent functionality may eventually interact with:

- terminal
- filesystem
- VS Code
- Git
- local projects

Such capabilities must be isolated from the public API by default.

A local coding agent should operate on explicitly selected workspaces.

It should not automatically gain access to arbitrary files on a user's computer.

---

## GITHUB INTEGRATION

GitHub may eventually be supported as an integration.

Potential functionality:

- inspect repositories
- read files
- inspect issues
- inspect pull requests
- create branches
- propose changes
- create commits
- create pull requests

Destructive actions must require appropriate permissions.

GitHub credentials must never be exposed to models unnecessarily.

---

## API KEYS

BobAI may eventually provide API keys to users.

API keys should:

- be securely generated
- be stored securely
- be revocable
- have permissions
- optionally have usage limits
- never be returned unnecessarily

Plaintext secrets should not be stored if a secure hash-based design can be used.

---

## RATE LIMITING

Rate limiting should eventually exist at multiple levels.

Potential levels:

- IP
- user
- API key
- endpoint
- model
- tool
- agent

Expensive operations should have stricter limits.

---

## CACHING

Caching may be used for:

- model metadata
- provider metadata
- frequently requested public information
- expensive repeated operations

Never cache private user data in a way that could allow cross-user leakage.

---

## TESTING

BobAI should eventually have tests for:

- API routes
- authentication
- authorization
- database operations
- model providers
- model routing
- memory
- tools
- agents
- validation
- security-sensitive behavior

Tests should focus especially on critical business logic.

Do not add meaningless tests simply to increase test count.

---

## TYPE SAFETY

TypeScript should be used consistently.

Avoid:

- unnecessary any
- unsafe type casts
- duplicated incompatible types
- hidden runtime assumptions

Shared types should be introduced when genuinely shared.

Do not create giant global type files containing everything.

---

## CODE QUALITY

Code should be:

- readable
- predictable
- maintainable
- modular
- typed
- reasonably concise

Prefer straightforward solutions.

Avoid:

- unnecessary abstraction
- giant functions
- giant route handlers
- duplicated logic
- magic values
- hidden side effects
- unnecessary dependencies

---

## FILE MODIFICATION RULES FOR CODING AGENTS

When Cline or another coding agent works on BobAI:

1. Inspect the repository first.
2. Understand the existing implementation.
3. Do not assume a feature exists because it is described in this document.
4. Preserve working functionality.
5. Follow existing conventions when they are reasonable.
6. Avoid unrelated refactors.
7. Do not rewrite entire systems without a strong reason.
8. Keep changes focused on the requested feature.
9. Update documentation when architecture meaningfully changes.
10. Test the affected functionality.
11. Fix TypeScript errors introduced by the change.
12. Do not leave obvious placeholder implementations unless explicitly requested.
13. Do not silently remove functionality.
14. Do not introduce Firebase.
15. Do not hardcode credentials.
16. Do not expose secrets.
17. Do not create duplicate systems when an existing one can be extended.

---

## IMPLEMENTATION PRIORITY

When implementing a feature, prefer this order:

1. Understand the current code.
2. Identify the smallest correct architectural change.
3. Implement the core functionality.
4. Connect it to the API if required.
5. Connect the client if required.
6. Validate the complete flow.
7. Fix errors.
8. Clean up only the affected code.
9. Update documentation if needed.

Do not build future infrastructure merely because it is mentioned in this document.

---

## SOURCE OF TRUTH

There are three important project documents:

BOBAI_AGENT_RULES.md
  = coding-agent behavior and project rules

ARCHITECTURE.md
  = technical architecture and system design

ROADMAP.md
  = planned implementation order and features

These documents have different purposes.

Do not mix them unnecessarily.

---

## ARCHITECTURE CHANGE POLICY

If implementation needs to diverge from this architecture:

1. Prefer the simpler solution when the architecture is over-engineered for the current stage.
2. Do not blindly follow outdated documentation.
3. Update ARCHITECTURE.md when a meaningful architectural decision changes.
4. Preserve backwards compatibility where practical.
5. Do not introduce major architectural changes without understanding their impact.

The actual working repository is the implementation source of truth.

This file is the intended architectural direction.

---

## DEVELOPMENT PHILOSOPHY

BobAI should be built as a real product, not as a collection of disconnected demos.

Every major feature should eventually have:

- real backend logic
- real persistence when needed
- real API integration
- real frontend integration when applicable
- real error handling
- appropriate permissions
- appropriate testing
- documentation where necessary

Do not fake functionality indefinitely.

If something is not implemented yet, clearly treat it as future functionality.

---

## LONG-TERM VISION

The final BobAI platform should be capable of:

- natural conversation
- persistent memory
- customizable personality
- multiple AI models
- local AI
- cloud AI
- web search
- file analysis
- image understanding
- image generation
- voice
- coding assistance
- terminal interaction
- project knowledge
- RAG
- autonomous agents
- external integrations
- API access
- multi-device usage
- personalized workflows

The goal is not to make BobAI dependent on one model, one company, one application, or one platform.

The goal is to create a flexible AI platform where models, tools, memory, clients, and integrations can evolve independently.

---

## FINAL ARCHITECTURE SUMMARY

The intended final relationship is:

Clients
  ↓
BobAI API
  ↓
Authentication / Authorization
  ↓
BobAI Core
  ├── Chat Engine
  ├── Context Engine
  ├── Personality Engine
  ├── Memory Engine
  ├── Model Router
  ├── Tool Engine
  └── Agent Engine
  ↓
Providers
  ├── AI Models
  ├── Web
  ├── Files
  ├── Code
  ├── Images
  ├── Voice
  └── External APIs
  ↓
Infrastructure
  ├── PostgreSQL
  ├── pgvector
  ├── Redis
  └── Object Storage

BobBot remains a client.

Discord remains an integration.

AI providers remain replaceable.

Tools remain modular.

Memory remains user-controllable.

The API remains the central interface.

BobAI remains independent, extensible, and model-agnostic.