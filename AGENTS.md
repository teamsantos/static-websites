# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev server**: `npm run dev` (Vite)
- **Build**: `npm run build`
- **Preview**: `npm run preview`
- **Infra build**: `cd infra && npm run build` (TypeScript)
- **Test**: `cd infra && npm run test` (Jest)
- **Single test**: `cd infra && npx jest path/to/test.js`
- **CDK deploy**: `cd infra && npm run deploy`

## Code Style
- **JS/TS**: ES6+, camelCase vars/functions, PascalCase classes/interfaces
- **Constants**: SCREAMING_SNAKE_CASE
- **Indentation**: 4 spaces
- **Quotes**: Single for strings, double for JSX
- **Imports**: ES6 modules, relative paths with `./`, JSON with `with { type: 'json' }`
- **TypeScript**: Strict mode, PascalCase interfaces, optional props with `?`
- **Error handling**: Try-catch for async, console.error/warn, graceful degradation
- **HTML/CSS**: Semantic HTML, kebab-case classes, data-i18n attributes, mobile-first
- **Best practices**: Modular functions, requestAnimationFrame for animations, avoid innerHTML