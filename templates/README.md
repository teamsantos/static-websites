# Templates System

This directory contains the dynamic template system for the static website generator. Templates are self-contained and loaded dynamically from their respective folders.

## Structure

```
templates/
├── buildTemplates.sh         # Script to build all templates
├── README.md                 # This file
├── businessCard/             # Business card template
│   ├── index.html            # Template HTML structure
│   ├── assets/
│   │   └── images.json       # Image configuration
│   ├── images/               # Template images
│   └── langs/
│       └── en.json           # English translations
├── bussinessCardTest/        # Test business card template
│   ├── .commingsoon          # Coming soon marker
│   ├── index.html
│   ├── assets/images.json
│   ├── images/
│   └── langs/en.json
└── modern-header/            # Modern header template
    ├── index.html
    ├── assets/images.json
    ├── langs/en.json
    └── README.md
```

## How It Works

1. **Registry System**: `../assets/templates.json` contains metadata about all available templates
2. **Build Process**: `buildTemplates.sh` processes templates using `../helpers/htmlExtractor.js`
3. **Language Support**: Each template has its own language files in `langs/` directory
4. **Image Management**: Templates use `assets/images.json` for image configuration

## Adding a New Template

### 1. Create Template Folder
```bash
mkdir templates/your-template-name
```

### 2. Create Required Files

#### index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title id="title">Your Template Title</title>
    <meta id="description" name="description" content="Your template description">
    <!-- Your template content -->
</head>
<body>
    <!-- Template HTML structure -->
</body>
</html>
```

#### langs/en.json
```json
{
  "title": "Your Template Title",
  "description": "Your template description",
  "heroTitle": "Hero Title",
  "heroDescription": "Hero description text"
}
```

#### assets/images.json
```json
{
  "image_1": "./images/hero-image.jpg",
  "image_2": "./images/about-image.jpg",
  "image_3": "https://example.com/external-image.jpg"
}
```

### 3. Update Registry
Add your template to `../assets/templates.json`:

```json
{
  "name": "your-template-name",
  "comingSoon": false,
  "title": "Display Name",
  "description": "Template description"
}
```

### 4. Add Images
Place your template images in the `images/` directory and reference them in `assets/images.json`.

## Image Configuration

Templates use a simple key-value system in `assets/images.json`:

```json
{
  "image_1": "./images/hero-image.jpg",
  "image_2": "./images/about-image.jpg",
  "image_3": "https://external-image-url.com/image.jpg"
}
```

Images can be:
- Local files in the template's `images/` directory
- External URLs
- Referenced by key in the template HTML

## Language Support

Templates support multiple languages through language files in the `langs/` directory:
- `en.json` - English translations
- Currently only English is supported, but the structure allows for additional languages

## Template Features

Templates can include:
- **Hero sections** with titles and descriptions
- **About sections** with company/team information
- **Services** or **Projects** grids
- **Contact forms** with validation
- **Image galleries**
- **Testimonials** and reviews
- **Statistics** and metrics

## Build Process

Templates are built using the `buildTemplates.sh` script which:
1. Processes each template directory
2. Uses `../helpers/htmlExtractor.js` to extract and process content
3. Runs `TEMPLATE=name npm run build` for each template
4. Generates optimized single-file builds

## Best Practices

1. **Use semantic HTML** with proper headings and structure
2. **Include proper meta tags** for SEO
3. **Test responsiveness** on different screen sizes
4. **Use consistent naming** for CSS classes
5. **Include proper alt text** for accessibility
6. **Optimize images** for web delivery

## Deployment

Templates are built into single-file HTML bundles using Vite and deployed as static files. The build process inlines all assets and minifies the output for optimal performance.
