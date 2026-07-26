# Backend production checklist

## Required environment

Set `NODE_ENV=production` and provide `DATABASE_URL`, `CLIENT_ORIGIN`,
`SESSION_SECRET`, the selected `AI_PROVIDER`, and its API key. The server
refuses to start when required production values are missing.

Use a random `SESSION_SECRET` containing at least 32 characters. Serve the API
over HTTPS because production session cookies are secure and use the
`__Host-sid` prefix.

Set `DATABASE_SSL=true` when required by the PostgreSQL provider.

## Health checks

- Liveness: `GET /health`
- Readiness (checks PostgreSQL): `GET /health/ready`

Configure the hosting platform to use the readiness endpoint before routing
traffic to a new instance.

## Rate limits

The built-in limits are suitable for one backend process:

- `API_RATE_LIMIT` per IP per 15 minutes
- `AUTH_RATE_LIMIT` failed authentication requests per IP per 15 minutes
- `AI_RATE_LIMIT` requests per authenticated user per hour

For multiple backend instances, replace the in-memory rate-limit store with a
shared Redis or PostgreSQL store.

## Logging

Logs are structured JSON. Forward stdout/stderr to the hosting platform's log
collector. Every response includes `X-Request-Id`; use it to find the matching
request log. Credentials, cookies, and password fields are redacted.

## Database operations

Run migrations before starting a new release:

```bash
npm run db:migrate
```

Enable automated PostgreSQL backups with the hosting provider and test restore
procedures regularly. Keep database credentials in the platform's secret
manager, never in source control.

## Deployment

Use a rolling or blue/green deployment. The server handles `SIGTERM` and
`SIGINT`, stops accepting traffic, closes PostgreSQL connections, and exits
after active requests finish or the shutdown timeout is reached.
