import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";

interface ProjectManagementStackProps extends cdk.StackProps {
  domain: string;
  metadataTable: dynamodb.Table;
}

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
export class ProjectManagementStack extends cdk.Stack {
  public api: apigateway.RestApi;
  public getProjectsFunctionName: string;
  public deleteProjectFunctionName: string;

  constructor(scope: cdk.App, id: string, props: ProjectManagementStackProps) {
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
    const getProjectsFunction = new lambda.Function(
      this,
      "GetProjectsFunction",
      {
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
      }
    );

    this.getProjectsFunctionName = getProjectsFunction.functionName;

    // Grant read access to metadata table
    props.metadataTable.grantReadData(getProjectsFunction);

    // ============================================================
    // Lambda: Delete Project
    // ============================================================
    const deleteProjectFunction = new lambda.Function(
      this,
      "DeleteProjectFunction",
      {
        functionName: "delete-project",
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "lambda/delete-project")
        ),
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        environment: {
          DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
          SENTRY_DSN: process.env.SENTRY_DSN || "",
        },
        logGroup,
      }
    );

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

    projectIdResource.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(deleteProjectFunction),
      {
        methodResponses: [
          { statusCode: "200" },
          { statusCode: "401" },
          { statusCode: "403" },
          { statusCode: "404" },
          { statusCode: "500" },
        ],
      }
    );

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
