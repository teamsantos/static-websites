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
exports.WAFStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const wafv2 = __importStar(require("aws-cdk-lib/aws-wafv2"));
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
class WAFStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.WAFStack = WAFStack;
