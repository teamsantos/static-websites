import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";

interface DynamoDBMetadataStackProps extends cdk.StackProps {
  s3Bucket?: string;
}

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
export class DynamoDBMetadataStack extends cdk.Stack {
  public table: dynamodb.Table;
  public idempotencyTable: dynamodb.Table;

  constructor(scope: cdk.App, id: string, props?: DynamoDBMetadataStackProps) {
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
      stream: dynamodb.StreamSpecification.NEW_AND_OLD_IMAGES, // For SQS integration later
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
    const readThrottleAlarm = new cdk.aws_cloudwatch.Alarm(
      this,
      "MetadataReadThrottleAlarm",
      {
        metric: this.table.metricReadThrottleEvents(),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: "DynamoDB metadata table read throttle",
      }
    );

    const writeThrottleAlarm = new cdk.aws_cloudwatch.Alarm(
      this,
      "MetadataWriteThrottleAlarm",
      {
        metric: this.table.metricWriteThrottleEvents(),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: "DynamoDB metadata table write throttle",
      }
    );

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
  }

  /**
   * Grant Lambda function permissions to access the metadata table
   * @param role - IAM role to grant permissions to
   */
  grantReadWrite(role: iam.IRole) {
    this.table.grantReadWriteData(role);
  }

  grantRead(role: iam.IRole) {
    this.table.grantReadData(role);
  }

  grantWrite(role: iam.IRole) {
    this.table.grantWriteData(role);
  }
}
