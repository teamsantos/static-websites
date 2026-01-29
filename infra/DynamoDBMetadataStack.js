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
exports.DynamoDBMetadataStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
/**
 * DynamoDB Stack for Website Metadata Storage
 *
 * Replaces S3 metadata.json with DynamoDB for:
 * - Atomic writes (prevent race conditions)
 * - Queryable by email (GSI)
 * - TTL support (auto-cleanup abandoned carts)
 * - Better scalability
 *
 * Table: websites-metadata
 * - PK: operationId (UUID)
 * - GSI: email-createdAt for querying by email
 * - TTL: 7 days for auto-cleanup
 */
class DynamoDBMetadataStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Main table for website metadata
        this.table = new dynamodb.Table(this, "WebsitesMetadata", {
            tableName: "websites-metadata",
            partitionKey: {
                name: "operationId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Never delete table on stack delete
            pointInTimeRecovery: true, // Backup/recovery capability
            timeToLiveAttribute: "expiresAt", // Auto-cleanup after 7 days
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For DynamoDB Streams
        });
        // Global Secondary Index: Query by email + sort by createdAt
        // Use case: "Show me all websites created by user@example.com"
        this.table.addGlobalSecondaryIndex({
            indexName: "email-createdAt-index",
            partitionKey: {
                name: "email",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "createdAt",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL, // Project all attributes
        });
        // Global Secondary Index: Query by payment session ID
        // Use case: "Find operationId by paymentSessionId"
        this.table.addGlobalSecondaryIndex({
            indexName: "paymentSessionId-index",
            partitionKey: {
                name: "paymentSessionId",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Global Secondary Index: Query by status
        // Use case: "Find all pending payments"
        this.table.addGlobalSecondaryIndex({
            indexName: "status-createdAt-index",
            partitionKey: {
                name: "status",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "createdAt",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Global Secondary Index: Query by projectName
        // Use case: "Find project owner by projectName"
        this.table.addGlobalSecondaryIndex({
            indexName: "projectName-index",
            partitionKey: {
                name: "projectName",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Confirmation Codes Table
        // Stores temporary codes for save verification
        // PK: templateId (projectName)
        // TTL: 5 minutes
        const confirmationCodesTable = new dynamodb.Table(this, "ConfirmationCodes", {
            tableName: "confirmation-codes",
            partitionKey: {
                name: "templateId", // Matches projectName
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // data is temporary anyway
            timeToLiveAttribute: "expiresAt",
        });
        // Export for use by other stacks
        this.confirmationCodesTable = confirmationCodesTable;
        // Idempotency table (Phase 2.4)
        // Stores request results to prevent duplicate processing
        const idempotencyTable = new dynamodb.Table(this, "Idempotency", {
            tableName: "request-idempotency",
            partitionKey: {
                name: "idempotencyKey",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            timeToLiveAttribute: "expiresAt", // Auto-cleanup after 24h
        });
        // Export for use by other stacks
        this.idempotencyTable = idempotencyTable;
        // CloudWatch Alarms for monitoring
        const readThrottleAlarm = new cdk.aws_cloudwatch.Alarm(this, "MetadataReadThrottleAlarm", {
            metric: this.table.metric("ReadThrottleEvents"),
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: "DynamoDB metadata table read throttle",
            alarmName: "MetadataReadThrottle",
        });
        const writeThrottleAlarm = new cdk.aws_cloudwatch.Alarm(this, "MetadataWriteThrottleAlarm", {
            metric: this.table.metric("WriteThrottleEvents"),
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: "DynamoDB metadata table write throttle",
            alarmName: "MetadataWriteThrottle",
        });
        // Outputs for other stacks to reference
        new cdk.CfnOutput(this, "MetadataTableName", {
            value: this.table.tableName,
            description: "DynamoDB table name for website metadata",
            exportName: "WebsitesMetadataTableName",
        });
        new cdk.CfnOutput(this, "IdempotencyTableName", {
            value: idempotencyTable.tableName,
            description: "DynamoDB table name for request idempotency",
            exportName: "RequestIdempotencyTableName",
        });
        new cdk.CfnOutput(this, "ConfirmationCodesTableName", {
            value: confirmationCodesTable.tableName,
            description: "DynamoDB table name for confirmation codes",
            exportName: "ConfirmationCodesTableName",
        });
    }
    /**
     * Grant Lambda function permissions to access the metadata table
     * @param role - IAM role to grant permissions to
     */
    grantReadWrite(role) {
        this.table.grantReadWriteData(role);
    }
    grantRead(role) {
        this.table.grantReadData(role);
    }
    grantWrite(role) {
        this.table.grantWriteData(role);
    }
}
exports.DynamoDBMetadataStack = DynamoDBMetadataStack;
