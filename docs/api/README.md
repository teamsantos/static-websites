# e-info.click API Documentation

Machine-readable description of the HTTP Lambda functions deployed by this repo's CDK
infrastructure. Use it to build clients, generate SDKs, and discover what's exposed.

## Files

| File           | Purpose                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| `openapi.yaml` | OpenAPI 3.1 spec — the single source of truth.                             |
| `index.html`   | Standalone [Scalar](https://scalar.com/) viewer that renders `openapi.yaml`. |

## View the docs

### Locally

```bash
npx http-server docs/api -p 4000
# open http://localhost:4000
```

Scalar loads from a CDN (`cdn.jsdelivr.net/npm/@scalar/api-reference`) — no install step.

### Hosted

`docs/api/` is a static directory; drop it behind any static host (S3 + CloudFront, GitHub
Pages, Cloudflare Pages, etc.). Re-publish whenever `openapi.yaml` changes.

## Validate the spec

```bash
npx @redocly/cli lint docs/api/openapi.yaml
# or
npx @apidevtools/swagger-cli validate docs/api/openapi.yaml
```

## Generate a client SDK

TypeScript fetch client (openapi-typescript, zero runtime deps):

```bash
npx openapi-typescript docs/api/openapi.yaml -o src/api/schema.ts
```

Full clients in other languages — use `openapi-generator-cli`:

```bash
npx @openapitools/openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g typescript-axios \
  -o sdk/ts
```

(swap `-g` for `python`, `go`, `rust`, `java`, ...)

## Servers & auth at a glance

| Domain                          | Who calls it                                 | Auth                                  |
| ------------------------------- | -------------------------------------------- | ------------------------------------- |
| `https://api.e-info.click`      | Your app                                     | Email token (`email` / `X-User-Email`) for read/delete; server-side `Origin` allow-list for writes |
| `https://pay.e-info.click`      | Stripe only                                  | `Stripe-Signature`                    |
| `https://webhooks.e-info.click` | GitHub only                                  | `X-Hub-Signature-256`                 |
| Health check                    | Monitoring                                   | none — execute-api URL from stack output |

The "email token" scheme is not cryptographically verified — it only scopes queries to the
caller's own records. Don't rely on it for secret-bearing endpoints.

## Keeping the spec in sync

The spec is hand-maintained, not generated. When you change a handler in
`infra/lambda/<name>/index.js` or its routing in `infra/*Stack.ts`, update the matching
operation in `openapi.yaml`. Lint before committing.
