# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev**: `npm run dev` (Vite), `npm run editor` (editor on port 3000), `cd infra && npm run watch` (TS watch)
- **Build**: `npm run build` (main), `PROJECT=name npm run build` (project), `TEMPLATE=name npm run build` (template), `EDITOR_BUILD=true npm run build` (editor)
- **Test**: `cd infra && npm run test` (all Jest tests), `cd infra && npx jest path/to/test.js` (single test)
- **CDK**: `cd infra && npm run deploy/deploy-project/deploy-with-projects` (deploy variants), `cd infra && npm run diff/synth/list/destroy` (CDK utils)

## Code Style Guidelines
- **JavaScript**: camelCase, 4 spaces, semicolons, single quotes, ES6+, arrow functions, async/await, classes
- **TypeScript**: Strict mode, explicit types, optional `?`, ES2020, commonjs, no default exports, interfaces extend cdk.StackProps
- **Imports**: ES6 modules, external first, relative with `./`, JSON with `{type:'json'}`, destructure, no unused, aws-cdk-lib/* pattern
- **Error handling**: try-catch with async, console.error/warn, graceful degradation, validate inputs, descriptive messages, early returns
- **HTML/CSS**: Semantic HTML5, kebab-case classes, data-i18n, mobile-first, BEM, no inline styles, CSS custom properties
- **Security/DOM**: Never innerHTML, prefer textContent/createElement, validate inputs, no eval/Function, sanitize data, ResizeObserver
- **Build**: Vite single-file plugin, Terser minification, assets inlined, emptyOutDir, dev source maps, single-file output
- **CDK/Testing**: CDK v2, explicit env regions, consistent tagging, DNS-safe names, context for projects, Jest unit tests
- **Performance**: Minimize bundle, lazy load, optimize images, efficient DOM queries, requestAnimationFrame, ResizeObserver, performance.now()
- **UX Patterns**: Hover-to-scroll frames (pointer-events disabled), visual scroll indicators, smooth animations, ripple effects

## Project Structure
- `app/`: Core JS modules (base.js, carousel.js, editor.js, script.js, template-loader.js)
- `infra/`: CDK infrastructure (TypeScript), deployment scripts, Jest tests
- `templates/`: HTML templates with assets, languages, build scripts
- `projects/`: Generated project sites from templates
- `styles/`: CSS files (base.css, editor.css, styles.css)
- `assets/`: Shared assets (languages, templates.json)
- `helpers/`: Build utilities (generateTemplates.js, htmlExtractor.js)
