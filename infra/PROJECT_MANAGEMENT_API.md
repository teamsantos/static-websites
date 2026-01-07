# Phase 4.5: Project Management API

## Overview

The Project Management API provides endpoints for users to query and manage their website projects. Users authenticate using their email address and can:

- **List projects** - Retrieve all projects created by a user
- **Delete projects** - Remove a specific project (ownership verification)

## Base URL

```
https://{{api-id}}.execute-api.{{region}}.amazonaws.com/prod
```

### Example (after deployment)
```
https://abc123.execute-api.eu-south-2.amazonaws.com/prod
```

## Authentication

All endpoints (except OPTIONS) require email-based authentication. Provide your email via one of these methods (in order of precedence):

### 1. Query Parameter (recommended for GET)
```bash
GET /projects?email=user@example.com
```

### 2. Custom Header
```bash
GET /projects
X-User-Email: user@example.com
```

### 3. Request Body (JSON)
```bash
POST /projects
Content-Type: application/json

{
  "email": "user@example.com"
}
```

## Endpoints

### GET /projects - List User Projects

Retrieve all projects (websites) created by a user.

#### Request

```bash
curl -X GET "https://api.example.com/prod/projects?email=user@example.com" \
  -H "Content-Type: application/json"
```

#### Response (200 OK)

```json
{
  "projects": [
    {
      "operationId": "550e8400-e29b-41d4-a716-446655440000",
      "projectName": "My Business Website",
      "email": "user@example.com",
      "status": "completed",
      "createdAt": "2025-01-07T12:30:00Z",
      "templateId": "template-1",
      "deploymentUrl": "https://mybusiness.example.com",
      "deploymentStatus": "deployed"
    },
    {
      "operationId": "660e8400-e29b-41d4-a716-446655440001",
      "projectName": "Portfolio Website",
      "email": "user@example.com",
      "status": "pending",
      "createdAt": "2025-01-06T10:15:00Z",
      "templateId": "template-2",
      "deploymentUrl": null,
      "deploymentStatus": "pending"
    }
  ],
  "count": 2
}
```

#### Error Responses

**401 Unauthorized** - Invalid or missing email
```json
{
  "error": "No email provided in query, header, or body"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to retrieve projects"
}
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User's email address |

---

### DELETE /projects/{id} - Delete Project

Delete a specific project. Only the user who created the project can delete it.

#### Request

```bash
curl -X DELETE "https://api.example.com/prod/projects/550e8400-e29b-41d4-a716-446655440000?email=user@example.com" \
  -H "Content-Type: application/json"
```

#### Response (200 OK)

```json
{
  "message": "Project deleted successfully",
  "operationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Error Responses

**401 Unauthorized** - Invalid or missing email
```json
{
  "error": "No email provided in query, header, or body"
}
```

**403 Forbidden** - User doesn't own the project
```json
{
  "error": "Unauthorized: you can only delete your own projects"
}
```

**404 Not Found** - Project doesn't exist
```json
{
  "error": "Project not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to delete project"
}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Project operationId (UUID) |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User's email address |

---

## CORS Headers

All responses include CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-User-Email
Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Missing or invalid parameters |
| 401 | Unauthorized - Invalid or missing email |
| 403 | Forbidden - User doesn't have permission (e.g., deleting another user's project) |
| 404 | Not Found - Project doesn't exist |
| 500 | Internal Server Error - Server error occurred |

## Data Model

### Project Object

| Field | Type | Description |
|-------|------|-------------|
| operationId | string (UUID) | Unique project identifier |
| projectName | string | User-defined project name |
| email | string | Creator's email address |
| status | string | "pending", "completed", or "failed" |
| createdAt | string (ISO 8601) | Creation timestamp |
| templateId | string | Template used for the project |
| deploymentUrl | string \| null | Live website URL (if deployed) |
| deploymentStatus | string | "pending", "deployed", or "failed" |

## Examples

### List Projects (Query Parameter)

```bash
curl -X GET "https://api.example.com/prod/projects?email=john@example.com"
```

### List Projects (Header)

```bash
curl -X GET "https://api.example.com/prod/projects" \
  -H "X-User-Email: john@example.com"
```

### Delete Project

```bash
curl -X DELETE "https://api.example.com/prod/projects/550e8400-e29b-41d4-a716-446655440000?email=john@example.com"
```

### Delete Project (Header Authentication)

```bash
curl -X DELETE "https://api.example.com/prod/projects/550e8400-e29b-41d4-a716-446655440000" \
  -H "X-User-Email: john@example.com"
```

## Rate Limiting

API Gateway throttles requests:
- **Burst limit**: 100 requests
- **Rate limit**: 50 requests per second

Requests exceeding these limits receive HTTP 429 (Too Many Requests).

## Logging and Monitoring

All requests are logged to CloudWatch:
- **Log Group**: `/aws/lambda/project-management`
- **Retention**: 14 days
- **Log Level**: INFO

CloudWatch Metrics available:
- Query execution time
- Deletion execution time
- Success/error rates
- Database read/write units

## Security Considerations

### Authentication
- Email-based authentication is intentionally simple for MVP
- **Upgrade path**: Implement JWT tokens or OAuth 2.0 for production
- **Rate limiting**: IP-based and email-based rate limiting recommended

### Authorization
- Project deletion verifies ownership (email must match creator)
- Users can only see their own projects

### Data Protection
- HTTPS enforced (API Gateway default)
- DynamoDB encryption at rest
- No sensitive fields exposed in API responses

## Future Enhancements

- [ ] JWT token-based authentication
- [ ] Email-based OTP (one-time password)
- [ ] Bulk project operations
- [ ] Project filtering and sorting
- [ ] Project status updates
- [ ] Project export functionality
- [ ] User profile management

## Testing

### Prerequisites

1. Deployment completed (see DEPLOYMENT.md)
2. User has created at least one project through the payment flow
3. API endpoint URL from CloudFormation outputs

### Test Script

```bash
#!/bin/bash

API_URL="https://{{api-id}}.execute-api.eu-south-2.amazonaws.com/prod"
USER_EMAIL="test@example.com"

echo "1. List projects"
curl -X GET "$API_URL/projects?email=$USER_EMAIL" \
  -H "Content-Type: application/json"

echo -e "\n\n2. Get project ID from list above and store in PROJECT_ID variable"
echo "Example: PROJECT_ID='550e8400-e29b-41d4-a716-446655440000'"

echo -e "\n\n3. Delete project"
curl -X DELETE "$API_URL/projects/$PROJECT_ID?email=$USER_EMAIL" \
  -H "Content-Type: application/json"
```

## Support

For issues or questions:
1. Check CloudWatch Logs: `/aws/lambda/project-management`
2. Check Sentry for error tracking (if configured)
3. Verify DynamoDB table has correct data with: `aws dynamodb query --table-name websites-metadata --key-condition-expression "email = :email" --expression-attribute-values '{":email":{"S":"user@example.com"}}'`
