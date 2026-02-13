import * as cdk from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

interface WAFStackProps extends cdk.StackProps {
  paymentApi?: apigateway.RestApi;
  generateApi?: apigateway.RestApi;
}

/**
 * AWS WAF Stack for Rate Limiting and Origin Protection
 *
 * Protects API endpoints from spam and DoS attacks:
 * - 100 requests/5 min per IP for /auth/send-code (AWS minimum, strictest)
 * - 500 requests/5 min per IP for /generate-website
 * - 2000 requests/5 min per IP for /checkout-session
 * - 100 requests/5 min per IP for all other endpoints
 * - Blocks requests from non-allowed origins at firewall level
 *
 * Cost: ~$5/month for WAF (toggle with config.wafEnabled)
 */
export class WAFStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: WAFStackProps) {
    super(scope, id, props);

    // Allowed origins for CORS validation at WAF level
    const allowedOrigins = [
      "https://editor.e-info.click",
      "https://ssh.e-info.click",
      "https://e-info.click",
      "https://www.e-info.click",
    ];

    // Create WAF Web ACL for rate limiting with REGIONAL scope for API Gateway
    const webAcl = new wafv2.CfnWebACL(this, "RateLimitACL", {
      scope: "REGIONAL", // Changed from CLOUDFRONT to attach directly to API Gateway
      defaultAction: {
        allow: {},
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "RateLimitACL",
      },
      rules: [
        // Rule 1: Block requests without valid Origin header
        // This prevents direct API access from curl/scripts without browser origin
        {
          name: "OriginValidationRule",
          priority: 0,
          action: {
            block: {},
          },
          statement: {
            notStatement: {
              statement: {
                orStatement: {
                  statements: allowedOrigins.map((origin) => ({
                    byteMatchStatement: {
                      fieldToMatch: {
                        singleHeader: {
                          name: "origin",
                        },
                      },
                      positionalConstraint: "EXACTLY",
                      searchString: origin,
                      textTransformations: [
                        {
                          priority: 0,
                          type: "LOWERCASE",
                        },
                      ],
                    },
                  })),
                },
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "OriginValidationRule",
          },
        },
        // Rule 2: Rate limiting for /auth/send-code - 100 requests per 5 minutes (AWS minimum)
        // Combined with 10s frontend cooldown, this prevents email spam
        // AWS WAF minimum is 100; for stricter limits, use application-level rate limiting
        {
          name: "SendCodeRateLimitRule",
          priority: 1,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              limit: 100, // AWS WAF minimum is 100 requests per 5 minutes per IP
              aggregateKeyType: "IP",
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: {
                    uriPath: {},
                  },
                  positionalConstraint: "ENDS_WITH",
                  textTransformations: [
                    {
                      priority: 0,
                      type: "LOWERCASE",
                    },
                  ],
                  searchString: "/auth/send-code",
                },
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "SendCodeRateLimitRule",
          },
        },
        // Rule 3: Rate limiting for /checkout-session: 2000 requests per 5 minutes per IP
        {
          name: "RateLimitRule",
          priority: 2,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              limit: 2000, // 2000 requests per 5 minutes = ~400 per minute = ~7 per second
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
        // Rule 4: Generate rate limiting rule: 500 requests per 5 minutes per IP
        {
          name: "GenerateRateLimitRule",
          priority: 3,
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
        // Rule 5: General API rate limiting - 100 requests per 5 minutes for all other endpoints
        {
          name: "GeneralRateLimitRule",
          priority: 4,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              limit: 100, // 100 requests per 5 minutes per IP for general API usage
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "GeneralRateLimitRule",
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

    // Store the WebACL for attachment to APIs
    this.webAcl = webAcl;
  }

  public webAcl: wafv2.CfnWebACL;
}
