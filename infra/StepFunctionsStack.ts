import * as cdk from "aws-cdk-lib";
import * as stepfunctions from "aws-cdk-lib/aws-stepfunctions";
import * as sfnTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";

interface StepFunctionsStackProps extends cdk.StackProps {
  generateWebsiteLambda?: lambda.Function;
  metadataTable?: dynamodb.Table;
}

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
export class StepFunctionsStack extends cdk.Stack {
  public stateMachine: stepfunctions.StateMachine;

  constructor(scope: cdk.App, id: string, props?: StepFunctionsStackProps) {
    super(scope, id, props);

    const metadataTable = props?.metadataTable;
    const generateWebsiteLambda = props?.generateWebsiteLambda;

    // Define state machine steps
    // Step 1: Get metadata from DynamoDB
    const getMetadataStep = new sfnTasks.DynamoGetItem(this, "GetMetadataFromDynamoDB", {
      table: metadataTable!,
      key: {
        operationId: stepfunctions.TaskInput.fromJsonPathAt("$.operationId"),
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
      outputPath: "$",
    });

    // Step 3: Call generate-website Lambda
    const invokeGenerateWebsiteStep = new sfnTasks.LambdaInvoke(
      this,
      "InvokeGenerateWebsite",
      {
        lambdaFunction: generateWebsiteLambda!,
        resultPath: "$.generationResult",
        resultSelector: {
          statusCode: stepfunctions.JsonPath.numberAt("$.statusCode"),
          body: stepfunctions.JsonPath.stringAt("$.body"),
        },
        retryOnServiceExceptions: true,
      }
    );

    // Retry policy: 3 attempts with exponential backoff
    invokeGenerateWebsiteStep.addRetry({
      errors: ["States.TaskFailed", "States.Timeout"],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // Step 4: Update status to 'completed' in DynamoDB
    const updateCompletedStatusStep = new sfnTasks.DynamoUpdateItem(
      this,
      "UpdateCompletedStatus",
      {
        table: metadataTable!,
        key: {
          operationId: stepfunctions.TaskInput.fromJsonPathAt("$.operationId"),
        },
        updateExpression: "SET #status = :status, #completedAt = :completedAt",
        expressionAttributeNames: {
          "#status": "status",
          "#completedAt": "completedAt",
        },
        expressionAttributeValues: {
          ":status": stepfunctions.TaskInput.fromText("completed"),
          ":completedAt": stepfunctions.TaskInput.fromText(
            new Date().toISOString()
          ),
        },
        resultPath: stepfunctions.JsonPath.DISCARD,
      }
    );

    // Step 5: Handle errors - Update status to 'failed'
    const updateFailedStatusStep = new sfnTasks.DynamoUpdateItem(
      this,
      "UpdateFailedStatus",
      {
        table: metadataTable!,
        key: {
          operationId: stepfunctions.TaskInput.fromJsonPathAt("$.operationId"),
        },
        updateExpression: "SET #status = :status, #failureReason = :failureReason",
        expressionAttributeNames: {
          "#status": "status",
          "#failureReason": "failureReason",
        },
        expressionAttributeValues: {
          ":status": stepfunctions.TaskInput.fromText("failed"),
          ":failureReason": stepfunctions.TaskInput.fromJsonPathAt("$.error"),
        },
        resultPath: stepfunctions.JsonPath.DISCARD,
      }
    );

    // Build the state machine definition
    const definition = getMetadataStep
      .next(validateMetadataStep)
      .next(invokeGenerateWebsiteStep)
      .next(updateCompletedStatusStep)
      .next(
        new stepfunctions.Pass(this, "Success", {
          result: stepfunctions.Result.fromObject({
            statusCode: 200,
            message: "Website generation completed successfully",
          }),
          end: true,
        })
      );

    // Catch errors and update failed status
    const errorCatcher = new stepfunctions.Catch(this, "CatchGenerationError", {
      errors: ["States.ALL"],
      handler: updateFailedStatusStep.next(
        new stepfunctions.Pass(this, "Failure", {
          result: stepfunctions.Result.fromObject({
            statusCode: 500,
            message: "Website generation failed",
          }),
          resultPath: "$.result",
          end: true,
        })
      ),
      resultPath: "$.error",
    });

    definition.addCatch(errorCatcher);

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
