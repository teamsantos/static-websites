import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

interface HealthCheckStackProps extends cdk.StackProps {
  queueUrl?: string;
}

/**
 * Health Check Stack
 *
 * Provides monitoring endpoint for system health status
 *
 * Endpoint: /health (GET)
 * Returns:
 * - 200 OK: System is healthy
 * - 503 Service Unavailable: Critical services down
 *
 * Checks:
 * - DynamoDB: Table connectivity and latency
 * - SQS: Queue status and message backlog
 * - Lambda: Error rates from CloudWatch metrics
 *
 * Use Cases:
 * - CloudWatch alarms can monitor /health endpoint
 * - Load balancer health checks
 * - Automated incident detection
 * - Dashboard integration
 */
export class HealthCheckStack extends cdk.Stack {
  public healthCheckFunctionName: string;

  constructor(scope: cdk.App, id: string, props?: HealthCheckStackProps) {
    super(scope, id, props);

    // Lambda for health check
    const healthCheckFunction = new lambda.Function(this, "HealthCheckFunction", {
      functionName: 'health-check',
      runtime: lambda.Runtime.NODEJS_18_X,
       code: lambda.Code.fromAsset("lambda/health-check"),
       handler: "index.handler",
       environment: {
         DYNAMODB_METADATA_TABLE: "websites-metadata",
         SQS_QUEUE_URL: props?.queueUrl || "",
       },
       timeout: cdk.Duration.seconds(10),
       memorySize: 256,
     });
    this.healthCheckFunctionName = healthCheckFunction.functionName;

    // Set CloudWatch log retention
    new logs.LogRetention(this, "HealthCheckLogRetention", {
      logGroupName: healthCheckFunction.logGroup.logGroupName,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant read permissions to CloudWatch and DynamoDB
    healthCheckFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudwatch:GetMetricStatistics"],
        resources: ["*"],
      })
    );

    healthCheckFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: ["arn:aws:dynamodb:*:*:table/websites-metadata"],
      })
    );

    healthCheckFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sqs:GetQueueAttributes"],
        resources: ["arn:aws:sqs:*:*:*"],
      })
    );

    // API Gateway setup
    const api = new apigateway.RestApi(this, "HealthCheckApi", {
      restApiName: "health-check-api",
      description: "System health monitoring endpoint",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "OPTIONS"],
      },
    });

    // /health endpoint
    const healthResource = api.root.addResource("health");
    healthResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(healthCheckFunction, {
        integrationResponses: [
          { statusCode: "200" },
          { statusCode: "503" },
        ],
      }),
      {
        methodResponses: [
          { statusCode: "200" },
          { statusCode: "503" },
        ],
      }
    );

    new cdk.CfnOutput(this, "HealthCheckUrl", {
      value: `${api.url}health`,
      description: "Health check endpoint URL",
      exportName: "HealthCheckUrl",
    });
  }
}
