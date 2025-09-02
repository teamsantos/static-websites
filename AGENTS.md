# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev server**: `npm run dev` (Vite with hot reload)
- **Build**: `npm run build` (main), `PROJECT=name npm run build` (project), `TEMPLATE=name npm run build` (template)
- **Preview**: `npm run preview`
- **Infra**: `cd infra && npm run build` (TS compile), `npm run watch` (TS watch), `npm test` (Jest)
- **Test single**: `cd infra && npx jest path/to/test.js`
- **CDK**: `cd infra && npm run deploy` (deploy), `npm run bootstrap` (single region), `npm run bootstrap-all` (multi-region)
- **CDK utils**: `cd infra && npm run diff/synth/list` (diff/synth/list stacks)

## Code Style Guidelines
- **JavaScript**: camelCase functions/vars, 4 spaces indent, semicolons required, single quotes
- **TypeScript**: Strict mode, explicit types, optional props with `?`, target ES2020
- **Imports**: ES6 modules, external first, relative with `./`, JSON with `{ type: 'json' }`
- **Error handling**: try-catch for async, console.error/warn logging, graceful degradation
- **HTML/CSS**: Semantic HTML5, kebab-case classes, data-i18n attrs, mobile-first design
- **Security**: Never innerHTML, prefer textContent/createElement, validate inputs, avoid eval()
- **DOM**: Prefer createElement over innerHTML, use DocumentFragment for bulk ops
- **Async**: async/await over Promises, proper error boundaries, avoid callback hell
- **Build**: Vite single-file, Terser minification, assets inlined, emptyOutDir enabled
- **CDK**: CDK v2, explicit env config, consistent tagging, DNS-safe names
- **Testing**: Jest for infra (not configured), focus integration tests, mock AWS services
- **Performance**: Minimize bundle, lazy loading, optimize images, efficient DOM manipulation
