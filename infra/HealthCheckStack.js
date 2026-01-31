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
exports.HealthCheckStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
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
class HealthCheckStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        healthCheckFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ["cloudwatch:GetMetricStatistics"],
            resources: ["*"],
        }));
        healthCheckFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ["dynamodb:Query"],
            resources: ["arn:aws:dynamodb:*:*:table/websites-metadata"],
        }));
        healthCheckFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ["sqs:GetQueueAttributes"],
            resources: ["arn:aws:sqs:*:*:*"],
        }));
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
        healthResource.addMethod("GET", new apigateway.LambdaIntegration(healthCheckFunction, {
            integrationResponses: [
                { statusCode: "200" },
                { statusCode: "503" },
            ],
        }), {
            methodResponses: [
                { statusCode: "200" },
                { statusCode: "503" },
            ],
        });
        new cdk.CfnOutput(this, "HealthCheckUrl", {
            value: `${api.url}health`,
            description: "Health check endpoint URL",
            exportName: "HealthCheckUrl",
        });
    }
}
exports.HealthCheckStack = HealthCheckStack;
