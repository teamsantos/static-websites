# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev**: `npm run dev` (Vite hot reload)
- **Build**: `npm run build`, `PROJECT=name npm run build`, `TEMPLATE=name npm run build`
- **Preview**: `npm run preview`
- **Infra**: `cd infra && npm run build` (TS compile), `npm run watch` (TS watch), `npm run test` (Jest)
- **Test single**: `cd infra && npx jest path/to/test.js`
- **CDK**: `cd infra && npm run deploy/deploy-project/deploy-with-projects`
- **CDK utils**: `cd infra && npm run diff/synth/list/destroy`

## Code Style Guidelines
- **JavaScript**: camelCase, 4 spaces, semicolons, single quotes, ES6+, arrow functions, async/await
- **TypeScript**: Strict mode, explicit types, optional `?`, ES2020 target, commonjs modules, no default exports
- **Imports**: ES6 modules, external first, relative `./`, JSON `{ type: 'json' }`, destructure
- **Error handling**: try-catch async, console.error/warn, graceful degradation, validate inputs
- **HTML/CSS**: Semantic HTML5, kebab-case classes, data-i18n attrs, mobile-first, BEM naming
- **Security**: Never innerHTML, prefer textContent/createElement, validate inputs, no eval/secrets
- **DOM**: createElement over innerHTML, DocumentFragment for bulk, efficient selectors, event delegation
- **Build**: Vite single-file, Terser minify, assets inline, emptyOutDir, dev source maps
- **CDK**: CDK v2, explicit env, consistent tagging, DNS-safe names, context for projects
- **Testing**: Jest infra (unconfigured), integration focus, mock AWS, descriptive names
- **Performance**: Minimize bundle, lazy load, optimize images, efficient DOM, requestAnimationFrame
