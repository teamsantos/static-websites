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
exports.ProjectManagementStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const path = __importStar(require("path"));
/**
 * Project Management Stack - Phase 4.5
 *
 * Provides REST API endpoints for users to:
 * - List their projects: GET /projects?email=user@example.com
 * - Delete projects: DELETE /projects/{id}?email=user@example.com
 *
 * Authentication: Email-based (simple token validation)
 *
 * Endpoints:
 * - GET  /projects          - List all projects for a user
 * - DELETE /projects/{id}   - Delete a specific project
 */
class ProjectManagementStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create CloudWatch Log Group for Lambda
        const logGroup = new logs.LogGroup(this, "ProjectManagementLogs", {
            logGroupName: "/aws/lambda/project-management",
            retention: logs.RetentionDays.TWO_WEEKS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // ============================================================
        // Lambda: Get Projects
        // ============================================================
        const getProjectsFunction = new lambda.Function(this, "GetProjectsFunction", {
            functionName: "get-projects",
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "lambda/get-projects")),
            timeout: cdk.Duration.seconds(10),
            memorySize: 256,
            environment: {
                DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                SENTRY_DSN: process.env.SENTRY_DSN || "",
            },
            logGroup,
        });
        this.getProjectsFunctionName = getProjectsFunction.functionName;
        // Grant read access to metadata table
        props.metadataTable.grantReadData(getProjectsFunction);
        // ============================================================
        // Lambda: Delete Project
        // ============================================================
        const deleteProjectFunction = new lambda.Function(this, "DeleteProjectFunction", {
            functionName: "delete-project",
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "lambda/delete-project")),
            timeout: cdk.Duration.seconds(10),
            memorySize: 256,
            environment: {
                DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                SENTRY_DSN: process.env.SENTRY_DSN || "",
            },
            logGroup,
        });
        this.deleteProjectFunctionName = deleteProjectFunction.functionName;
        // Grant read/write access to metadata table (for deletion)
        props.metadataTable.grantReadWriteData(deleteProjectFunction);
        // ============================================================
        // API Gateway
        // ============================================================
        this.api = new apigateway.RestApi(this, "ProjectManagementAPI", {
            restApiName: "project-management-api",
            description: "Project Management API for user operations",
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    "Content-Type",
                    "X-Amz-Date",
                    "Authorization",
                    "X-Api-Key",
                    "X-Amz-Security-Token",
                    "X-User-Email",
                ],
            },
            endpointTypes: [apigateway.EndpointType.REGIONAL],
            deployOptions: {
                stageName: "prod",
                throttlingBurstLimit: 100,
                throttlingRateLimit: 50,
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: false,
            },
        });
        // ============================================================
        // GET /projects - List user projects
        // ============================================================
        const projectsResource = this.api.root.addResource("projects");
        projectsResource.addMethod("GET", new apigateway.LambdaIntegration(getProjectsFunction), {
            methodResponses: [
                { statusCode: "200" },
                { statusCode: "401" },
                { statusCode: "500" },
            ],
        });
        // ============================================================
        // DELETE /projects/{id} - Delete specific project
        // ============================================================
        const projectIdResource = projectsResource.addResource("{id}");
        projectIdResource.addMethod("DELETE", new apigateway.LambdaIntegration(deleteProjectFunction), {
            methodResponses: [
                { statusCode: "200" },
                { statusCode: "401" },
                { statusCode: "403" },
                { statusCode: "404" },
                { statusCode: "500" },
            ],
        });
        // ============================================================
        // Outputs
        // ============================================================
        new cdk.CfnOutput(this, "APIEndpoint", {
            value: this.api.url,
            description: "Project Management API endpoint",
            exportName: "ProjectManagementAPIEndpoint",
        });
        new cdk.CfnOutput(this, "GetProjectsFunction", {
            value: getProjectsFunction.functionArn,
            description: "Get Projects Lambda ARN",
            exportName: "GetProjectsFunctionArn",
        });
        new cdk.CfnOutput(this, "DeleteProjectFunction", {
            value: deleteProjectFunction.functionArn,
            description: "Delete Project Lambda ARN",
            exportName: "DeleteProjectFunctionArn",
        });
    }
}
exports.ProjectManagementStack = ProjectManagementStack;
