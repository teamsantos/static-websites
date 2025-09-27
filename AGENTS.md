# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev**: `npm run dev` (Vite), `npm run editor` (port 3000), `cd infra && npm run watch` (TS)
- **Build**: `npm run build`, `PROJECT=name npm run build`, `TEMPLATE=name npm run build`, `EDITOR_BUILD=true npm run build`
- **Test**: `cd infra && npm run test` (Jest), `cd infra && npx jest path/to/test.js` (single test)
- **CDK**: `cd infra && npm run deploy/deploy-project/deploy-with-projects/diff/synth/list/destroy`

## Code Style Guidelines
- **JavaScript**: camelCase, 4 spaces, semicolons, single quotes, ES6+, arrow functions, async/await
- **TypeScript**: Strict mode, explicit types, optional `?`, ES2020, commonjs, no default exports
- **Imports**: ES6 modules, external first, relative `./`, JSON `{type:'json'}`, destructure, no unused
- **Error handling**: try-catch async, console.error/warn, validate inputs, early returns
- **HTML/CSS**: Semantic HTML5, kebab-case classes, data-i18n, mobile-first, BEM, no inline styles
- **Security**: Never innerHTML, prefer textContent/createElement, no eval/Function, sanitize data
- **Build**: Vite single-file, Terser minify, assets inline, emptyOutDir, dev sourcemaps
- **CDK**: CDK v2, explicit env regions, DNS-safe names, Jest tests
- **Performance**: Minimize bundle, lazy load, efficient DOM, requestAnimationFrame, ResizeObserver

## Project Structure
- `app/`: Core JS modules | `infra/`: CDK infrastructure (TS), Jest tests
- `templates/`: HTML templates with assets/languages | `projects/`: Generated sites from templates
- `styles/`: CSS files | `assets/`: Shared assets (languages, templates.json) | `helpers/`: Build utilities
