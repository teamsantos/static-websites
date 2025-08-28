# Static Websites Project - Agent Guidelines

## Build/Test Commands
- **Dev server**: `npm run dev` (Vite)
- **Build**: `npm run build` (supports PROJECT/TEMPLATE env vars)
- **Preview**: `npm run preview`
- **Infra build**: `cd infra && npm run build` (TypeScript strict mode)
- **Test**: `cd infra && npm run test` (Jest)
- **Single test**: `cd infra && npx jest path/to/test.js`
- **CDK deploy**: `cd infra && npm run deploy --context projects="project1,project2"`
- **CDK bootstrap**: `cd infra && npm run bootstrap`
- **CDK diff**: `cd infra && npm run diff --context projects="project1,project2"`

## Code Style Guidelines

### JavaScript/TypeScript
- **Language version**: ES6+ features, modern syntax
- **Variables/Functions**: camelCase (e.g., `addRippleEffect`, `setupTiltEffects`)
- **Classes/Interfaces**: PascalCase (e.g., `ProjectSite`, `MineProjectSiteProps`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `PROJECT_NAME`)
- **Indentation**: 4 spaces (no tabs)
- **Quotes**: Single quotes for strings, double quotes for JSX attributes
- **Semicolons**: Required at end of statements

### Imports and Modules
- **ES6 modules**: Use `import`/`export` syntax
- **Relative paths**: Start with `./` for local imports
- **JSON imports**: Use `with { type: 'json' }` syntax
- **CDK imports**: Group AWS CDK imports by service
- **Import order**: External libraries first, then local imports

### TypeScript Specific
- **Strict mode**: Enabled in tsconfig.json
- **Interface naming**: PascalCase with descriptive names
- **Optional props**: Use `?` for optional interface properties
- **Type annotations**: Required for function parameters and return types
- **Generic types**: Use when appropriate for type safety

### Error Handling
- **Async operations**: Use try-catch blocks
- **Logging**: `console.error` for errors, `console.warn` for warnings
- **Graceful degradation**: Handle failures without breaking the application
- **User feedback**: Provide meaningful error messages when possible

### HTML/CSS
- **Semantic HTML**: Use appropriate semantic elements
- **CSS classes**: kebab-case (e.g., `template-card`, `feature-item`)
- **Internationalization**: Use `data-i18n` attributes for translatable content
- **Responsive design**: Mobile-first approach
- **Animations**: Use `requestAnimationFrame` for smooth animations

### Best Practices
- **Modular functions**: Break down complex logic into smaller, reusable functions
- **Security**: Avoid `innerHTML`, use textContent or createElement
- **Performance**: Use efficient DOM manipulation and event handling
- **Accessibility**: Include proper ARIA attributes and semantic markup
- **Environment variables**: Use PROJECT/TEMPLATE env vars for build targeting

### File Organization
- **Main app**: `/app/` directory for application logic
- **Assets**: `/assets/` for static assets and translations
- **Infrastructure**: `/infra/` for CDK and deployment code
- **Projects**: `/projects/` for individual project builds
- **Templates**: `/templates/` for reusable templates
- **Styles**: `/styles/` for CSS files

### Build Configuration
- **Vite**: Main build tool with custom plugins for HTML and single-file builds
- **Terser**: Minification with compression and mangling enabled
- **CDK**: AWS CDK v2 with TypeScript compilation
- **Environment targeting**: Support for PROJECT and TEMPLATE environment variables
