# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static website generator + online template editor. Users pick a template, fill it in through the browser editor, and the site is built and deployed to AWS (S3 + CloudFront, one subdomain per project under `e-info.click`). Templates are also hosted standalone at `<template>.template.e-info.click`. Backend APIs run on Lambda + API Gateway, orchestrated by Step Functions and fed by SQS.

## Build system

Vite is the single build tool; `vite.config.js` switches its `root`/`input`/`outDir` based on env vars — there's no separate config per artifact:

- `npm run dev` — serves the landing page (`index.html`) at the repo root.
- `npm run build` — two passes: landing page → `dist/`, then `EDITOR_BUILD=true` rebuilds the template editor (single-file bundle via `vite-plugin-singlefile`) into `dist/template-editor.html`.
- `TEMPLATE=<name> npm run build` — builds a single template from `templates/<name>/` into `templates/<name>/dist/`.
- `PROJECT=<name> npm run build` — builds an end-user's generated site from `projects/<name>/`.
- `npm run build:templates` / `npm run build:template <name>` — wraps the template build in `helpers/buildTemplate.js`, which runs the extractor first (see below) and restores `index.html` from backup afterward. Prefer this over the raw `TEMPLATE=` command; raw leaves the template dir in the extracted state.
- `npm run editor` — full build + local http-server, opens the editor against the portfolio template.
- `npm run screenshots` — Playwright captures 800×600 WebP screenshots of each template for `assets/templates.json`. Expects templates to be reachable at `https://<name>.template.e-info.click`.

Only `EDITOR_BUILD=true` produces a single-file bundle (`assetsInlineLimit: Infinity`); project/template builds keep images as separate hashed files under `images/`.

There are no tests and no linter configured.

## Template extraction/injection pipeline

This is the non-obvious core of the system. A template author writes a normal `index.html` with literal text, `src=...`, and Font Awesome `<i>` icons. `helpers/htmlExtractor.js` rewrites it in-place into an editable skeleton:

- Visible text → `data-text-id="key"`, values go to `langs/en.json`. Button/input text, `alt`, `title`, and `<meta content>` get their own `data-*-text-id` flavors.
- `<img src>` and inline `background-image: url(...)` → `data-image-src` / `data-bg-image`, values go to `assets/images.json`.
- Font Awesome icon classes on `<i>` → `data-icon-id`, values go to `assets/icons.json`.
- Elements with `id="title"` / `id="description"` get reserved keys so `<title>` and meta description stay stable across runs.
- `index.html` is backed up to `index.bak.html` before mutation; `buildTemplate.js` restores it after Vite builds.

At runtime, `shared/templateInjection.js` performs the inverse mapping via **regex** (not JSDOM) — it's the hot path in `generate-website` Lambda and is intentionally ~10× faster than DOM parsing. When changing attribute naming conventions in the extractor, update this module in lockstep.

When you add a new template, run `node helpers/generateTemplates.js` to refresh `assets/templates.json` — the landing page reads from it. A `.commingsoon` marker file excludes the template from generation; a `.liveframe` marker means the landing page should embed the live template in an iframe instead of using a screenshot.

## Editor (app/editor/)

The template editor is a shadow-DOM-isolated SPA. `editor.js` instantiates manager classes (UI, Modals, Project, Template, Elements, Editing, Sections, HeroImages, Upload) that share a single `TemplateEditor` instance — look here when tracing editor state. CSS is imported with Vite's `?inline` suffix so the entire editor ships as one HTML file.

## Infrastructure (infra/)

AWS CDK v2 in TypeScript. `infra/index.ts` is the composition root and wires ~20 stacks. Key points:

- Two CloudFront distributions: `MultiTenantDistribution` serves user projects from `s3://teamsantos-static-websites/<project>/`, `TemplateDistribution` serves templates under `*.template.e-info.click`. Both must exist before `BucketStack` because the bucket policy references their OACs.
- ACM certificates live in `us-east-1` (`certificateRegion`); everything else is in `eu-south-2`. `crossRegionReferences: true` is set on stacks that span both.
- `ProjectSite` stacks are created dynamically from the CDK context: `cdk deploy --context projects=foo,bar --context templates=baz`. Deploying the *shared* stacks alone needs neither — the warning at the bottom of `index.ts` is informational.
- Deploy from `infra/`: `npm run deploy` (all shared stacks), `npm run deploy-project -- projects=name`, `npm run diff`, `npm run destroy-project -- projects=name`. Requires `CDK_DEFAULT_ACCOUNT` or `--profile` and (for real traffic) `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`, `SENDER_EMAIL`, `FRONTEND_URL`, `ADMIN_EMAIL`.
- WAF is regional (attached to API Gateway) but **disabled by default** (`config.wafEnabled = false` in `infra/index.ts`) to avoid the ~$10/month fixed cost while pre-production. Re-enable by flipping the flag. `StripeCheckoutStack` intentionally has **no** WAF so Stripe can call its webhook.

## Lambda functions (infra/lambda/)

Each subdirectory is its own npm package. They import common utilities from `shared/` via the local path alias `"@app/shared": "file:../../../shared"`. To install dependencies across all of them at once, run `scripts/prepare-lambda-functions.sh`. When you add a new shared utility, make sure each Lambda that needs it has the `@app/shared` dependency declared.

`upload-template` accepts a self-contained HTML file, runs the same extraction pipeline as in-repo templates (now factored into `shared/htmlExtractor.js` — `extractFromDom` / `injectIntoSkeleton`), and publishes the result to `s3://<bucket>/templates/<id>/`. The DOM is sanitized before extraction (drops `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, meta-refresh, `on*=` handlers, `javascript:`/`vbscript:`/`data:text/html` URLs) on a single JSDOM parse. Embedded `data:image/...` URIs are sha256-hashed and uploaded under `templates/<id>/images/<hash>.<ext>`; SVG is intentionally excluded from the allowed image MIME list. Records the upload as `type: "user-template"` with `userInjected: true` in the metadata table — the landing-page gallery filters these out as defense-in-depth (they never enter `assets/templates.json` anyway). Constraints worth knowing: 2 MB HTML cap, 10 templates per email, and `RESERVED_SLUGS` in `index.js` must be kept in lockstep with the `templates/` directory or a CI deploy will silently overwrite a user-injected template.

### API key auth (`shared/apiKeyAuth.js`)

Opt-in `x-api-key` header scheme alongside the existing `Origin` allow-list and email-token checks. A valid key bypasses the origin gate on writes and the per-project ownership check on `GET /projects` / `DELETE /projects/{id}`; the `email` parameter still selects whose data to act on. Wired into `create-project`, `generate-website`, `payment-session`, `get-projects`, `delete-project`, and `upload-template`. Internal Lambda-to-Lambda invokes of `generate-website` skip the check. Keys are stored as SHA-256 hashes in the `api-keys` DynamoDB table (TTL via `expiresAt`, revoke by setting `status` to `revoked`); generate with `npm run api-key:generate`. The WAF `OriginValidationRule` only blocks when both the `Origin` is missing from the allow-list **and** `x-api-key` is absent — keep that in mind when editing WAF rules.

## Deployment flow

`.github/workflows/deploy.yml` runs inside the repo's own Docker image (`Dockerfile` at the root — node:20-slim + AWS CLI). It regenerates `assets/templates.json`, builds, diffs `dist/index.html` and `dist/template-editor.html` against what's live in S3, and only uploads + invalidates CloudFront if they changed. HTML is uploaded with `no-cache`; other assets with 1-year immutable cache. Triggered on push to `master` (excluding `projects/`, `infra/`, `package.json`) or when the Docker image workflow completes.

## Gotchas

- The extractor's `injectTextContent` is defined twice in `helpers/htmlExtractor.js` (the second overrides the first). Editing only the first has no effect.
- `projects/` is gitignored except for `projects/generating/`, the placeholder shown while a new site is being built.
- `infra/*.js` is gitignored — TypeScript compiles in place and the `.js` output is not committed.
