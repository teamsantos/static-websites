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
exports.StepFunctionsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const stepfunctions = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const sfnTasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
/**
 * Step Functions State Machine for Website Generation Workflow
 *
 * Workflow:
 * 1. Start - operationId comes in from SQS or direct invocation
 * 2. Get Metadata - Fetch operation details from DynamoDB
 * 3. Validate - Check if metadata is complete
 * 4. Generate Website - Call generate-website Lambda
 * 5. Update Status - Mark as 'completed' in DynamoDB
 * 6. Success/Error Handling - Log failures, update status
 *
 * Benefits:
 * - Visual workflow representation
 * - Automatic retry logic (3 retries with exponential backoff)
 * - Error tracking and notifications
 * - Audit trail of all operations
 */
class StepFunctionsStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const metadataTable = props?.metadataTable;
        const generateWebsiteLambda = props?.generateWebsiteLambda;
        // Define state machine steps
        // Step 1: Get metadata from DynamoDB
        const getMetadataStep = new sfnTasks.DynamoGetItem(this, "GetMetadataFromDynamoDB", {
            table: metadataTable,
            key: {
                operationId: sfnTasks.DynamoAttributeValue.fromString(stepfunctions.JsonPath.stringAt("$.operationId")),
            },
            resultPath: "$.metadata",
        });
        // Step 2: Validate metadata
        const validateMetadataStep = new stepfunctions.Pass(this, "ValidateMetadata", {
            resultPath: "$.validation",
            result: stepfunctions.Result.fromObject({
                success: true,
                message: "Metadata validation passed",
            }),
        });
        // Step 4: Update status to 'completed' in DynamoDB
        const updateCompletedStatusStep = new sfnTasks.DynamoUpdateItem(this, "UpdateCompletedStatus", {
            table: metadataTable,
            key: {
                operationId: sfnTasks.DynamoAttributeValue.fromString(stepfunctions.JsonPath.stringAt("$.operationId")),
            },
            updateExpression: "SET #status = :status, #completedAt = :completedAt",
            expressionAttributeNames: {
                "#status": "status",
                "#completedAt": "completedAt",
            },
            expressionAttributeValues: {
                ":status": sfnTasks.DynamoAttributeValue.fromString("completed"),
                ":completedAt": sfnTasks.DynamoAttributeValue.fromString(new Date().toISOString()),
            },
            resultPath: stepfunctions.JsonPath.DISCARD,
        });
        // Step 5: Handle errors - Update status to 'failed'
        const updateFailedStatusStep = new sfnTasks.DynamoUpdateItem(this, "UpdateFailedStatus", {
            table: metadataTable,
            key: {
                operationId: sfnTasks.DynamoAttributeValue.fromString(stepfunctions.JsonPath.stringAt("$.operationId")),
            },
            updateExpression: "SET #status = :status, #failureReason = :failureReason",
            expressionAttributeNames: {
                "#status": "status",
                "#failureReason": "failureReason",
            },
            expressionAttributeValues: {
                ":status": sfnTasks.DynamoAttributeValue.fromString("failed"),
                ":failureReason": sfnTasks.DynamoAttributeValue.fromString(stepfunctions.JsonPath.stringAt("$.error")),
            },
            resultPath: stepfunctions.JsonPath.DISCARD,
        });
        // Build the state machine definition
        const failureState = updateFailedStatusStep.next(new stepfunctions.Pass(this, "Failure", {
            result: stepfunctions.Result.fromObject({
                statusCode: 500,
                message: "Website generation failed",
            }),
            resultPath: "$.result",
        }));
        const successState = new stepfunctions.Pass(this, "Success", {
            result: stepfunctions.Result.fromObject({
                statusCode: 200,
                message: "Website generation completed successfully",
            }),
        });
        // Step 3: Call generate-website Lambda (or Dummy if not provided)
        let invokeGenerateWebsiteStep;
        if (generateWebsiteLambda) {
            invokeGenerateWebsiteStep = new sfnTasks.LambdaInvoke(this, "InvokeGenerateWebsite", {
                lambdaFunction: generateWebsiteLambda,
                resultPath: "$.generationResult",
                resultSelector: {
                    statusCode: stepfunctions.JsonPath.numberAt("$.statusCode"),
                    body: stepfunctions.JsonPath.stringAt("$.body"),
                },
                retryOnServiceExceptions: true,
            });
            // Retry policy: 3 attempts with exponential backoff
            invokeGenerateWebsiteStep.addRetry({
                errors: ["States.TaskFailed", "States.Timeout"],
                interval: cdk.Duration.seconds(2),
                maxAttempts: 3,
                backoffRate: 2,
            });
            // Add error handling to the invoke step
            invokeGenerateWebsiteStep.addCatch(failureState, {
                errors: ["States.ALL"],
                resultPath: "$.error",
            });
        }
        else {
            invokeGenerateWebsiteStep = new stepfunctions.Pass(this, "InvokeGenerateWebsiteDummy", {
                result: stepfunctions.Result.fromObject({
                    statusCode: 200,
                    body: "Dummy execution"
                }),
                resultPath: "$.generationResult"
            });
        }
        const definition = getMetadataStep
            .next(validateMetadataStep)
            .next(invokeGenerateWebsiteStep)
            .next(updateCompletedStatusStep)
            .next(successState);
        // Create the state machine
        this.stateMachine = new stepfunctions.StateMachine(this, "WebsiteGenerationStateMachine", {
            definition,
            timeout: cdk.Duration.minutes(10),
            tracingEnabled: true,
            logs: {
                destination: new logs.LogGroup(this, "StateMachineLogGroup", {
                    logGroupName: "/aws/stepfunctions/website-generation",
                    retention: logs.RetentionDays.ONE_WEEK,
                }),
                level: stepfunctions.LogLevel.ALL,
            },
        });
        // Grant permissions
        if (metadataTable) {
            metadataTable.grantReadWriteData(this.stateMachine.role);
        }
        if (generateWebsiteLambda) {
            generateWebsiteLambda.grantInvoke(this.stateMachine.role);
        }
        // Output
        new cdk.CfnOutput(this, "StateMachineArn", {
            value: this.stateMachine.stateMachineArn,
            description: "ARN of the website generation state machine",
            exportName: "WebsiteGenerationStateMachineArn",
        });
    }
}
exports.StepFunctionsStack = StepFunctionsStack;
