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
exports.DashboardStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
/**
 * CloudWatch Dashboard for E-Info Platform
 *
 * Provides comprehensive monitoring with widgets for:
 * - Lambda performance (invocations, errors, duration)
 * - DynamoDB metrics
 * - SQS queue health
 * - HTTP and business metrics
 */
class DashboardStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const dashboard = new cloudwatch.Dashboard(this, "E-InfoDashboard", {
            dashboardName: "e-info-platform-monitoring",
        });
        // Lambda Performance Section
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: "# Lambda Performance & Reliability",
            width: 24,
            height: 1,
        }));
        // Payment Session Metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: "Payment Session - Invocations & Errors",
            left: [
                new cloudwatch.Metric({
                    namespace: "AWS/Lambda",
                    metricName: "Invocations",
                    dimensionsMap: { FunctionName: props.paymentSessionFunctionName },
                    statistic: "Sum",
                    period: cdk.Duration.minutes(5),
                    label: "Invocations",
                }),
                new cloudwatch.Metric({
                    namespace: "AWS/Lambda",
                    metricName: "Errors",
                    dimensionsMap: { FunctionName: props.paymentSessionFunctionName },
                    statistic: "Sum",
                    period: cdk.Duration.minutes(5),
                    color: cloudwatch.Color.RED,
                    label: "Errors",
                }),
            ],
            width: 12,
            height: 6,
        }));
        // Generate Website Metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: "Generate Website - Invocations & Errors",
            left: [
                new cloudwatch.Metric({
                    namespace: "AWS/Lambda",
                    metricName: "Invocations",
                    dimensionsMap: { FunctionName: props.generateWebsiteFunctionName },
                    statistic: "Sum",
                    period: cdk.Duration.minutes(5),
                    label: "Invocations",
                }),
                new cloudwatch.Metric({
                    namespace: "AWS/Lambda",
                    metricName: "Errors",
                    dimensionsMap: { FunctionName: props.generateWebsiteFunctionName },
                    statistic: "Sum",
                    period: cdk.Duration.minutes(5),
                    color: cloudwatch.Color.RED,
                    label: "Errors",
                }),
            ],
            width: 12,
            height: 6,
        }));
        // DynamoDB Metrics Section
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: "# DynamoDB Performance",
            width: 24,
            height: 1,
        }));
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: "DynamoDB - User & System Errors",
            left: [
                new cloudwatch.Metric({
                    namespace: "AWS/DynamoDB",
                    metricName: "UserErrors",
                    dimensionsMap: { TableName: props.metadataTableName },
                    statistic: "Sum",
                    period: cdk.Duration.minutes(5),
                    color: cloudwatch.Color.RED,
                    label: "User Errors",
                }),
                new cloudwatch.Metric({
                    namespace: "AWS/DynamoDB",
                    metricName: "SystemErrors",
                    dimensionsMap: { TableName: props.metadataTableName },
                    statistic: "Sum",
                    period: cdk.Duration.minutes(5),
                    color: cloudwatch.Color.ORANGE,
                    label: "System Errors",
                }),
            ],
            width: 12,
            height: 6,
        }));
        // SQS Queue Metrics Section
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: "# SQS Queue Health",
            width: 24,
            height: 1,
        }));
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: "SQS - Message Count",
            left: [
                new cloudwatch.Metric({
                    namespace: "AWS/SQS",
                    metricName: "ApproximateNumberOfMessagesVisible",
                    dimensionsMap: { QueueName: props.queueName },
                    statistic: "Average",
                    period: cdk.Duration.minutes(1),
                    label: "Visible Messages",
                }),
                new cloudwatch.Metric({
                    namespace: "AWS/SQS",
                    metricName: "ApproximateNumberOfMessagesNotVisible",
                    dimensionsMap: { QueueName: props.queueName },
                    statistic: "Average",
                    period: cdk.Duration.minutes(1),
                    color: cloudwatch.Color.ORANGE,
                    label: "Processing",
                }),
            ],
            width: 12,
            height: 6,
        }));
        // Health Check Section
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: "# Health Check Endpoint",
            width: 24,
            height: 1,
        }));
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: "Health Check - Status",
            left: [
                new cloudwatch.Metric({
                    namespace: "AWS/Lambda",
                    metricName: "Invocations",
                    dimensionsMap: { FunctionName: props.healthCheckFunctionName },
                    statistic: "Sum",
                    period: cdk.Duration.minutes(1),
                    label: "Checks Run",
                }),
                new cloudwatch.Metric({
                    namespace: "AWS/Lambda",
                    metricName: "Errors",
                    dimensionsMap: { FunctionName: props.healthCheckFunctionName },
                    statistic: "Sum",
                    period: cdk.Duration.minutes(1),
                    color: cloudwatch.Color.RED,
                    label: "Errors",
                }),
            ],
            width: 12,
            height: 6,
        }));
        // Summary Section
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: "# Monitoring Summary\n\n" +
                "- Monitor Lambda error rates and duration percentiles\n" +
                "- Track DynamoDB user/system errors\n" +
                "- Watch SQS queue backlog and message age\n" +
                "- Check health endpoint status\n\n" +
                "See `shared/cloudwatch-queries.js` for detailed CloudWatch Insights queries",
            width: 24,
            height: 4,
        }));
    }
}
exports.DashboardStack = DashboardStack;
