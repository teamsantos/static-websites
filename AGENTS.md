# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev**: `npm run dev` (Vite), `npm run editor` (serve port 3000), `cd infra && npm run watch` (TS watch)
- **Build**: `npm run build` (main), `PROJECT=name npm run build` (project), `TEMPLATE=name npm run build` (template), `EDITOR_BUILD=true npm run build` (editor)
- **Test**: `cd infra && npm run test` (Jest all), `cd infra && npx jest path/to/test.js` (single test)
- **CDK**: `cd infra && npm run deploy/deploy-project/deploy-with-projects`
- **CDK utils**: `cd infra && npm run diff/synth/list/destroy/bootstrap/bootstrap-check`

## Code Style Guidelines
- **JavaScript**: camelCase, 4 spaces, semicolons, single quotes, ES6+, arrow functions, async/await, IIFE patterns, classes over prototypes
- **TypeScript**: Strict mode, explicit types, optional `?`, ES2020 target, commonjs modules, no default exports, interface extends cdk.StackProps
- **Imports**: ES6 modules, external first, relative `./`, JSON `{ type: 'json' }`, destructure, no unused imports, aws-cdk-lib/* pattern
- **Error handling**: try-catch async, console.error/warn, graceful degradation, validate inputs, descriptive messages, early returns
- **HTML/CSS**: Semantic HTML5, kebab-case classes, data-i18n attrs, mobile-first, BEM naming, no inline styles, CSS custom properties
- **Security/DOM**: Never innerHTML, prefer textContent/createElement, validate inputs, no eval/secrets, sanitize data, ResizeObserver over resize events
- **Build**: Vite single-file, Terser minify, assets inline, emptyOutDir, dev source maps, single-file output, rollup input configuration
- **CDK/Testing**: CDK v2, explicit env, consistent tagging, DNS-safe names, context for projects, warn on invalid names, Jest for unit tests
- **Performance**: Minimize bundle, lazy load, optimize images, efficient DOM, requestAnimationFrame, ResizeObserver, performance.now() timing
- **UX Patterns**: Template frames support hover-to-scroll (pointer-events disabled on hover), visual scroll indicators, smooth animations
