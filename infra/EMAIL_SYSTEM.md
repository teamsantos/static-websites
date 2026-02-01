# Phase 4.6: Email Notification System

## Overview

The Email Notification System provides transactional email capabilities using AWS SES. It sends user notifications at key points in the website creation workflow:

- **Welcome emails** - New users
- **Payment confirmations** - After successful payment
- **Generation status** - When website generation starts, completes, or fails
- **Deployment alerts** - When website is deployed to production

## Architecture

### Components

1. **EmailService Module** (`shared/emailService.js`)
   - 6 email template functions
   - HTML email generation with embedded CSS
   - Plain text fallback generation
   - AWS SES integration

2. **SendEmail Lambda** (`lambda/send-email/index.js`)
   - Entry point for all email operations
   - Handles direct invocation, SQS, and SNS events
   - Dispatches to appropriate email template
   - Returns message ID and status

3. **EmailTemplateStack** (`EmailTemplateStack.ts`)
   - CDK stack defining SendEmail Lambda
   - SES permissions configuration
   - CloudWatch logging integration
   - Lambda invoke grants for other services

### Email Types

#### 1. Welcome Email
**Sent to**: New users registering for the first time  
**Content**: Introduction to E-Info, call-to-action to create website  
**Customization**: User name  

**Example**:
```javascript
{
  "type": "welcome",
  "email": "user@example.com",
  "data": {
    "userName": "John Doe"
  }
}
```

#### 2. Payment Confirmation Email
**Sent to**: Users after successful Stripe payment  
**Content**: Order details, plan info, price, operation ID  
**Triggered by**: payment-session Lambda after Stripe checkout  

**Example**:
```javascript
{
  "type": "payment-confirmation",
  "email": "user@example.com",
  "data": {
    "projectName": "My Website",
    "planName": "Monthly Plan",
    "price": "$9.99/month",
    "operationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### 3. Generation Started Email
**Sent to**: Users when website generation begins  
**Content**: Project name, estimated time (2-5 minutes)  
**Status check**: Link to editor for real-time updates  

**Example**:
```javascript
{
  "type": "generation-started",
  "email": "user@example.com",
  "data": {
    "projectName": "My Website",
    "operationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### 4. Generation Complete Email
**Sent to**: Users when website is ready  
**Content**: Project name, deployment URL, call-to-action  
**Direct link**: Clickable button to view live website  

**Example**:
```javascript
{
  "type": "generation-complete",
  "email": "user@example.com",
  "data": {
    "projectName": "My Website",
    "deploymentUrl": "https://mywebsite.example.com",
    "operationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### 5. Generation Failed Email
**Sent to**: Users when generation encounters an error  
**Content**: Project name, error message, retry instructions  
**Support**: Link to contact support team  

**Example**:
```javascript
{
  "type": "generation-failed",
  "email": "user@example.com",
  "data": {
    "projectName": "My Website",
    "error": "Image validation failed: file size exceeds maximum",
    "operationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### 6. Deployment Complete Email
**Sent to**: Users when website goes live  
**Content**: Project name, live URL, deployment status  
**Shareability**: Encourages sharing website with others  

**Example**:
```javascript
{
  "type": "deployment-complete",
  "email": "user@example.com",
  "data": {
    "projectName": "My Website",
    "deploymentUrl": "https://mywebsite.example.com",
    "operationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## API Reference

### SendEmail Lambda

#### Invocation

**Direct Lambda Invocation**:
```javascript
const lambda = new AWS.Lambda();
const params = {
  FunctionName: 'send-email',
  InvocationType: 'Event', // Async
  Payload: JSON.stringify({
    type: 'payment-confirmation',
    email: 'user@example.com',
    data: { /* email-specific fields */ }
  })
};
await lambda.invoke(params).promise();
```

**Via SQS**:
```javascript
const sqs = new AWS.SQS();
await sqs.sendMessage({
  QueueUrl: emailQueueUrl,
  MessageBody: JSON.stringify({
    type: 'payment-confirmation',
    email: 'user@example.com',
    data: { /* email-specific fields */ }
  })
}).promise();
```

**Via SNS**:
```javascript
const sns = new AWS.SNS();
await sns.publish({
  TopicArn: emailTopicArn,
  Message: JSON.stringify({
    type: 'payment-confirmation',
    email: 'user@example.com',
    data: { /* email-specific fields */ }
  })
}).promise();
```

#### Response Format

**Success (200)**:
```json
{
  "statusCode": 200,
  "body": {
    "message": "Email sent successfully",
    "type": "payment-confirmation",
    "email": "user@example.com",
    "messageId": "0000014f-05b3-4c30-9c00-f8fc4c3f7b21"
  }
}
```

**Error (400)**:
```json
{
  "statusCode": 400,
  "body": {
    "error": "Missing type, email, or data"
  }
}
```

**Error (500)**:
```json
{
  "statusCode": 500,
  "body": {
    "error": "Failed to send email"
  }
}
```

## Current Integrations

### Payment Session Lambda
- Invokes send-email asynchronously after Stripe checkout
- Sends payment-confirmation email with order details
- Uses async invocation (Event type) to not block checkout response
- Email failures don't affect checkout success

**Code**:
```javascript
// In payment-session/index.js
await sendPaymentConfirmationEmail(logger, email, projectName, priceId, operationKey)
  .catch(err => {
    logger.warn('Failed to send payment confirmation email', { error: err.message });
    // Non-blocking failure
  });
```

## Future Integrations

### Generation Workflow
- [ ] Send generation-started when processing begins
- [ ] Send generation-complete when website is ready
- [ ] Send generation-failed on errors
- [ ] Link to live deployment URL

### GitHub Webhook
- [ ] Send deployment-complete when deployed to production
- [ ] Include live website URL
- [ ] Encourage user to share

### Project Management
- [ ] Send project deletion confirmation
- [ ] Send batch notifications for old projects

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| SENDER_EMAIL | Yes | no-reply@e-info.click | SES verified email address |
| FRONTEND_URL | Yes | https://editor.e-info.click | Link in emails |
| SES_REGION | No | us-east-1 | AWS SES region |
| SENTRY_DSN | No | - | Error tracking (optional) |

### AWS SES Setup

**Sandbox Mode** (Development):
```bash
# Verify sender email
aws ses verify-email-identity --email-address no-reply@e-info.click --region us-east-1

# Verify recipient emails (for testing)
aws ses verify-email-identity --email-address test@example.com --region us-east-1
```

**Production Mode** (Requires AWS Support):
1. Request production access (removes recipient verification requirement)
2. Set up domain verification (DKIM/SPF/DMARC)
3. Configure bounce/complaint handling

## Email Design

### Template Features

- **Responsive HTML**: Mobile-optimized using inline CSS
- **Color coded**: Status-specific colors (blue=info, green=success, red=error)
- **Call-to-action buttons**: Prominent links to relevant pages
- **Branded footer**: Copyright and links
- **Text fallback**: Plain text version for email clients without HTML support

### Color Scheme

| Type | Primary | Secondary |
|------|---------|-----------|
| Welcome | Purple (667eea) | - |
| Success | Green (28a745) | - |
| Error | Red (dc3545) | - |
| Info | Blue (667eea) | - |

## Monitoring

### CloudWatch Metrics

Logged to `/aws/lambda/send-email`:
- `send_welcome_email` - Welcome email latency
- `send_payment_confirmation` - Payment email latency
- `send_generation_started` - Generation started email latency
- `send_generation_complete` - Generation complete email latency
- `send_generation_failed` - Generation failed email latency
- `send_deployment_complete` - Deployment email latency

### Error Tracking

- **Sentry Integration**: All errors logged if `SENTRY_DSN` is configured
- **CloudWatch Logs**: Structured JSON logging with request context
- **Breadcrumbs**: Context about email type and recipient

## Troubleshooting

### Emails Not Sending

**Check 1**: SES Sandbox Status
```bash
aws ses get-account-sending-enabled --region us-east-1
```

**Check 2**: Verify Sender Email
```bash
aws ses list-verified-email-addresses --region us-east-1
```

**Check 3**: Lambda Logs
```bash
aws logs tail /aws/lambda/send-email --follow
```

### Emails Going to Spam

1. Set up SPF/DKIM records (domain verification)
2. Configure bounce/complaint handling
3. Avoid spam trigger words in templates
4. Test with email validation services

### Template Issues

1. Check email client HTML support (test on multiple clients)
2. Verify inline CSS is properly formatted
3. Test responsive design on mobile devices
4. Validate all URLs are correct

## Testing

### Local Testing

```javascript
import { sendPaymentConfirmationEmail } from './shared/emailService.js';

// Test with mock data
const messageId = await sendPaymentConfirmationEmail(
  'test@example.com',
  'Test Website',
  'Monthly Plan',
  '$9.99/month',
  '550e8400-e29b-41d4-a716-446655440000'
);

console.log('Email sent:', messageId);
```

### Lambda Testing (AWS Console)

```json
{
  "type": "payment-confirmation",
  "email": "your-verified-email@example.com",
  "data": {
    "projectName": "Test Website",
    "planName": "Monthly Plan",
    "price": "$9.99/month",
    "operationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Security Considerations

### Email Validation
- Email format validated before sending
- Prevents sending to invalid addresses
- Reduces bounce rate

### Rate Limiting
- SES has sending rate limits (default 14 emails/second)
- Implement queue-based throttling for bulk sends
- Monitor bounce/complaint metrics

### Data Protection
- No sensitive data in email subject lines
- No passwords or secrets in emails
- Links use operation IDs, not sensitive data
- HTTPS enforced on all links

## Performance

### Latency
- **Async invocation**: 100-200ms (non-blocking)
- **Email delivery**: 1-5 seconds (SES)
- **Total user impact**: Negligible (async)

### Throughput
- Single SendEmail Lambda: 1000+ emails/minute
- SES limit: 14 emails/second (sandbox) → higher in production
- Queue-based approach can scale to millions

## Future Enhancements

- [ ] Template versioning for A/B testing
- [ ] Unsubscribe links and preference center
- [ ] Email scheduling (send later)
- [ ] Bulk email operations
- [ ] Email open/click tracking
- [ ] Custom email templates per user
- [ ] Multi-language email support
- [ ] SMS notifications as fallback
