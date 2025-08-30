# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev server**: `npm run dev` (Vite with hot reload)
- **Build project**: `PROJECT=name npm run build` (builds specific project)
- **Build template**: `TEMPLATE=name npm run build` (builds specific template)
- **Build all**: `npm run build` (builds main site)
- **Preview**: `npm run preview` (preview built site)
- **Infra build**: `cd infra && npm run build` (TypeScript compilation)
- **Infra watch**: `cd infra && npm run watch` (TypeScript watch mode)
- **Infra test**: `cd infra && npm test` (Jest test runner - no tests currently configured)
- **Test single file**: `cd infra && npx jest path/to/test.js` (when test files exist)
- **Test watch mode**: `cd infra && npx jest --watch` (when test files exist)
- **CDK deploy**: `cd infra && npm run deploy --context projects="project1,project2"`
- **CDK bootstrap**: `cd infra && npm run bootstrap` (single region)
- **CDK bootstrap all**: `cd infra && npm run bootstrap-all` (multi-region)
- **CDK diff**: `cd infra && npm run diff --context projects="project1,project2"`
- **CDK synth**: `cd infra && npm run synth` (generate CloudFormation)
- **CDK list**: `cd infra && npm run list` (list stacks)

## Code Style Guidelines
- **JavaScript/TypeScript**: camelCase functions/vars, PascalCase classes/interfaces, SCREAMING_SNAKE_CASE constants
- **Indentation**: 4 spaces (no tabs), semicolons required, single quotes for strings
- **Imports**: ES6 modules, external libs first, relative paths with `./`, JSON imports with `{ type: 'json' }`
- **TypeScript**: Strict mode enabled, explicit type annotations, optional props with `?`, target ES2020
- **Error handling**: try-catch for async operations, console.error/warn for logging, graceful degradation
- **HTML/CSS**: Semantic HTML5, kebab-case CSS classes, data-i18n attributes for i18n, mobile-first responsive design
- **Security**: Never use innerHTML, prefer textContent/createElement, validate user inputs, avoid eval()
- **Build system**: Vite with single-file plugin, Terser minification, assets inlined, emptyOutDir enabled
- **Async patterns**: Use async/await over Promises, proper error boundaries, avoid callback hell
- **DOM manipulation**: Prefer createElement/textContent over innerHTML, use DocumentFragment for bulk operations
- **CDK patterns**: Use CDK v2, explicit environment config, consistent tagging, DNS-safe project names
- **Testing**: Jest for infra tests (currently not configured), focus on integration tests, mock AWS services when needed
- **File organization**: Separate concerns (app/, infra/, templates/), consistent naming conventions
- **Performance**: Minimize bundle size, use lazy loading, optimize images, efficient DOM manipulation
