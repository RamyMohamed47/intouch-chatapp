```mermaid
sequenceDiagram
    actor User
    participant Client
    participant API
    participant MongoDB
    participant Worker
    participant MailProvider as Mail provider (HTTPS or SMTP)

    User->>Client: Register password account
    Client->>API: POST /auth/register
    API->>MongoDB: Transaction: pending user + verification token + encrypted outbox job
    API-->>Client: 201 verificationRequired=true
    Worker->>MongoDB: Lease committed outbox job
    Worker->>MailProvider: Send confirmation email
    User->>Client: Open fragment-token link
    Client->>API: POST /auth/verify-email
    API->>MongoDB: Transaction: consume token + verify user + cancel pending job
    API-->>Client: 204 confirmed

    User->>Client: Request password reset
    Client->>API: POST /auth/forgot-password
    API->>MongoDB: If eligible, replace reset token and encrypted outbox job
    API-->>Client: 202 generic accepted response
    Worker->>MailProvider: Send reset email after commit
    User->>Client: Submit fragment token and new password
    Client->>API: POST /auth/reset-password
    API->>MongoDB: Transaction: consume token + replace hash + verify email + revoke sessions
    API-->>Client: 204 reset complete
```

Raw tokens are delivered only in URL fragments and request bodies. MongoDB
stores only HMAC token hashes; outbox payloads are AES-256-GCM encrypted. Email
verification links expire after 24 hours and password-reset links after 15
minutes. Resend and forgot-password responses never reveal account existence.
