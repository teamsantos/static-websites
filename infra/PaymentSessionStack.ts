import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";

interface StripeCheckoutProps extends cdk.StackProps {
  domain?: string;
  stripeSecretKey: string;
  frontendUrl: string;
}

export class StripeCheckoutStack extends cdk.Stack {
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
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda/payment-session"),
      handler: "index.handler",
      environment: {
        STRIPE_SECRET_KEY: props.stripeSecretKey,
        FRONTEND_URL: props.frontendUrl,
      },
      timeout: cdk.Duration.seconds(30),
    });

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
      target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomain)),
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

    new cdk.CfnOutput(this, "StripeApiUrl", {
      value: api.url,
      description: "API Gateway URL for Stripe checkout",
    });

    new cdk.CfnOutput(this, "StripeApiCustomUrl", {
      value: `https://pay.${domain}/checkout-session`,
      description: "Custom domain URL for Stripe checkout",
    });
  }
}

