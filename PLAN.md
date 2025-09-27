# Project Creation Lambda Implementation Plan

## Completed Tasks ✅

- **Create Lambda function stack with API Gateway integration**
  - Created `CreateProjectStack.ts` with Lambda function and API Gateway
  - Configured proper IAM permissions for SES and Secrets Manager

- **Implement Lambda handler to check project existence, create files, commit, send email**
  - Implemented handler in `infra/lambda/create-project/index.js`
  - Handles project existence check, file creation, GitHub commits, and email sending

- **Add GitHub API integration using Octokit for file operations**
  - Integrated @octokit/rest for GitHub API operations
  - Handles checking project existence and creating files via API

- **Add SES integration for sending confirmation emails**
  - Configured AWS SES for sending emails
  - Sends confirmation email with website URL

- **Configure environment variables for GitHub owner/repo and from email**
  - Moved GitHub config to AWS Secrets Manager
  - Environment variables now reference secrets securely

## Pending Tasks ⏳

- **Create GitHub token secret in AWS Secrets Manager**
  - Create secret named `github-token` with your GitHub personal access token
  - Ensure token has `repo` permissions

- **Verify and configure SES for sending emails**
  - Verify the `FROM_EMAIL` address in SES
  - Ensure SES is configured in the correct region

- **Deploy the CDK stack to AWS**
  - Run `cd infra && npm run deploy` to deploy the stack
  - Test the API endpoint with sample requests

## API Usage

Once deployed, the Lambda can be called via POST to the API Gateway URL with:

```json
{
  "html": "<html-string>",
  "email": "<user-email>",
  "name": "<project-name>"
}
```

Response on success:
```json
{
  "url": "<project-name>.e-info.click"
}
```

## Secrets Required

1. **github-token**: Plaintext secret with GitHub PAT
2. **github-config**: Key-value pairs with `owner` and `repo`