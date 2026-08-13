# InTouch Manual Testing and Security Audit Guide

**Prepared:** August 13, 2026  
**Audience:** Authorized manual QA and security tester  
**Frontend URL:** `<add deployed frontend URL>`  
**API URL:** `<add deployed API URL>`  
**Swagger URL:** `<frontend URL>/api/docs`
**Commit/build tested:** `<add Git commit SHA or Railway deployment ID>`

## 1. Project Description

InTouch is a full-stack team communication application built around
organizations, categorized channels, and organization-scoped direct messages.
The browser uses a Next.js frontend and same-origin API proxy. The backend uses
Express, MongoDB, transactions, JWT access tokens, rotating opaque refresh
sessions, and Socket.IO.

Implemented capabilities include:

- Email/password registration and login.
- Backend-owned Google OAuth redirect authentication.
- In-memory access JWTs and rotating refresh tokens in secure `HttpOnly`
  cookies.
- Organization creation, listing, updating, visibility, and deletion.
- Owner/member authorization and invitation-based private organization access.
- Public organization joining through a known organization URL.
- Ordered categories and public/private channel conversations.
- Private-channel participant management.
- Organization-scoped one-to-one direct messages.
- Message history, sending, editing, redacted deletion, and pagination.
- Unread counts and durable read receipts.
- Realtime message delivery, typing indicators, online presence, and access
  revocation.
- Per-IP, per-account, and authenticated per-user abuse protection.
- Strict shared Zod contracts, consistent API errors, CSP, CORS, and security
  headers.
- Public, read-only Swagger UI plus downloadable OpenAPI YAML and JSON
  contracts.

Browse the API contract at `<frontend URL>/api/docs`, download it from
`<frontend URL>/api/openapi.yaml` or `<frontend URL>/api/openapi.json`, and use
`.agents/api/openapi.yaml` as the repository source. The Swagger UI is
documentation-only and cannot execute requests. Socket.IO events are documented
separately in `.agents/sockets/Socket Events.md`.

## 2. Intended Scope and Known Limitations

Treat these as known limitations unless behavior differs from the description:

- Invitations target an already registered email address and are discovered in
  the in-app invitation inbox. No invitation email is sent.
- Email verification, password recovery, MFA, account unlock, logout-all, and
  session management are not implemented.
- Google identities are automatically linked to an existing account with the
  same Google-verified email. There is no additional local ownership challenge.
- Passwords require at least 8 characters and at most 72 UTF-8 bytes for bcrypt.
- Presence, typing, authenticated token buckets, and active-socket accounting
  are process-local. The API must run as one instance until Redis is added.
- Presence and typing reset after an API restart; `lastSeenAt` is best effort.
- Ownership transfer, member removal, invitation revocation/listing by owners,
  and adding a password to a Google-only account are not implemented.
- Public organization discovery is not implemented. Public organizations are
  joinable only through a known organization URL.
- Group DMs, attachments, reactions, threads, mentions, notifications, search,
  meetings, and message delivery receipts are not implemented.
- Organization deletion is permanent. Deleted messages remain as redacted
  tombstones, but deleted organizations/channels are hard-deleted.

## 3. Safety and Test Preparation

Only test accounts and data created for this audit should be modified or
deleted. Do not perform volumetric denial-of-service tests against Railway,
MongoDB Atlas, or Google. Rate-limit checks should use the minimum requests
needed to confirm enforcement.

### Required Test Accounts

Prepare four distinct registered accounts:

| Account      | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `Owner A`    | Creates and owns organizations, categories, and channels       |
| `Member B`   | Accepts invitations and tests member authorization             |
| `Member C`   | Tests private-channel access boundaries and DMs                |
| `Outsider D` | Has no initial membership and tests concealment/public joining |

If Google OAuth is being tested, use an additional Google account that the
tester controls.

### Recommended Test Setup

- Use two browsers, browser profiles, or normal/incognito windows concurrently.
- Keep DevTools **Network**, **Console**, **Application/Storage**, and
  **Accessibility** panels available.
- Disable browser extensions that alter requests, cookies, or page styles.
- Test at desktop and mobile viewport sizes.
- Confirm the Railway API has exactly one running replica.
- Record the browser, OS, commit SHA, deployment ID, frontend URL, and API URL.

### Suggested Fixture

1. `Owner A` creates one private organization and one public organization.
2. Add categories named `General` and `Projects`.
3. Add a public channel named `announcements` and a private channel named
   `leadership`.
4. Invite `Member B` and `Member C` to the private organization.
5. Add only `Member B` to `leadership`.
6. Create a DM between `Owner A` and `Member B`.

## 4. Authorization Reference

| Capability                     |      Owner       |      Member      | Authenticated nonmember |
| ------------------------------ | :--------------: | :--------------: | :---------------------: |
| View private organization      |       Yes        |       Yes        | No, concealed as `404`  |
| View known public organization |       Yes        |       Yes        |           Yes           |
| Join known public organization |  Already joined  |  Already joined  |           Yes           |
| Update/delete organization     |       Yes        |        No        |           No            |
| Invite registered user         |       Yes        |        No        |           No            |
| List organization members      |       Yes        |       Yes        |           No            |
| Manage categories/channels     |       Yes        |        No        |           No            |
| Access public channel          |       Yes        |       Yes        |           No            |
| Access private channel         |       Yes        | Participant only |           No            |
| Manage private participants    |       Yes        |        No        |           No            |
| Access a DM                    | Participant only | Participant only |           No            |
| Edit message                   |   Sender only    |   Sender only    |           No            |
| Delete channel message         | Sender or owner  |   Sender only    |           No            |
| Delete DM message              |   Sender only    |   Sender only    |    No owner override    |

For hidden private resources, `404` is intentional and prevents resource
enumeration. A visible resource that requires owner authority should return
`403`.

## 5. Manual Functional Test Cases

Record each case as `Pass`, `Fail`, `Blocked`, or `Not Run`.

### Deployment and Navigation

| ID     | Test                      | Steps                                                                             | Expected result                                                                                                     |
| ------ | ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| DEP-01 | API health                | Open `<API_URL>/health`.                                                          | HTTP `200` with `status: "ok"`, uptime, and timestamp.                                                              |
| DEP-02 | Root navigation           | Open the frontend root URL.                                                       | Redirects to `/login`.                                                                                              |
| DEP-03 | Direct protected route    | In a signed-out browser, open `/app` and a copied conversation URL.               | Branded loading state appears, then the user is redirected to `/login`; the safe internal return path is preserved. |
| DEP-04 | Unknown frontend resource | Open a nonexistent organization or conversation ID while authenticated.           | A designed in-shell unavailable/not-found state appears without exposing internal details.                          |
| DEP-05 | Browser console baseline  | Navigate through login, hub, settings, and conversation pages with DevTools open. | No uncaught exceptions, CSP violations, failed application resources, MIME errors, or response decoding errors.     |

### Registration, Login, Session, and OAuth

| ID      | Test                        | Steps                                                                                                                                | Expected result                                                                                               |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | Valid registration          | Register a unique username/email with a valid display name and password.                                                             | Account is created, user enters `/app`, and the refresh cookie is set.                                        |
| AUTH-02 | Registration normalization  | Register using surrounding spaces and uppercase letters in the email.                                                                | Text is trimmed where defined; email is normalized to lowercase.                                              |
| AUTH-03 | Registration validation     | Try a short username, invalid characters, blank display name, invalid email, password under 8 characters, and an oversized password. | Field-level validation prevents submission or returns a clear validation message; no account is created.      |
| AUTH-04 | Duplicate identities        | Attempt registration with an existing email, then with an existing username.                                                         | Each returns a conflict without creating another user.                                                        |
| AUTH-05 | Valid password login        | Log out, then sign in with the registered email/password.                                                                            | User returns to `/app`; no refresh token appears in response JSON.                                            |
| AUTH-06 | Generic login failure       | Try an unknown email, wrong password, and a Google-only account through password login.                                              | All produce the same generic `401` message without revealing account existence.                               |
| AUTH-07 | Return path                 | Open a protected organization/conversation URL while signed out, then log in.                                                        | User returns only to the original safe `/app` path, never to an external URL.                                 |
| AUTH-08 | Session restoration         | Log in, reload the page, and open a new tab on the same origin.                                                                      | Session restores through the refresh cookie and protected data loads without another login.                   |
| AUTH-09 | Logout                      | Log out, then use Back and reload.                                                                                                   | User remains signed out, private query data is gone, realtime disconnects, and the refresh cookie is cleared. |
| AUTH-10 | Google success              | Select Google, choose an account, and complete consent.                                                                              | Callback shows/restores success and redirects to `/app`; no token/code appears in the final URL.              |
| AUTH-11 | Google cancellation/failure | Cancel Google consent or invoke callback failure.                                                                                    | A branded failure state appears with a safe retry path; OAuth state cookie is cleared.                        |
| AUTH-12 | Password visibility         | Toggle the password visibility button by mouse and keyboard.                                                                         | Password visibility changes, label changes between Show/Hide, and focus remains usable.                       |

### Organizations and Memberships

| ID     | Test                        | Steps                                                                                       | Expected result                                                                                                       |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ORG-01 | Create private organization | Create an organization with name only.                                                      | It is created as private, appears in the hub/rail, and creator is `OWNER`.                                            |
| ORG-02 | Create public organization  | Create one with `PUBLIC` visibility and optional HTTP(S) logo URL.                          | Organization is created with the chosen visibility and logo.                                                          |
| ORG-03 | Organization validation     | Submit blank/over-100-character name, invalid logo URL, and unsupported protocol.           | Submission fails with a useful validation message.                                                                    |
| ORG-04 | Update organization         | As owner, change name, logo, and visibility.                                                | Updated values appear throughout the UI; the organization ID/slug route remains stable.                               |
| ORG-05 | Member settings denial      | As `Member B`, directly open the organization settings URL.                                 | Access-denied UI appears and mutation controls are unavailable.                                                       |
| ORG-06 | Private concealment         | As `Outsider D`, open a private organization URL and call its API by ID.                    | Resource is concealed as unavailable/`404`.                                                                           |
| ORG-07 | Public view and join        | As `Outsider D`, open a known public organization URL and select Join.                      | Join CTA is shown; joining creates `MEMBER` access and updates the rail.                                              |
| ORG-08 | Repeated public join        | Repeat the join request through an API client.                                              | Returns `409`; no duplicate membership is created.                                                                    |
| ORG-09 | Invite registered user      | As owner, invite `Member B` by email from settings and from the conversation-header dialog. | Invitation succeeds, email resets, and confirmation text is green and announced as status.                            |
| ORG-10 | Invitation failures         | Invite an unknown email, self, existing member, and duplicate pending recipient.            | Appropriate error is shown in red; no duplicate invitation is created.                                                |
| ORG-11 | Invitation authorization    | As a member, confirm invite controls are absent; attempt the API directly.                  | UI hides owner action and API returns `403`.                                                                          |
| ORG-12 | Invitation inbox            | Sign in as invited user and open `/app/invitations`.                                        | Pending invitation appears with organization, visibility, role, and expiration.                                       |
| ORG-13 | Accept invitation           | Accept as the intended recipient.                                                           | Invitation disappears, organization enters the rail, membership is `MEMBER`, and repeat acceptance returns not found. |
| ORG-14 | Decline invitation          | Create another invitation and decline it.                                                   | Invitation disappears, organization is not joined, and repeat decline returns not found.                              |
| ORG-15 | Wrong invitation recipient  | Attempt to accept another user's invitation through the API.                                | Returns concealed `404`; no membership is created.                                                                    |
| ORG-16 | Delete organization         | As owner, delete a disposable organization containing categories/channels/messages.         | Confirmation is required; organization disappears and copied resource URLs stop working.                              |

### Categories, Channels, and Participants

| ID    | Test                              | Steps                                                                                              | Expected result                                                                                           |
| ----- | --------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| CH-01 | Create categories                 | Create two categories.                                                                             | They append in deterministic zero-based order and appear in the navigation.                               |
| CH-02 | Category validation/uniqueness    | Try blank, over-100-character, and case-variant duplicate names.                                   | Invalid names are rejected; duplicate names conflict case-insensitively.                                  |
| CH-03 | Reorder categories                | Move a category up/down. Reload and check another client.                                          | Order changes consistently and persists after reload.                                                     |
| CH-04 | Rename category                   | Rename a category with surrounding spaces.                                                         | Trimmed name is persisted and navigation updates.                                                         |
| CH-05 | Delete empty category             | Delete a category with no channels.                                                                | Category is removed and remaining ordering stays contiguous.                                              |
| CH-06 | Reject nonempty category deletion | Attempt to delete a category containing a channel.                                                 | Clear conflict is shown and category/channel remain intact.                                               |
| CH-07 | Create public channel             | Create a channel under a category without selecting private visibility.                            | `CHANNEL` conversation is created as public and visible to all organization members.                      |
| CH-08 | Create private channel            | Create a private channel.                                                                          | Owner can enter it; ordinary members cannot until added as participants.                                  |
| CH-09 | Channel uniqueness                | Create a case-variant duplicate name in the same category, then the same name in another category. | Same-category duplicate conflicts; another category accepts the name.                                     |
| CH-10 | Rename/move channel               | Rename a channel and move it to another category with/without explicit position.                   | Name updates; moving without position appends in the target category.                                     |
| CH-11 | Public to private                 | Change a public channel to private.                                                                | Existing participants are cleared, owner remains participant, unauthorized open sockets lose access.      |
| CH-12 | Private to public                 | Change a private channel to public.                                                                | All organization members gain access and participant records are removed.                                 |
| CH-13 | Add private participant           | Add `Member B` from the private-channel participant controls.                                      | Member can open history, send messages, and receive realtime events.                                      |
| CH-14 | Reject invalid participant        | Try owner, existing participant, outsider, and participant changes on a public channel.            | Owner cannot be removed, duplicates/outsider conflict, and public participant management is rejected.     |
| CH-15 | Remove private participant        | Remove `Member B` while that member has the channel open.                                          | Access is revoked, socket leaves the room, UI shows access changed, and future API requests return `404`. |
| CH-16 | Delete channel                    | Delete a disposable channel containing messages.                                                   | Channel disappears; copied channel/message endpoints no longer expose its data.                           |

### Direct Messages and Messaging

| ID     | Test                            | Steps                                                                                            | Expected result                                                                                            |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| MSG-01 | Create DM                       | Start a DM with another current organization member.                                             | One-to-one DM opens and appears for both participants.                                                     |
| MSG-02 | Idempotent DM                   | Start a DM with the same person again.                                                           | Existing conversation opens; no duplicate pair is created.                                                 |
| MSG-03 | DM boundaries                   | Attempt self-DM, outsider DM, and direct access by a third organization member.                  | Self request is `400`; outsider/inaccessible DM is concealed as `404`.                                     |
| MSG-04 | Send button                     | Send a normal message with the button.                                                           | It appears once, composer clears, and the other participant receives it live.                              |
| MSG-05 | Keyboard sending                | Press Enter with text; then use Shift+Enter in another message.                                  | Enter sends once; Shift+Enter creates a newline without sending prematurely.                               |
| MSG-06 | Message validation              | Try empty, whitespace-only, and over-4,000-character content.                                    | Invalid content is not created and a clear validation error appears.                                       |
| MSG-07 | Scoped realtime delivery        | Open two different conversations in separate clients and send in one.                            | Event appears only in the joined conversation room and relevant summaries update.                          |
| MSG-08 | REST/socket deduplication       | Send while both REST and Socket.IO are active.                                                   | The message appears exactly once despite REST response and socket broadcast.                               |
| MSG-09 | Initial and sent-message scroll | Open a long conversation and send from while scrolled upward.                                    | Initial history opens at the bottom; locally sent message scrolls smoothly to the bottom.                  |
| MSG-10 | Incoming scroll policy          | Receive a message while near the bottom, then while reading older history.                       | Near-bottom view follows the message; reading position is preserved when scrolled up.                      |
| MSG-11 | Load earlier history            | Select Load earlier messages in a paginated conversation.                                        | Older messages prepend, current visible position is preserved, and no duplicates appear.                   |
| MSG-12 | Edit own message                | Edit a message you sent.                                                                         | Content updates live, `edited` appears, and timestamp/identity remain coherent.                            |
| MSG-13 | Reject foreign edit             | Attempt to edit another user's message through the API.                                          | Returns `403`; content is unchanged.                                                                       |
| MSG-14 | Delete own message              | Delete your message.                                                                             | Content becomes a `Message deleted` tombstone for all viewers; timeline position remains.                  |
| MSG-15 | Channel owner moderation        | As owner, delete a member's channel message.                                                     | Deletion succeeds and broadcasts a tombstone.                                                              |
| MSG-16 | DM privacy                      | As organization owner who is not the sender, attempt to delete another participant's DM message. | Returns `403`; organization ownership does not grant DM moderation.                                        |
| MSG-17 | Repeated deletion               | Delete the same message again through the API.                                                   | Operation remains idempotent and does not restore or duplicate data.                                       |
| MSG-18 | Unread summaries                | Send messages from another account while recipient is elsewhere.                                 | Channel/DM summaries show correct unread counts; sender's own messages do not increase their unread count. |

### Presence, Typing, and Read Receipts

| ID    | Test                    | Steps                                                                          | Expected result                                                                                                   |
| ----- | ----------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| RT-01 | Online presence         | Open the organization as `Member B` while `Owner A` watches the roster.        | `Member B` becomes online only for users sharing the organization.                                                |
| RT-02 | Multiple tabs           | Open two authenticated tabs for the same user, close one, then close the last. | User remains online after one closes; goes offline about 5 seconds after the final socket disconnects.            |
| RT-03 | Reconnect grace         | Close the last tab and reconnect within 5 seconds.                             | Pending offline transition is cancelled; no false offline state persists.                                         |
| RT-04 | Last seen               | Stay offline past the grace period and reload another member's roster.         | Status is offline and `lastSeenAt` reflects the latest final disconnect.                                          |
| RT-05 | Typing start/stop       | Type non-whitespace content, pause, clear, blur, send, and navigate away.      | Other participant sees typing while active; it stops on clear/blur/send/navigation.                               |
| RT-06 | Typing expiration       | Interrupt the typing client without sending an explicit stop.                  | Indicator expires after roughly 5 seconds.                                                                        |
| RT-07 | Typing isolation        | Type in one conversation while another account views a different conversation. | Indicator appears only to authorized members in the same conversation and not on the typing user's other sockets. |
| RT-08 | DM read receipt         | Send a DM, open it as recipient, and keep the document visible.                | Sender changes from Sent to Read after the recipient's durable receipt advances.                                  |
| RT-09 | Channel receipt privacy | Read a channel from another account.                                           | Unread state clears for that reader, but no public per-reader channel receipt appears.                            |
| RT-10 | Inactive document       | Receive messages while the recipient tab/document is hidden.                   | History fetch alone does not falsely mark messages read until the document is active.                             |

## 6. Security and Abuse Test Cases

Use an API client or DevTools request replay only against the authorized test
deployment. Never reuse another real user's credentials.

| ID     | Test                            | Steps                                                                                                                                            | Expected result                                                                                                                                       |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | Refresh-cookie properties       | Inspect the production refresh cookie after login.                                                                                               | Host-only secure-prefixed cookie; `HttpOnly`, `Secure`, `SameSite=Lax`, path `/api/v1/auth`; token absent from JSON/storage.                          |
| SEC-02 | Access-token storage            | Inspect cookies, localStorage, sessionStorage, HTML, and URLs.                                                                                   | Access JWT exists only in runtime memory/API responses; never persisted in those locations.                                                           |
| SEC-03 | Missing/invalid Bearer token    | Call protected API routes without a token and with malformed/expired tokens.                                                                     | Standard `401` response; no protected data leaks.                                                                                                     |
| SEC-04 | CSRF header                     | Call refresh/logout with valid cookie but omit `X-CSRF-Protection: 1`.                                                                           | Request is rejected with `403`; refresh session is not rotated/revoked unexpectedly.                                                                  |
| SEC-05 | Origin validation               | Replay refresh/logout with an unallowlisted `Origin`.                                                                                            | Request is rejected with `403`; no permissive wildcard credentialed CORS.                                                                             |
| SEC-06 | Refresh rotation/replay         | Capture one test refresh request, rotate normally, then replay the stale cookie value using an isolated API client.                              | Replay returns `401`, revokes that session, and clears the cookie. Do not perform this on a needed session.                                           |
| SEC-07 | Object-level authorization      | Replace organization, category, conversation, participant, invitation, message, and receipt IDs with resources belonging to other test accounts. | Access follows the authorization table; private/inaccessible resources are concealed and never mutate.                                                |
| SEC-08 | Strict input contracts          | Add unknown JSON fields, malformed IDs, wrong types, and empty PATCH objects to representative endpoints.                                        | Returns standard `400`; unknown fields are not persisted.                                                                                             |
| SEC-09 | Error envelope                  | Trigger representative `400`, `401`, `403`, `404`, `409`, and `429` responses.                                                                   | Body is `{ "success": false, "error": { "code", "message" } }`; no stack trace, query, secret, or internal path leaks.                                |
| SEC-10 | Account login throttle          | With a disposable email, make ten failed password attempts and then an eleventh from different IP contexts if authorized.                        | First ten are admitted as generic credential failures; eleventh returns generic `429`; cooldown does not extend per blocked request.                  |
| SEC-11 | IP auth limits                  | Minimally verify registration, failed-login, refresh, and Google-start limits with disposable data.                                              | Limits produce `429` without exposing account existence. Avoid sustained load.                                                                        |
| SEC-12 | Authenticated message limit     | Rapidly create 11 messages as one user.                                                                                                          | Burst allows up to 10; next request returns `429` with `Retry-After`; another user's bucket remains independent.                                      |
| SEC-13 | Other user-action limits        | Minimally test combined edit/delete, receipt, and DM-create bursts.                                                                              | Limits apply per authenticated user/action and return the standard `429` envelope.                                                                    |
| SEC-14 | Socket authentication           | Connect without token, malformed token, and expired token.                                                                                       | Connection fails with typed `UNAUTHORIZED`; established socket disconnects when token expires.                                                        |
| SEC-15 | Socket limits                   | Open up to five active sockets for one user, then attempt a sixth and rapid reconnects.                                                          | Sixth is rejected; throttling returns `TOO_MANY_REQUESTS` with retry delay; other users remain unaffected.                                            |
| SEC-16 | Socket room authorization       | Emit join/subscribe/typing events for inaccessible or malformed IDs.                                                                             | Acknowledgement contains typed failure; socket does not enter unauthorized rooms or receive their events.                                             |
| SEC-17 | Payload limits                  | Send a Socket.IO payload over 10 KB in the test environment.                                                                                     | Server rejects/disconnects safely without instability or cross-user impact.                                                                           |
| SEC-18 | Security headers                | Inspect a frontend document and API response.                                                                                                    | CSP, `frame-ancestors 'none'`, `object-src 'none'`, `nosniff`, referrer policy, permissions policy, and API Helmet headers are present as applicable. |
| SEC-19 | CSP behavior                    | Attempt inline script execution through DevTools/snippet and inspect normal navigation.                                                          | Unauthorized inline scripts are blocked; nonce-bearing application scripts work; no legitimate UI styles/scripts are blocked.                         |
| SEC-20 | Injection rendering             | Send HTML/script-like text in messages, names, and supported text fields.                                                                        | Text renders inertly; no script executes, markup is not interpreted, and other clients remain safe.                                                   |
| SEC-21 | Clickjacking                    | Attempt to embed the frontend in an iframe from another local origin.                                                                            | Browser blocks framing due to CSP.                                                                                                                    |
| SEC-22 | Request correlation/log hygiene | Inspect failed responses/logs if access is provided.                                                                                             | Request IDs are available; passwords, JWTs, refresh tokens, Google credentials, and raw throttle emails are not logged.                               |

### Current Abuse Policies

| Action                               | Policy                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Registration                         | 5 attempts per hour per IP                                               |
| Failed password login                | 10 per 15 minutes per IP                                                 |
| Password login identifier            | 10 attempts per normalized email per 15 minutes, then 15-minute cooldown |
| Refresh/logout                       | 60 per 15 minutes per IP                                                 |
| Google OAuth start/callback          | 10 starts / 20 callbacks per 15 minutes per IP                           |
| Create message                       | Burst 10; refill 1 every 2 seconds per user                              |
| Edit/delete message combined         | Burst 10; refill 1 every 3 seconds per user                              |
| Read receipt                         | Burst 30; refill 1 every 500 ms per user                                 |
| Create DM                            | Burst 5; refill 1 every 12 seconds per user                              |
| Active sockets                       | Maximum 5 per user                                                       |
| Socket connection attempts           | Burst 10; refill 1 every 3 seconds per user                              |
| Join/organization subscribe combined | Burst 20; refill 1 per second per user                                   |
| Typing start                         | Burst 10; refill 1 every 2 seconds per user                              |

## 7. Responsive, Accessibility, and Visual Checks

| ID    | Test                          | Steps                                                                                                             | Expected result                                                                                                                       |
| ----- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01 | Desktop/mobile layout         | Test login, register, hub, settings, invitations, channel, and DM at 320 px, 768 px, and desktop widths.          | No inaccessible controls, clipped critical content, unintended horizontal scrolling, or overlapping composer/navigation.              |
| UX-02 | Short viewport                | Test login/register on a short laptop-height viewport and at 200% zoom.                                           | Branding and form remain usable; form fields and submit controls can be reached without content loss.                                 |
| UX-03 | Keyboard navigation           | Complete auth, open mobile/desktop navigation, dialogs, tabs, settings actions, and composer using keyboard only. | Logical focus order, visible focus, functional Enter/Space/Escape behavior, and no focus traps.                                       |
| UX-04 | Accessible names              | Inspect icon-only controls, logo links, message actions, participant controls, and dialogs.                       | Controls have meaningful accessible names; decorative brand images are not redundantly announced.                                     |
| UX-05 | Feedback announcements        | Trigger validation error, invitation success/error, loading, and access-revoked states.                           | Errors use alerts where appropriate; success uses non-destructive status announcement; color is not the only signal.                  |
| UX-06 | Themes                        | Check `ink`, `cloud`, `aurora`, and `ember` on auth, settings, and chat.                                          | Text, focus rings, brand variants, green success, errors, disabled controls, and overlays remain legible.                             |
| UX-07 | Reload/navigation consistency | Navigate through rail, browser Back/Forward, direct URLs, and reload.                                             | Selected organization/conversation stays coherent and stale fixture/preview language does not appear.                                 |
| UX-08 | Slow/offline network          | Throttle network, disconnect briefly, retry failed queries, and reconnect Socket.IO.                              | Visible loading/error/retry states appear; duplicate mutations are prevented; realtime reconnects without forcing unnecessary logout. |

## 8. API-Specific Audit Notes

- Browser REST requests should target the frontend's same-origin
  `/api/v1/...` proxy. Socket.IO connects directly to the public API origin.
- Direct API responses use the base path `/api/v1`.
- Successful creates generally return `201`, reads/updates `200`, and deletes
  `204` with no body.
- Validation uses strict request objects. Extra fields should fail rather than
  being silently stored.
- Refresh clients must serialize refresh attempts because refresh credentials
  are single-use and rotate on success.
- Message writes remain REST-based; Socket.IO is subscription/broadcast-only.
- Channel history defaults to 50 messages with a maximum of 100. DM listing
  defaults to 30 with a maximum of 100.
- A stale read-receipt update should return the current high-water receipt and
  must never move it backwards.

## 9. Defect Reporting Template

Use one report per distinct defect:

```markdown
## [Severity] Short defect title

- Test case ID:
- Environment/build:
- Browser/OS/device:
- Account role:
- Organization/channel visibility:
- Preconditions:

### Steps to reproduce

1.
2.
3.

### Expected result

### Actual result

### Reproducibility

Always / Intermittent / Once

### Evidence

- Screenshot/video:
- Console output:
- Request method and URL:
- HTTP status and response body:
- `X-Request-Id`:

### Security impact, if applicable

Describe the data or capability exposed, the attacker prerequisites, and the
smallest verified impact. Do not include real secrets or personal data.
```

### Suggested Severity

| Severity      | Meaning                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Critical      | Authentication bypass, remote code execution, broad sensitive-data exposure, or destructive cross-tenant compromise             |
| High          | Cross-organization authorization failure, account takeover path, refresh-token compromise, or stored XSS                        |
| Medium        | Limited authorization/privacy issue, meaningful CSRF/CSP weakness, persistent data-integrity failure, or major workflow failure |
| Low           | Minor information disclosure, isolated validation/UI defect, accessibility failure, or low-impact inconsistency                 |
| Informational | Hardening recommendation or expected limitation with no demonstrated exploit/functional failure                                 |

## 10. Completion Summary

At the end of the audit, report:

- Build/deployment tested.
- Browsers and viewport sizes tested.
- Accounts and roles exercised.
- Number of passed, failed, blocked, and skipped cases.
- Defects grouped by severity.
- Any areas not tested and why.
- Whether destructive test data was cleaned up.
