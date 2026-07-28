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

Optional:

- `ACCESS_TOKEN_AUDIENCE`, defaults to `intouch-client`
- `ACCESS_TOKEN_ISSUER`, defaults to `intouch-api`
- `PORT`, defaults to `3000`
- `LOG_LEVEL`, defaults to `info` outside tests

Example development auth configuration:

```dotenv
ACCESS_TOKEN_SECRET=replace-with-at-least-32-random-bytes
CLIENT_ORIGINS=http://localhost:5173
```

## Authentication Proxy

Production browser requests should use the frontend's same-origin `/api` proxy,
which forwards to the Railway API. The proxy must preserve `Origin`, `Cookie`,
`Set-Cookie`, `Authorization`, and `X-CSRF-Protection` headers.

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
