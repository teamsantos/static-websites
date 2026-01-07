"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = __importStar(require("aws-cdk-lib"));
const bucketStack_1 = require("./bucketStack");
const CloudWatchLogsStack_1 = require("./CloudWatchLogsStack");
const CreateProjectStack_1 = require("./CreateProjectStack");
const ProjectStack_1 = require("./ProjectStack");
const PaymentSessionStack_1 = require("./PaymentSessionStack");
const MultiTenantDistributionStack_1 = require("./MultiTenantDistributionStack");
const DynamoDBMetadataStack_1 = require("./DynamoDBMetadataStack");
const WAFStack_1 = require("./WAFStack");
const BudgetAlertStack_1 = require("./BudgetAlertStack");
const QueueStack_1 = require("./QueueStack");
const StepFunctionsStack_1 = require("./StepFunctionsStack");
const GitHubWebhookStack_1 = require("./GitHubWebhookStack");
const HealthCheckStack_1 = require("./HealthCheckStack");
const DashboardStack_1 = require("./DashboardStack");
const AlertingStack_1 = require("./AlertingStack");
const ProjectManagementStack_1 = require("./ProjectManagementStack");
const EmailTemplateStack_1 = require("./EmailTemplateStack");
const app = new cdk.App();
const config = {
    region: "eu-south-2",
    domain: "e-info.click",
    s3Bucket: "teamsantos-static-websites",
    certificateRegion: "us-east-1",
};
const account = process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account');
if (!account) {
    console.warn("Warning: No AWS account specified. Use CDK_DEFAULT_ACCOUNT env var or --profile");
}
// Create the shared multi-tenant CloudFront distribution FIRST
// This is required so we can get the OAC to pass to BucketStack
const multiTenantDistribution = new MultiTenantDistributionStack_1.MultiTenantDistributionStack(app, "MultiTenantDistribution", {
    domainName: config.domain,
    hostedZoneDomainName: config.domain,
    s3Bucket: config.s3Bucket,
    region: config.region,
    env: {
        account: account,
        region: config.certificateRegion,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "MultiTenantDistribution",
    },
});
// Create DynamoDB metadata table for website operations
const dynamoDBStack = new DynamoDBMetadataStack_1.DynamoDBMetadataStack(app, "DynamoDBMetadata", {
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "MetadataStorage",
    },
});
// Create the shared S3 bucket AFTER MultiTenantDistribution
// and pass the distribution so it can create the correct bucket policy
new bucketStack_1.BucketStack(app, "StaticWebsitesBucket", {
    bucketName: config.s3Bucket,
    distribution: multiTenantDistribution.distribution,
    oac: multiTenantDistribution.oac,
    env: {
        account: account,
        region: config.region,
    },
    crossRegionReferences: true,
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "StaticWebsiteHosting",
    },
});
// Create CloudWatch logs bucket with lifecycle policy for Glacier archival
new CloudWatchLogsStack_1.CloudWatchLogsStack(app, "CloudWatchLogsBucket", {
    bucketName: `${config.s3Bucket}-logs`,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "CloudWatchLogsArchival",
    },
});
// Create other infrastructure stacks
const createProjectStack = new CreateProjectStack_1.CreateProjectStack(app, "CreateProjectStack", {
    ses_region: config.certificateRegion,
    domain: config.domain,
    certificateRegion: config.certificateRegion,
    s3Bucket: config.s3Bucket,
    metadataTable: dynamoDBStack.table,
    idempotencyTable: dynamoDBStack.idempotencyTable,
    env: {
        account: account,
        region: config.region,
    },
});
// Create SQS queue for asynchronous website generation
const queueStack = new QueueStack_1.QueueStack(app, "QueueStack", {
    generateWebsiteLambda: createProjectStack.generateWebsiteFunction,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "AsyncWebsiteGeneration",
    },
});
// Create Step Functions state machine for workflow orchestration and status tracking
new StepFunctionsStack_1.StepFunctionsStack(app, "StepFunctionsStack", {
    generateWebsiteLambda: createProjectStack.generateWebsiteFunction,
    metadataTable: dynamoDBStack.table,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "WorkflowOrchestration",
    },
});
// Create Email Template System (Phase 4.6) - Must be created before Stripe stack
const emailTemplateStack = new EmailTemplateStack_1.EmailTemplateStack(app, "EmailTemplateStack", {
    senderEmail: process.env.SENDER_EMAIL || "noreply@e-info.click",
    frontendUrl: process.env.FRONTEND_URL || "https://editor.e-info.click",
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "EmailNotifications",
    },
});
const stripeCheckoutStack = new PaymentSessionStack_1.StripeCheckoutStack(app, "StripeCheckoutStack", {
    domain: config.domain,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    frontendUrl: process.env.FRONTEND_URL || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    s3Bucket: config.s3Bucket,
    metadataTable: dynamoDBStack.table,
    sqsQueueUrl: queueStack.queue.queueUrl,
    sqsQueueArn: queueStack.queue.queueArn,
    emailTemplateStack: emailTemplateStack,
    env: {
        account: account,
        region: config.region,
    },
});
// Create WAF for rate limiting
new WAFStack_1.WAFStack(app, "WAFStack", {
    env: {
        account: account,
        region: "us-east-1", // WAF must be in us-east-1 for CloudFront
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "RateLimiting",
    },
});
// Create Budget Alerts for cost controls
new BudgetAlertStack_1.BudgetAlertStack(app, "BudgetAlertStack", {
    dailyBudgetUSD: 10,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "CostControls",
    },
});
// Create GitHub webhook handler for deployment tracking
const githubWebhookStack = new GitHubWebhookStack_1.GitHubWebhookStack(app, "GitHubWebhookStack", {
    domain: config.domain,
    metadataTable: dynamoDBStack.table,
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "DeploymentTracking",
    },
});
// Create health check endpoint
const healthCheckStack = new HealthCheckStack_1.HealthCheckStack(app, "HealthCheckStack", {
    queueUrl: queueStack.queue.queueUrl,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "HealthMonitoring",
    },
});
// Create CloudWatch monitoring dashboard
new DashboardStack_1.DashboardStack(app, "DashboardStack", {
    paymentSessionFunctionName: stripeCheckoutStack.paymentSessionFunctionName,
    generateWebsiteFunctionName: createProjectStack.generateWebsiteFunctionName,
    stripeWebhookFunctionName: stripeCheckoutStack.stripeWebhookFunctionName,
    githubWebhookFunctionName: githubWebhookStack.githubWebhookFunctionName,
    healthCheckFunctionName: healthCheckStack.healthCheckFunctionName,
    metadataTableName: dynamoDBStack.table.tableName,
    queueUrl: queueStack.queue.queueUrl,
    queueName: queueStack.queue.queueName,
    s3BucketName: config.s3Bucket,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "Monitoring",
    },
});
// Create SNS alerts for critical issues
new AlertingStack_1.AlertingStack(app, "AlertingStack", {
    paymentSessionFunctionName: stripeCheckoutStack.paymentSessionFunctionName,
    generateWebsiteFunctionName: createProjectStack.generateWebsiteFunctionName,
    stripeWebhookFunctionName: stripeCheckoutStack.stripeWebhookFunctionName,
    githubWebhookFunctionName: githubWebhookStack.githubWebhookFunctionName,
    healthCheckFunctionName: healthCheckStack.healthCheckFunctionName,
    metadataTableName: dynamoDBStack.table.tableName,
    queueName: queueStack.queue.queueName,
    adminEmail: process.env.ADMIN_EMAIL || "admin@e-info.click",
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "Alerting",
    },
});
// Create Project Management API (Phase 4.5)
new ProjectManagementStack_1.ProjectManagementStack(app, "ProjectManagementStack", {
    domain: config.domain,
    metadataTable: dynamoDBStack.table,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "ProjectManagement",
    },
});
const projectsParam = app.node.tryGetContext("projects");
const templatesParam = app.node.tryGetContext("templates");
if (!projectsParam && !templatesParam) {
    console.error("No projects or templates provided.");
    console.log("Usage: cdk deploy --context projects=\"project1,project2\" --context templates=\"template1,template2\"");
    console.log("You can specify either projects, templates, or both.");
}
else {
    let totalStacks = 0;
    // Handle projects
    if (projectsParam) {
        const projects = projectsParam.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
        if (projects.length > 0) {
            console.log(`Deploying ${projects.length} project(s): ${projects.join(", ")}`);
            projects.forEach((project) => {
                if (!/^[a-z0-9-]+$/.test(project)) {
                    console.warn(`Warning: Project name '${project}' may not be DNS-safe. Use lowercase letters, numbers, and hyphens only.`);
                }
                console.log(`Creating stack for project: ${project}.${config.domain}`);
                new ProjectStack_1.ProjectSite(app, `Site-${project}`, {
                    projectName: project,
                    domainName: `${project}.${config.domain}`,
                    hostedZoneDomainName: config.domain,
                    multiTenantDistribution: multiTenantDistribution,
                    type: 'project',
                    env: {
                        account: account,
                        region: config.certificateRegion,
                    },
                    tags: {
                        Project: project,
                        Type: 'project',
                        Domain: `${project}.${config.domain}`,
                        ManagedBy: "CDK",
                        Environment: "production",
                    },
                });
            });
            totalStacks += projects.length;
        }
    }
    // Handle templates
    if (templatesParam) {
        const templates = templatesParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (templates.length > 0) {
            console.log(`Deploying ${templates.length} template(s): ${templates.join(", ")}`);
            templates.forEach((template) => {
                if (!/^[a-z0-9-]+$/.test(template)) {
                    console.warn(`Warning: Template name '${template}' may not be DNS-safe. Use lowercase letters, numbers, and hyphens only.`);
                }
                console.log(`Creating stack for template: ${template}.${config.domain}`);
                new ProjectStack_1.ProjectSite(app, `Site-template-${template}`, {
                    projectName: template,
                    domainName: `${template}.templates.${config.domain}`,
                    hostedZoneDomainName: config.domain,
                    multiTenantDistribution: multiTenantDistribution,
                    type: 'template',
                    env: {
                        account: account,
                        region: config.certificateRegion,
                    },
                    tags: {
                        Project: template,
                        Type: 'template',
                        Domain: `${template}.templates.${config.domain}`,
                        ManagedBy: "CDK",
                        Environment: "production",
                    },
                });
            });
            totalStacks += templates.length;
        }
    }
    if (totalStacks > 0) {
        console.log(`Created ${totalStacks} stack(s) successfully`);
    }
    else {
        console.error("No valid projects or templates found after parsing.");
    }
}
app.synth();
