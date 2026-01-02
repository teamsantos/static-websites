# Quick Reference: Multi-Tenant Architecture

## 🚀 Deploy for the First Time

```bash
# 1. Go to GitHub Actions
# 2. Run "Deploy Projects (Optimized)" workflow
# 3. Under "Inputs", set: deploy_infrastructure = true
# 4. Click "Run workflow"

# Expected time: ~2-3 minutes
# This creates:
#   - Shared CloudFront distribution
#   - CloudFront Function for URL rewriting
#   - Wildcard certificate *.e-info.click
```

## 📝 Add a New Project

```bash
# 1. Create directory
mkdir projects/newproject

# 2. Add HTML/CSS/JS
echo "<h1>My Site</h1>" > projects/newproject/index.html

# 3. Push
git add .
git commit -m "Add newproject"
git push

# 4. Wait ~30-60 seconds
# GitHub Actions automatically deploys to: https://newproject.e-info.click
```

## 📦 Update Project Content

```bash
# 1. Edit files
echo "<h1>Updated</h1>" > projects/brunodi4gay/index.html

# 2. Push
git add .
git commit -m "Update brunodi4gay"
git push

# 3. Wait ~30-60 seconds
# Changes live at: https://brunodi4gay.e-info.click
```

## 🔍 How It Works

```
Request: https://brunodi4gay.e-info.click/
         ↓
Route53: CNAME → CloudFront Distribution
         ↓
CloudFront Function: Rewrites to /brunodi4gay/
         ↓
S3: Returns /brunodi4gay/index.html
         ↓
Browser: Shows content (URL unchanged)
```

## 📊 Deployment Speeds

| Action | Time | When |
|--------|------|------|
| First Setup | 2-3 min | Once, with `deploy_infrastructure=true` |
| New Project | 30-60 sec | Always automatic |
| Content Update | 30-60 sec | Always automatic |
| HTML Rebuild | 10-30 sec | Included in deployment |

## 🔧 Manual CDK Commands

```bash
cd infra

# Deploy infrastructure (do this once)
cdk deploy MultiTenantDistribution --require-approval never

# Deploy new projects
cdk deploy --context projects=newproject,another-project --require-approval never

# Check what would change
cdk diff --context projects=myproject
```

## 📍 S3 Structure (Unchanged)

```
s3://teamsantos-static-websites/
├── brunodi4gay/          ← Route: https://brunodi4gay.e-info.click
│   └── index.html
├── bruno/                ← Route: https://bruno.e-info.click
│   └── index.html
└── mynewproject/         ← Route: https://mynewproject.e-info.click
    └── index.html
```

## 🌐 Accessing Projects

All projects use the same format:
```
https://<projectname>.e-info.click
```

Examples:
- `https://brunodi4gay.e-info.click`
- `https://bruno.e-info.click`
- `https://brunodi4gay-gay.e-info.click`

## 💾 What Gets Deployed

### Infrastructure (1 time only)
- 1 CloudFront Distribution (shared by all projects)
- 1 CloudFront Function (URL rewriting)
- 1 Wildcard Certificate (*.e-info.click)
- S3 Bucket (existing)

### Per Project (each time)
- 1 Route53 CNAME record
- Project files in S3

## 🧪 Test Your Setup

```bash
# Test project is live
curl -I https://brunodi4gay.e-info.click/

# Check DNS resolution
nslookup brunodi4gay.e-info.click

# View CloudFront logs (if enabled)
aws cloudformation describe-stacks --stack-name MultiTenantDistribution
```

## ⚡ Performance

- **Cache Hit**: <100ms (CloudFront edge)
- **Cache Miss**: 200-500ms (S3 origin)
- **Cache Duration**: 24 hours (static assets)
- **Invalidation**: <60 seconds (after deployment)

## 🎯 Workflow Status

GitHub Actions shows deployment status:

```
✅ detect-changes    (identify changed projects)
├─ deploy-infrastructure (skip unless deploy_infrastructure=true)
└─ deploy-projects  
   ├─ Install dependencies
   ├─ Build projects
   ├─ Sync to S3
   ├─ Invalidate cache
   └─ Done! Sites live
```

## 🔑 Key Files

- `infra/MultiTenantDistributionStack.ts` - Shared distribution
- `infra/ProjectStack.ts` - Per-project Route53 records
- `infra/index.ts` - CDK orchestration
- `.github/workflows/publish-project.yml` - Automated deployment

## 💡 Tips

1. **First time?** Run workflow with `deploy_infrastructure=true`
2. **No response?** Wait 30 seconds and refresh (cache propagation)
3. **404 errors?** Check S3 bucket has `/projectname/index.html`
4. **DNS issues?** Run `nslookup projectname.e-info.click`
5. **Need to redeploy?** Push changes and let GitHub Actions handle it

## 🚨 Troubleshooting

**Project not accessible:**
```bash
# Check S3
aws s3 ls s3://teamsantos-static-websites/myproject/

# Check Route53
aws route53 list-resource-record-sets --hosted-zone-id Z0068973FIJHW12TF0OH

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id E26O9PL7BWCRK7 \
  --paths "/*"
```

**Wrong files being served:**
- Clear your browser cache (Ctrl+Shift+Delete)
- Or use incognito window
- Or wait 24 hours for CloudFront cache to expire

**Certificate errors:**
- Certificate is automatic and reused
- Stored in Parameter Store: `/acm/certificates/e-info.click`

---

**Questions?** Check MIGRATION.md for detailed documentation
