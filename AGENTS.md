# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev**: `npm run dev` (Vite dev server), `npm run editor` (serve editor on port 3000), `cd infra && npm run watch` (TS watch mode)
- **Build**: `npm run build` (main build), `PROJECT=name npm run build` (project build), `TEMPLATE=name npm run build` (template build), `EDITOR_BUILD=true npm run build` (editor build)
- **Test**: `cd infra && npm run test` (Jest all tests), `cd infra && npx jest path/to/test.js` (single test), `cd infra && npm run build` (compile TS before testing)
- **CDK**: `cd infra && npm run deploy` (deploy all), `cd infra && npm run deploy-project` (deploy with context), `cd infra && npm run deploy-with-projects` (deploy with projects)
- **CDK utils**: `cd infra && npm run diff/synth/list/destroy/bootstrap/bootstrap-check`

## Code Style Guidelines
- **JavaScript**: camelCase vars/functions, 4 spaces indent, semicolons, single quotes, ES6+ features, arrow functions, async/await, classes over prototypes, IIFE patterns
- **TypeScript**: Strict mode enabled, explicit types, optional `?` for nullable, ES2020 target, commonjs modules, no default exports, interfaces extend cdk.StackProps
- **Imports**: ES6 modules, external imports first, relative with `./`, JSON imports with `{ type: 'json' }`, destructure imports, no unused imports, aws-cdk-lib/* pattern
- **Error handling**: try-catch with async, console.error/warn for logging, graceful degradation, validate inputs, descriptive error messages, early returns
- **HTML/CSS**: Semantic HTML5, kebab-case class names, data-i18n attributes, mobile-first responsive, BEM naming convention, no inline styles, CSS custom properties
- **Security/DOM**: Never use innerHTML, prefer textContent/createElement, validate all inputs, no eval() or Function(), sanitize data, ResizeObserver over resize events
- **Build**: Vite single-file plugin, Terser minification, assets inlined, emptyOutDir on build, dev source maps, single-file output, rollup input configuration
- **CDK/Testing**: CDK v2, explicit env regions, consistent resource tagging, DNS-safe names, context for projects, warn on invalid names, Jest unit tests
- **Performance**: Minimize bundle size, lazy load resources, optimize images, efficient DOM queries, requestAnimationFrame for animations, ResizeObserver, performance.now() timing
- **UX Patterns**: Template frames with hover-to-scroll (pointer-events disabled on hover), visual scroll indicators, smooth CSS animations, ripple effects on buttons
