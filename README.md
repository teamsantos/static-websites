# Static Website Creator

**Easily create and deploy static websites using ready-made templates or custom designs.**

## 🚀 What It Does

This tool lets users:
- 📁 **Choose from our pre-made website templates**
- 🖼️ **Upload images and content** to populate the templates
- 🧑‍🎨 **Request a custom website design** if the templates don’t fit your needs

No coding required. Just pick, upload, and go live.

---

## 🌐 Live Examples

Check out some sites we've already built:
<!-- - [Example 1 – Portfolio](https://example.com/portfolio) -->
<!-- - [Example 2 – Small Business](https://example.com/business) -->
<!-- - [Example 3 – Event Page](https://example.com/event) -->

---

## 🧰 Features

- ✅ Static site generation with customizable content
- 🎨 Multiple responsive design templates
- 📦 Image and text upload support
- 🛠 Optional custom site requests
- ⚡ Fast and lightweight deployment

---

## 📸 How It Works

1. **Pick a template** from the available options
2. **Upload** your images and text
3. **Generate** your static site
4. **(Optional)** Request a fully custom design

---

## 🛠 Technical Architecture

### Build System
- **Frontend**: Vite for fast development and optimized production builds
- **Single-file bundles**: All assets inlined for instant loading
- **Template processing**: Custom HTML extraction and processing scripts
- **Multi-environment builds**: Support for projects, templates, and editor builds

### Infrastructure
- **AWS CDK v2**: Infrastructure as Code for cloud deployment
- **S3 + CloudFront**: Static website hosting with global CDN
- **Route 53**: DNS management for custom domains
- **SSL/TLS**: Automatic certificate provisioning via AWS Certificate Manager

### Project Structure
```
├── app/              # Core JavaScript modules
├── infra/            # CDK infrastructure (TypeScript)
├── templates/        # HTML templates with assets
├── projects/         # Generated websites from templates
├── styles/           # Shared CSS stylesheets
├── assets/           # Shared assets (languages, templates.json)
└── helpers/          # Build utilities and scripts
```

---

## 🚀 Development

### Quick Start
```bash
# Install dependencies
npm install
cd infra && npm install

# Start development server
npm run dev

# Start template editor
npm run editor
```

### Build Commands
```bash
# Build main site
npm run build

# Build specific project
PROJECT=myproject npm run build

# Build specific template
TEMPLATE=templatename npm run build

# Build editor interface
EDITOR_BUILD=true npm run build
```

### Infrastructure Deployment
```bash
# Deploy to AWS (requires AWS CLI configured)
cd infra
npm run deploy

# Deploy specific project
npm run deploy-project PROJECT_NAME=your-project

# View deployment status
npm run diff
```

---

## 📩 Request a Custom Website

Want something unique? We offer custom-built static websites tailored to your brand and needs.

📧 Contact us at: [filipesantosdev@gmail.com]
