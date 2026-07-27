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

- `DATABASE`
- `DB_PASSWORD`

Optional:

- `PORT`, defaults to `3000`
- `LOG_LEVEL`, defaults to `info` outside tests

Development logs are formatted for readability. Production logs are structured
JSON written to stdout.

Production runs from compiled output:

```bash
npm run build
npm start
```
