# Template Screenshot Generator

This directory contains automation scripts for managing template screenshots.

## Scripts

### `generate-screenshots.js`

Automatically generates WebP screenshots for all templates defined in `assets/templates.json`.

**Features:**
- Captures 800x600 screenshots using Playwright
- Saves to `templates/<template-name>/assets/images/screenshot/index.webp`
- Skips templates marked as "coming soon"
- Optimized WebP output at 80% quality
- Runs automatically via GitHub Actions on template changes

**Manual Usage:**

```bash
# Install dependencies first (if not already installed)
npm install

# Run the screenshot generator
npm run screenshots

# Or run directly
node scripts/generate-screenshots.js
```

**Environment Variables:**
- `BASE_URL`: Base URL for templates (default: `template.e-info.click`)

**Output:**
Each template will have a screenshot saved at:
```
templates/<template-name>/assets/images/screenshot/index.webp
```

## GitHub Actions

Screenshots are automatically generated via the `generate-screenshots.yml` workflow when:
- Files in `templates/` directory change
- `assets/templates.json` is modified
- Manually triggered via workflow dispatch
- Weekly on Monday at 2 AM UTC (scheduled maintenance)

The workflow will:
1. Install dependencies
2. Install Playwright browser
3. Generate all screenshots
4. Commit and push changes back to the repository

## Adding New Templates

When adding a new template:

1. Add the template to `assets/templates.json`:
```json
{
  "name": "template-name",
  "comingSoon": false,
  "title": "Template Title",
  "description": "Template description",
  "screenshot": "templates/template-name/assets/images/screenshot/index.webp"
}
```

2. Create the template directory structure:
```bash
mkdir -p templates/template-name/assets/images/screenshot
```

3. Either:
   - Run `npm run screenshots` locally, or
   - Push changes and let GitHub Actions generate the screenshot automatically

## Troubleshooting

**Screenshot generation fails:**
- Ensure the template URL is accessible at `https://<template-name>.template.e-info.click`
- Check that Playwright browsers are installed: `npx playwright install chromium`
- Verify the template directory exists in `templates/`

**Screenshots not updating:**
- Clear browser cache if testing locally
- Check GitHub Actions logs for errors
- Ensure the workflow has write permissions to commit changes
