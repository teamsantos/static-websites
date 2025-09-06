# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev**: `npm run dev` (Vite), `npm run editor` (serve), `cd infra && npm run watch` (TS watch)
- **Build**: `npm run build`, `PROJECT=name npm run build`, `TEMPLATE=name npm run build`
- **Preview**: `npm run preview`
- **Infra**: `cd infra && npm run build` (TS compile), `npm run test` (Jest all), `npx jest path/to/test.js` (single test)
- **CDK**: `cd infra && npm run deploy/deploy-project/deploy-with-projects`
- **CDK utils**: `cd infra && npm run diff/synth/list/destroy/bootstrap/bootstrap-check`

## File Organization
- **Template Editor**: `template-editor.html` (clean HTML), `app/editor.js` (logic), `styles/editor.css` (styles)
- **Main Site**: `index.html`, `app/script.js`, `styles/styles.css`
- **Shared Styles**: `styles/base.css` (common CSS variables, reset, buttons, animations)
- **Shared Scripts**: `app/base.js` (common JS utilities, stars animation, language detection, UI effects)
- **Templates**: `templates/` directory with individual template folders
- **Projects**: `projects/` directory for built/deployed projects

## Code Style Guidelines
- **JavaScript**: camelCase, 4 spaces, semicolons, single quotes, ES6+, arrow functions, async/await, IIFE patterns
- **TypeScript**: Strict mode, explicit types, optional `?`, ES2020 target, commonjs modules, no default exports
- **Imports**: ES6 modules, external first, relative `./`, JSON `{ type: 'json' }`, destructure, no unused imports
- **Error handling**: try-catch async, console.error/warn, graceful degradation, validate inputs, descriptive messages
- **HTML/CSS**: Semantic HTML5, kebab-case classes, data-i18n attrs, mobile-first, BEM naming, no inline styles
- **Security/DOM**: Never innerHTML, prefer textContent/createElement, validate inputs, no eval/secrets, sanitize data, DocumentFragment for bulk, efficient selectors, event delegation, passive listeners
- **Build**: Vite single-file, Terser minify, assets inline, emptyOutDir, dev source maps, single-file output
- **CDK/Testing**: CDK v2, explicit env, consistent tagging, DNS-safe names, context for projects, warn on invalid names. Jest infra (default config), integration focus, mock AWS, descriptive names, error case coverage
- **Performance**: Minimize bundle, lazy load, optimize images, efficient DOM, requestAnimationFrame, ResizeObserver
