import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface GitHubWebhookStackProps extends cdk.StackProps {
  domain?: string;
  metadataTable?: dynamodb.Table;
  githubWebhookSecret?: string;
}

/**
 * GitHub Webhook Stack
 *
 * Receives push events from GitHub and tracks successful deployments
 * Updates website status to "deployed" when code is pushed to master
 *
 * Workflow:
 * - GitHub push to master → GitHub webhook → API Gateway → Lambda
 * - Lambda extracts project name from commit
 * - Lambda finds operationId in DynamoDB
 * - Lambda updates status to "deployed" with commit SHA and timestamp
 */
export class GitHubWebhookStack extends cdk.Stack {
  public githubWebhookFunctionName: string;

  constructor(scope: cdk.App, id: string, props: GitHubWebhookStackProps) {
    super(scope, id, props);

    const domain = props?.domain || "e-info.click";

    const hostedZone = route53.HostedZone.fromLookup(this, "GitHubWebhookHostedZone", {
      domainName: domain,
    });

    const certificate = new DnsValidatedCertificate(this, "GitHubWebhookCertificate", {
      domainName: `webhooks.${domain}`,
      hostedZone: hostedZone,
      region: "us-east-1",
    });

    // Lambda for GitHub webhook
    const webhookFunction = new lambda.Function(this, "GitHubWebhookFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda/github-webhook"),
      handler: "index.handler",
      environment: {
        DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata",
        GITHUB_WEBHOOK_SECRET: props.githubWebhookSecret || "",
      },
      timeout: cdk.Duration.seconds(30),
      reservedConcurrentExecutions: 50, // Lower limit - webhooks are infrequent
    });
    this.githubWebhookFunctionName = webhookFunction.functionName;

    // Set CloudWatch log retention
    new logs.LogRetention(this, "GitHubWebhookLogRetention", {
      logGroupName: webhookFunction.logGroup.logGroupName,
      retention: logs.RetentionDays.TWO_WEEKS,
    });

    // Grant DynamoDB permissions
    if (props.metadataTable) {
      props.metadataTable.grantReadWriteData(webhookFunction);
    }

    // API Gateway setup
    const api = new apigateway.RestApi(this, "GitHubWebhookApi", {
      restApiName: "github-webhook-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "X-Hub-Signature-256"],
      },
    });

    // Custom domain for webhook API
    const apiDomain = new apigateway.DomainName(this, "GitHubWebhookDomain", {
      domainName: `webhooks.${domain}`,
      certificate: certificate,
      endpointType: apigateway.EndpointType.EDGE,
    });

    new apigateway.BasePathMapping(this, "GitHubWebhookApiMapping", {
      domainName: apiDomain,
      restApi: api,
    });

    new route53.ARecord(this, "GitHubWebhookAliasRecord", {
      zone: hostedZone,
      recordName: `webhooks.${domain}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.ApiGatewayDomain(apiDomain)
      ),
    });

    // /github endpoint for GitHub webhooks
    const githubResource = api.root.addResource("github");
    githubResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(webhookFunction, {
        integrationResponses: [
          { statusCode: "200" },
          { statusCode: "400" },
          { statusCode: "403" },
          { statusCode: "500" },
        ],
      }),
      {
        methodResponses: [
          { statusCode: "200" },
          { statusCode: "400" },
          { statusCode: "403" },
          { statusCode: "500" },
        ],
      }
    );

    new cdk.CfnOutput(this, "GitHubWebhookUrl", {
      value: `https://webhooks.${domain}/github`,
      description: "GitHub webhook URL to configure in repository settings",
      exportName: "GitHubWebhookUrl",
    });
  }
}
