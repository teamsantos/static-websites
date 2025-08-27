# Templates System

This directory contains the dynamic template system for the static website generator. Templates are self-contained and loaded dynamically from their respective folders.

## Structure

```
templates/
├── templates-registry.json    # Central registry of all templates
├── manage-templates.js       # Utility script for managing templates
├── README.md                 # This file
├── business/        # Example business template
│   ├── index.html           # Template HTML structure
│   ├── lang_en.json         # English translations
│   ├── lang_pt.json         # Portuguese translations
│   └── images.json          # Image configuration
└── portfolio/      # Example portfolio template
    ├── index.html
    ├── lang_en.json
    ├── lang_pt.json
    └── images.json
```

## How It Works

1. **Registry System**: `templates-registry.json` contains metadata about all available templates
2. **Dynamic Loading**: Templates are loaded from their individual folders at runtime
3. **Language Support**: Each template has its own language files
4. **Image Management**: Templates can have single images, arrays, or carousels

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
    <title data-i18n="title"></title>
    <link rel="stylesheet" href="../../styles/styles.css">
    <script type="module" src="../../app/template-loader.js"></script>
</head>
<body data-template="your-template-name">
    <!-- Your template content -->
</body>
</html>
```

#### lang_en.json
```json
{
  "name": "Your Template Name",
  "title": "Page Title",
  "hero": {
    "title": "Hero Title",
    "description": "Hero description"
  }
}
```

#### images.json
```json
{
  "hero": {
    "type": "single",
    "src": "./templates/your-template-name/hero-image.jpg",
    "alt": "Hero image description"
  },
  "gallery": {
    "type": "carousel",
    "images": [
      {
        "src": "./templates/your-template-name/image1.jpg",
        "alt": "Gallery image 1"
      }
    ]
  }
}
```

### 3. Update Registry
Add your template to `templates-registry.json`:

```json
{
  "id": "your-template-name",
  "name": "Display Name",
  "subTitle": "Category",
  "description": "Template description",
  "imageURL": "./assets/your-template-icon.svg",
  "url": "./templates/your-template-name/",
  "template": "your-template-name",
  "featured": false,
  "order": 3,
  "category": "business"
}
```

### 4. Add Placeholder Images
Create SVG placeholder images in your template folder:
- `hero-image.svg`
- `about-image.svg`
- `gallery1.svg`, `gallery2.svg`, etc.

## Image Types

### Single Image
```json
{
  "type": "single",
  "src": "./templates/template-name/image.jpg",
  "alt": "Image description",
  "fallback": "./assets/placeholder.jpg"
}
```

### Image Array
```json
{
  "type": "array",
  "images": [
    {
      "src": "./templates/template-name/image1.jpg",
      "alt": "Image 1",
      "fallback": "./assets/placeholder.jpg"
    }
  ]
}
```

### Carousel
```json
{
  "type": "carousel",
  "images": [
    {
      "src": "./templates/template-name/image1.jpg",
      "alt": "Carousel image 1"
    }
  ],
  "autoplay": true,
  "interval": 5000,
  "showDots": true,
  "showArrows": true
}
```

## Language Support

Templates support multiple languages through separate language files:
- `lang_en.json` - English
- `lang_pt.json` - Portuguese
- Add more languages by creating additional `lang_xx.json` files

## Template Features

Templates can include:
- **Hero sections** with titles and descriptions
- **About sections** with company/team information
- **Services** or **Projects** grids
- **Contact forms** with validation
- **Image galleries** and carousels
- **Testimonials** and reviews
- **Statistics** and metrics

## Best Practices

1. **Use semantic HTML** with proper headings and structure
2. **Include data-i18n attributes** for all user-facing text
3. **Provide fallback images** for better error handling
4. **Test responsiveness** on different screen sizes
5. **Use consistent naming** for CSS classes
6. **Include proper alt text** for accessibility

## Management Script

Use `manage-templates.js` to help manage templates:

```javascript
const manager = new TemplateManager();

// Add a new template
await manager.addTemplate(templateData);

// List all templates
const templates = await manager.listTemplates();

// Validate template structure
const validation = await manager.validateTemplate('template-id');
```

## Deployment

Templates are served as static files and loaded dynamically. No server-side processing is required. The system works entirely in the browser using JavaScript modules and fetch API.
