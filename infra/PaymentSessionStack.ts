import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { EmailTemplateStack } from "./EmailTemplateStack";

interface StripeCheckoutProps extends cdk.StackProps {
  domain?: string;
  stripeSecretKey: string;
  frontendUrl: string;
  s3Bucket?: string;
  stripeWebhookSecret?: string;
  metadataTable?: dynamodb.Table;
  idempotencyTable?: dynamodb.Table;
  sqsQueueUrl?: string;
  sqsQueueArn?: string;
  emailTemplateStack?: EmailTemplateStack;
}

export class StripeCheckoutStack extends cdk.Stack {
  public paymentSessionFunctionName: string;
  public stripeWebhookFunctionName: string;

  constructor(scope: cdk.App, id: string, props: StripeCheckoutProps) {
    super(scope, id, props);

    const domain = props?.domain || "e-info.click";

    const hostedZone = route53.HostedZone.fromLookup(this, "StripeHostedZone", {
      domainName: domain,
    });

    const certificate = new DnsValidatedCertificate(this, "StripeApiCertificate", {
      domainName: `pay.${domain}`,
      hostedZone: hostedZone,
      region: "us-east-1",
    });

    // Lambda for Stripe Checkout
    const checkoutFunction = new lambda.Function(this, "StripeCheckoutFunction", {
      functionName: 'payment-session',
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda/payment-session"),
      handler: "index.handler",
        environment: {
          STRIPE_SECRET_KEY: props.stripeSecretKey,
          FRONTEND_URL: props.frontendUrl,
          S3_BUCKET_NAME: props.s3Bucket || "teamsantos-static-websites",
          DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata",
          DYNAMODB_IDEMPOTENCY_TABLE: props.idempotencyTable?.tableName || "request-idempotency",
          SEND_EMAIL_FUNCTION: props.emailTemplateStack?.sendEmailFunctionName || "send-email",
        },
       timeout: cdk.Duration.seconds(30),
     });
    this.paymentSessionFunctionName = checkoutFunction.functionName;

    // Grant permission to invoke send-email Lambda
    if (props.emailTemplateStack) {
      props.emailTemplateStack.grantInvoke(checkoutFunction);
    }

    // Lambda for Stripe Webhook
    const webhookFunction = new lambda.Function(this, "StripeWebhookFunction", {
      functionName: 'stripe-webhook',
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda/stripe-webhook"),
      handler: "index.handler",
       environment: {
         STRIPE_SECRET_KEY: props.stripeSecretKey,
         STRIPE_WEBHOOK_SECRET: props.stripeWebhookSecret || "",
         S3_BUCKET_NAME: props.s3Bucket || "teamsantos-static-websites",
         DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata",
         SQS_QUEUE_URL: props.sqsQueueUrl || "",
       },
       timeout: cdk.Duration.seconds(30),
     });
    this.stripeWebhookFunctionName = webhookFunction.functionName;

    // Set CloudWatch log retention to 30 days
    new logs.LogRetention(this, 'StripeCheckoutLogRetention', {
      logGroupName: checkoutFunction.logGroup.logGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    new logs.LogRetention(this, 'StripeWebhookLogRetention', {
      logGroupName: webhookFunction.logGroup.logGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    if (props.s3Bucket) {
      // Allow ListBucket on the bucket
checkoutFunction.addToRolePolicy(
           new iam.PolicyStatement({
               actions: ["s3:ListBucket", "s3:GetObject"],
               resources: [
                   `arn:aws:s3:::${props.s3Bucket}`,       // List bucket
                   `arn:aws:s3:::${props.s3Bucket}/*`      // Read all bucket objects
               ],
        })
      );

      // Allow GetObject and PutObject on metadata.json
      checkoutFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["s3:GetObject", "s3:PutObject"],
          resources: [
            `arn:aws:s3:::${props.s3Bucket}/metadata.json`,
          ],
        })
      );

      // Webhook needs same S3 permissions
      webhookFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["s3:ListBucket"],
          resources: [`arn:aws:s3:::${props.s3Bucket}`],
        })
      );

      webhookFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["s3:GetObject", "s3:PutObject"],
          resources: [
            `arn:aws:s3:::${props.s3Bucket}/metadata.json`,
          ],
        })
      );
    }

    // Grant DynamoDB permissions for lambdas
    if (props.metadataTable) {
      props.metadataTable.grantReadWriteData(checkoutFunction);
      props.metadataTable.grantReadWriteData(webhookFunction);
    }

    // Grant idempotency table permissions if provided (used by request idempotency cache)
    if (props.idempotencyTable) {
      props.idempotencyTable.grantReadWriteData(checkoutFunction);
      props.idempotencyTable.grantReadWriteData(webhookFunction);
    }

    // Grant SQS send permissions to webhook Lambda
    if (props.sqsQueueArn) {
      webhookFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sqs:SendMessage"],
          resources: [props.sqsQueueArn],
        })
      );
    }

    // API Gateway setup
    const api = new apigateway.RestApi(this, "StripeApi", {
      restApiName: "stripe-checkout-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "Origin",
        ],
      },
    });

    // Custom domain for API
    const apiDomain = new apigateway.DomainName(this, "StripeApiDomain", {
      domainName: `pay.${domain}`,
      certificate: certificate,
      endpointType: apigateway.EndpointType.EDGE,
    });

    new apigateway.BasePathMapping(this, "StripeApiMapping", {
      domainName: apiDomain,
      restApi: api,
    });

    new route53.ARecord(this, "StripeApiAliasRecord", {
      zone: hostedZone,
      recordName: `pay.${domain}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.ApiGatewayDomain(apiDomain)
      ),
    });

    // /checkout-session endpoint
    const checkoutResource = api.root.addResource("checkout-session");
    checkoutResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(checkoutFunction, {
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

    // /webhook endpoint for Stripe events
    const webhookResource = api.root.addResource("webhook");
    webhookResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(webhookFunction, {
        integrationResponses: [
          { statusCode: "200" },
          { statusCode: "400" },
          { statusCode: "500" },
        ],
      }),
      {
        methodResponses: [
          { statusCode: "200" },
          { statusCode: "400" },
          { statusCode: "500" },
        ],
      }
    );
  }
}
