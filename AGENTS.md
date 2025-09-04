# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev server**: `npm run dev` (Vite with hot reload)
- **Build**: `npm run build` (main), `PROJECT=name npm run build` (project), `TEMPLATE=name npm run build` (template)
- **Preview**: `npm run preview`
- **Infra**: `cd infra && npm run build` (TS compile), `npm run watch` (TS watch), `npm run test` (Jest)
- **Test single**: `cd infra && npx jest path/to/test.js`
- **CDK**: `cd infra && npm run deploy` (deploy all), `npm run deploy-project` (single project), `npm run deploy-with-projects` (with context)
- **CDK bootstrap**: `cd infra && npm run bootstrap` (single region), `npm run bootstrap-all` (multi-region), `npm run bootstrap-check` (verify)
- **CDK utils**: `cd infra && npm run diff/synth/list` (diff/synth/list stacks), `npm run destroy/destroy-project` (cleanup)

## Code Style Guidelines
- **JavaScript**: camelCase functions/vars, 4 spaces indent, semicolons required, single quotes, ES6+ features
- **TypeScript**: Strict mode, explicit types, optional props with `?`, target ES2020, commonjs modules
- **Imports**: ES6 modules, external first, relative with `./`, JSON with `{ type: 'json' }`, no default exports in TS
- **Error handling**: try-catch for async, console.error/warn logging, graceful degradation, validate inputs
- **HTML/CSS**: Semantic HTML5, kebab-case classes, data-i18n attrs, mobile-first design, BEM-like naming
- **Security**: Never innerHTML, prefer textContent/createElement, validate/sanitize inputs, avoid eval()
- **DOM**: Prefer createElement over innerHTML, use DocumentFragment for bulk ops, efficient selectors
- **Async**: async/await over Promises, proper error boundaries, avoid callback hell, Promise.all for concurrency
- **Build**: Vite single-file, Terser minification, assets inlined, emptyOutDir enabled, source maps in dev
- **CDK**: CDK v2, explicit env config, consistent tagging, DNS-safe names, context for project selection
- **Testing**: Jest for infra (not configured), focus integration tests, mock AWS services, descriptive test names
- **Performance**: Minimize bundle, lazy loading, optimize images, efficient DOM manipulation, requestAnimationFrame for animations
