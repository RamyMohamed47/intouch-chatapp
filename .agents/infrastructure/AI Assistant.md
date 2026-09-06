# Echo AI Assistant

Echo is InTouch's optional interactive Gemini assistant. It is deliberately
separate from durable background jobs: authenticated HTTP requests retrieve
authorized context and stream model output to the requesting browser over SSE.
Closing the response aborts provider generation and releases its concurrency
lease.

## Data Boundaries

- The API key is server-only.
- Owners enable AI for one versioned data-use disclosure.
- Every member separately accepts that disclosure and may revoke consent.
- Conversation context uses the existing access-scope service.
- Organization retrieval searches accessible public text channels only.
- Draft transformations send only the submitted draft.
- Prompt text, generated output, and retrieved excerpts are not persisted or
  logged.
- A bounded secret redactor runs over workspace excerpts before provider use,
  but it does not replace access control or user disclosure.

## Runtime Configuration

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side-key>
GEMINI_MODEL=gemini-3.8-flash
GEMINI_SERVICE_TIER=free
AI_DAILY_USER_REQUESTS=25
AI_DAILY_ORGANIZATION_REQUESTS=200
AI_MAX_CONCURRENT_REQUESTS=4
```

Use `AI_PROVIDER=disabled` when the integration should not be available. In
production, the model and service tier must be explicit. No frontend variable,
webhook, migration, or separate worker service is required.

## Runtime State

Redis atomically enforces daily user and organization request limits plus a
global concurrent-generation ceiling across API replicas. Daily counters expire
at the next UTC boundary. Concurrency leases expire defensively after 90 seconds
and are released when generation completes, fails, or is aborted. Provider or
Redis failures affect AI requests without weakening workspace authorization.

## Observability

Metrics contain only bounded task, scope, provider, model, and outcome labels,
plus aggregate durations, context sizes, source counts, and token counts. They
must never include prompts, output, excerpts, user IDs, organization IDs, API
keys, or source content. Operational provider failures are sanitized before
logging and client delivery.
