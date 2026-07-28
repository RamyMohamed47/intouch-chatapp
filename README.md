# intouch-chatapp

Backend API and Socket.IO server for a SaaS chat application.

## Development

Install dependencies:

```bash
npm install
```

Run the TypeScript development server:

```bash
npm run dev
```

The current static frontend has been removed. Use the API and Socket.IO server
from a dedicated frontend client.

Health check:

```http
GET /health
```

Run the full verification suite:

```bash
npm run check
```

## Runtime

The server reads `config.env` from the project root. Required values:

- `ACCESS_TOKEN_SECRET`, at least 32 bytes
- `CLIENT_ORIGINS`, comma-separated exact frontend origins
- `DATABASE`
- `DB_PASSWORD`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_CALLBACK_URL`
- `GOOGLE_OAUTH_FRONTEND_REDIRECT_URL`

Optional:

- `ACCESS_TOKEN_AUDIENCE`, defaults to `intouch-client`
- `ACCESS_TOKEN_ISSUER`, defaults to `intouch-api`
- `PORT`, defaults to `3000`
- `LOG_LEVEL`, defaults to `info` outside tests

Example development auth configuration:

```dotenv
ACCESS_TOKEN_SECRET=replace-with-at-least-32-random-bytes
CLIENT_ORIGINS=http://localhost:5173
GOOGLE_OAUTH_CLIENT_ID=replace-with-google-web-client-id
GOOGLE_OAUTH_CLIENT_SECRET=replace-with-google-web-client-secret
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:5173/api/v1/auth/oauth/google/callback
GOOGLE_OAUTH_FRONTEND_REDIRECT_URL=http://localhost:5173/auth/callback
```

## Google OAuth

Create an OAuth 2.0 Web application in Google Cloud and register the exact value
of `GOOGLE_OAUTH_CALLBACK_URL` as an authorized redirect URI. Production values
must use HTTPS, and both Google OAuth URL origins must be included in
`CLIENT_ORIGINS`.

Start sign-in by navigating the browser to:

```http
GET /api/v1/auth/oauth/google
```

The backend creates the OAuth state, redirects to Google, handles the callback,
sets the InTouch refresh cookie, and redirects to
`GOOGLE_OAUTH_FRONTEND_REDIRECT_URL?googleAuth=success`. The frontend must then
call `POST /api/v1/auth/refresh` with `X-CSRF-Protection: 1` to receive the
access JWT. A failed or cancelled flow redirects with `googleAuth=failed`.

Only `openid`, `email`, and `profile` are requested. Google access and refresh
tokens are not stored.

## Authentication Proxy

Production browser requests should use the frontend's same-origin `/api` proxy,
which forwards to the Railway API. The proxy must preserve `Origin`, `Cookie`,
`Set-Cookie`, `Location`, callback query parameters, `Authorization`, and
`X-CSRF-Protection` headers. It must also pass Google start and callback
redirects through without following them server-side.

Register and login responses set an `HttpOnly` refresh cookie. The browser never
receives the refresh token in JSON. Refresh requests must include
`X-CSRF-Protection: 1`; the access token remains a Bearer token and should be
stored in frontend memory. The production cookie is `Secure`, `SameSite=Lax`,
and scoped to `/api/v1/auth`.

Development logs are formatted for readability. Production logs are structured
JSON written to stdout.
Pino HTTP still sets `X-Request-Id`, but automatic request completed logs are
disabled to keep local output readable. Socket connection logs are emitted at
`debug`, so they are hidden by the default `info` level.

Production runs from compiled output:

```bash
npm run build
npm start
```
