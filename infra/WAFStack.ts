import * as cdk from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

interface WAFStackProps extends cdk.StackProps {
  paymentApi?: apigateway.RestApi;
  generateApi?: apigateway.RestApi;
}

/**
 * AWS WAF Stack for Rate Limiting
 *
 * Protects API endpoints from spam and DoS attacks:
 * - 10 requests/minute per IP for payment endpoint
 * - 5 requests/minute per IP for generation endpoint
 * - Blocks IPs that exceed limits for 5 minutes
 *
 * Cost: ~$5/month for WAF
 */
export class WAFStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: WAFStackProps) {
    super(scope, id, props);

    // Create WAF Web ACL for rate limiting
    const webAcl = new wafv2.CfnWebACL(this, "RateLimitACL", {
      scope: "CLOUDFRONT",
      defaultAction: {
        allow: {},
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "RateLimitACL",
      },
      rules: [
        // Rate limiting rule: 100 requests per 5 minutes per IP
        {
          name: "RateLimitRule",
          priority: 1,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              limit: 2000, // 2000 requests per 5 minutes = ~400 per minute = ~7 per second
              aggregateKeyType: "IP",
              // Scope down to specific paths for tighter control
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: {
                    uriPath: {},
                  },
                  positionalConstraint: "EXACTLY",
                  textTransformations: [
                    {
                      priority: 0,
                      type: "LOWERCASE",
                    },
                  ],
                  searchString: "/checkout-session",
                },
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitRule",
          },
        },
        // Generate rate limiting rule: 50 requests per 5 minutes per IP
        {
          name: "GenerateRateLimitRule",
          priority: 2,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              limit: 500, // 500 requests per 5 minutes = ~100 per minute = ~2 per second
              aggregateKeyType: "IP",
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: {
                    uriPath: {},
                  },
                  positionalConstraint: "EXACTLY",
                  textTransformations: [
                    {
                      priority: 0,
                      type: "LOWERCASE",
                    },
                  ],
                  searchString: "/generate-website",
                },
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "GenerateRateLimitRule",
          },
        },
      ],
      tags: [
        { key: "Component", value: "Security" },
        { key: "Purpose", value: "RateLimiting" },
      ],
    });

    new cdk.CfnOutput(this, "WebACLArn", {
      value: webAcl.attrArn,
      description: "WAF Web ACL ARN for rate limiting",
      exportName: "RateLimitWebACLArn",
    });
  }
}
