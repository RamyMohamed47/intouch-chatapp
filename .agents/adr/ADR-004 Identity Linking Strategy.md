
## Status

Accepted

---

## Context

InTouch supports multiple authentication methods, including:

- Email & Password
- Google OAuth

A user may authenticate using different methods over time while maintaining a single account.

The system must prevent duplicate accounts that share the same email address.

---

## Decision

Email is globally unique across the system.

Only one user account may exist for a given email address.

Authentication methods are linked to the existing account instead of creating duplicate users.

For the MVP, OAuth provider information will be stored directly on the `User` document.

Example fields:

- passwordHash
- googleProviderId

Future OAuth providers (GitHub, Microsoft, etc.) may introduce additional provider fields or be migrated to a dedicated OAuthAccount collection if the authentication system grows in complexity.

---

## Authentication Rules

### Local Registration

If the email does not exist:

- Create a new user.
- Store the password hash.

If the email already exists:

- Reject the registration.

---

### Google Sign-In

If no user exists with the Google email:

- Create a new user.
- Store the Google Provider ID.
- Leave `passwordHash` empty.

If a user already exists with the same email:

- Link the Google Provider ID to the existing account.
- Do not create a second user.

---

### Local Login

Users authenticate using:

- Email
- Password

Password verification is skipped for Google-only accounts.

---

### Google Login

Users authenticate through Google OAuth.

After Google verifies the user's identity:

- Find the user by email.
- Link the provider if necessary.
- Authenticate the existing account.

---

## Edge Cases

### Existing Google Account → Local Password

A user who originally registered with Google may later choose to add a password.

This action requires ownership verification (for example, authenticating with Google before setting a password).

---

### Existing Local Account → Google Login

If Google returns the same email address as an existing local account:

- Link the Google Provider ID.
- Reuse the existing account.
- Preserve all organizations, memberships, conversations, and data.

---

### Duplicate Emails

Duplicate accounts with the same email are never permitted.

The email address is treated as the unique identity of a user.

---

## Alternatives Considered

### Separate OAuthAccount Collection

Pros

- Supports unlimited authentication providers.
- Cleaner normalization.
- Easier provider management.

Cons

- Additional collection.
- More joins (or multiple queries).
- Unnecessary complexity for the MVP.

This option may be revisited in a future version of InTouch.

---

## Consequences

### Advantages

- Prevents duplicate accounts.
- Simplifies authentication.
- Keeps user data centralized.
- Easy to extend in the future.

### Trade-offs

- The User document contains provider-specific fields.
- A dedicated OAuthAccount collection may eventually provide a cleaner design if many providers are supported.