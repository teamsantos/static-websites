# AGENTS.md - Static Websites Project

## Build/Lint/Test Commands

### Root Package Scripts
- **Development server**: `npm run dev` (Vite dev server)
- **Build project**: `npm run build` (Vite build)
- **Preview build**: `npm run preview` (Vite preview)
- **Build specific project**: `PROJECT=project-name npm run build`

### Infrastructure Scripts (infra/ directory)
- **Build TypeScript**: `cd infra && npm run build`
- **Watch mode**: `cd infra && npm run watch`
- **Run tests**: `cd infra && npm run test` (Jest)
- **CDK commands**:
  - Deploy: `cd infra && npm run deploy`
  - Deploy specific project: `cd infra && npm run deploy-project -- project-name`
  - Destroy: `cd infra && npm run destroy`
  - Diff: `cd infra && npm run diff`
  - Synth: `cd infra && npm run synth`

### Testing
- **Run all tests**: `cd infra && npm run test`
- **Run single test file**: `cd infra && npx jest path/to/test.js`
- **Watch tests**: `cd infra && npx jest --watch`

## Code Style Guidelines

### JavaScript/TypeScript
- **Syntax**: Modern ES6+ (arrow functions, template literals, destructuring, async/await)
- **Variables/Functions**: camelCase
- **Classes/Interfaces**: PascalCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Indentation**: 4 spaces (mix of 2 and 4 found, prefer 4 for consistency)
- **Semicolons**: Use semicolons
- **Quotes**: Single quotes for strings, double quotes for JSX attributes

### TypeScript Specific
- **Strict mode**: Enabled (noImplicitAny, strictNullChecks, etc.)
- **Interface naming**: PascalCase with 'I' prefix (e.g., `ProjectSiteProps`)
- **Type assertions**: Use angle bracket syntax when necessary
- **Optional properties**: Use `?` operator
- **Union types**: Use `|` separator

### Imports
- **ES6 modules**: `import { function } from './module'`
- **Default imports**: `import module from './module'`
- **JSON imports**: `import data from './file.json' with { type: 'json' }`
- **Relative paths**: Use `./` or `../` for local imports
- **Third-party**: Import from package name directly

### Error Handling
- **Try-catch blocks**: Use for async operations and potential runtime errors
- **Console logging**: Use `console.error()` for errors, `console.warn()` for warnings
- **Graceful degradation**: Handle missing elements/data gracefully
- **User feedback**: Provide meaningful error messages to users

### HTML/CSS
- **Semantic HTML**: Use proper semantic elements (`<section>`, `<header>`, `<footer>`)
- **Accessibility**: Include `aria-label`, `role`, and other accessibility attributes
- **Data attributes**: Use for i18n (`data-i18n`) and custom functionality
- **CSS classes**: Descriptive, kebab-case naming convention
- **Responsive design**: Mobile-first approach with media queries

### Best Practices
- **Modular code**: Break large functions into smaller, focused functions
- **Performance**: Use `requestAnimationFrame` for animations, optimize DOM queries
- **Memory management**: Clean up event listeners and observers when needed
- **Security**: Avoid innerHTML when possible, validate user inputs
- **Documentation**: Add comments for complex logic, especially in CDK infrastructure

### File Organization
- **JavaScript**: `app/` directory for main application code
- **Infrastructure**: `infra/` directory for CDK and deployment code
- **Assets**: `assets/` for static files (images, translations)
- **Projects**: `projects/` for individual project files
- **Styles**: `styles/` for CSS files

### Git Workflow
- **Branch naming**: feature/, bugfix/, hotfix/ prefixes
- **Commit messages**: Clear, descriptive messages in imperative mood
- **Pull requests**: Include description of changes and testing done