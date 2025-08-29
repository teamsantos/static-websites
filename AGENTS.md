# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev server**: `npm run dev` (Vite)
- **Build**: `npm run build` (supports PROJECT/TEMPLATE env vars)
- **Preview**: `npm run preview`
- **Test infra**: `cd infra && npm test` (Jest)
- **Infra build**: `cd infra && npm run build` (TypeScript strict mode)
- **CDK deploy**: `cd infra && npm run deploy --context projects="project1,project2"`
- **CDK bootstrap**: `cd infra && npm run bootstrap` (or `bootstrap-all` for multi-region)
- **CDK diff**: `cd infra && npm run diff --context projects="project1,project2"`
- **CDK synth**: `cd infra && npm run synth` (generate CloudFormation templates)

## Code Style Guidelines
- **JavaScript/TypeScript**: camelCase functions/vars, PascalCase classes/interfaces, SCREAMING_SNAKE_CASE constants
- **Indentation**: 4 spaces, semicolons required, single quotes for strings
- **Imports**: ES6 modules, external libs first, relative paths with `./`, JSON with `{ type: 'json' }`
- **TypeScript**: Strict mode enabled, required type annotations, optional props with `?`
- **Error handling**: try-catch for async, console.error/warn for logging, graceful degradation
- **HTML/CSS**: Semantic HTML, kebab-case classes, data-i18n for i18n, mobile-first responsive
- **Security**: Avoid innerHTML, use textContent/createElement, efficient DOM manipulation
- **Build**: Vite with single-file plugin, Terser minification, CDK v2 with TypeScript
