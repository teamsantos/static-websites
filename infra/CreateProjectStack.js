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
exports.CreateProjectStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const aws_certificatemanager_1 = require("aws-cdk-lib/aws-certificatemanager");
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
class CreateProjectStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const domain = props?.domain || 'e-info.click';
        const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: domain,
        });
        const certificate = new aws_certificatemanager_1.DnsValidatedCertificate(this, 'ApiCertificate', {
            domainName: `api.${domain}`,
            hostedZone: hostedZone,
            region: 'us-east-1',
        });
        const createProjectFunction = new lambda.Function(this, 'CreateProjectFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/create-project'),
            handler: 'index.handler',
            environment: {
                GITHUB_TOKEN: `{{resolve:secretsmanager:github-token:SecretString}}`,
                GITHUB_OWNER: `{{resolve:secretsmanager:github-config:SecretString:owner}}`,
                GITHUB_REPO: `{{resolve:secretsmanager:github-config:SecretString:repo}}`,
                FROM_EMAIL: 'noreply@e-info.click',
                AWS_SES_REGION: props?.ses_region || "us-east-1"
            },
            timeout: cdk.Duration.seconds(30),
        });
        const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubToken', 'github-token');
        const githubConfigSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubConfig', 'github-config');
        githubTokenSecret.grantRead(createProjectFunction);
        githubConfigSecret.grantRead(createProjectFunction);
        createProjectFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail'],
            resources: ['*'],
        }));
        const api = new apigateway.RestApi(this, 'CreateProjectApi', {
            restApiName: 'create-project-api',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'Origin'],
            },
        });
        // Custom domain for API
        const apiDomain = new apigateway.DomainName(this, 'ApiDomain', {
            domainName: `api.${domain}`,
            certificate: certificate,
            endpointType: apigateway.EndpointType.EDGE,
        });
        // Map domain to API
        new apigateway.BasePathMapping(this, 'ApiMapping', {
            domainName: apiDomain,
            restApi: api,
        });
        // Route53 A record for API domain
        new route53.ARecord(this, 'ApiAliasRecord', {
            zone: hostedZone,
            recordName: `api.${domain}`,
            target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomain)),
        });
        const createProjectResource = api.root.addResource('create-project');
        createProjectResource.addMethod('POST', new apigateway.LambdaIntegration(createProjectFunction, {
            integrationResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                },
                {
                    statusCode: '400',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                },
                {
                    statusCode: '403',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                },
                {
                    statusCode: '409',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                },
                {
                    statusCode: '500',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                },
            ],
        }), {
            methodResponses: [
                {
                    statusCode: '200',
                },
                {
                    statusCode: '400',
                },
                {
                    statusCode: '403',
                },
                {
                    statusCode: '409',
                },
                {
                    statusCode: '500',
                },
            ],
        });
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'API Gateway URL for creating projects (restricted to allowed origins)',
        });
        new cdk.CfnOutput(this, 'ApiCustomUrl', {
            value: `https://api.${domain}/create-project`,
            description: 'Custom domain URL for creating projects',
        });
    }
}
exports.CreateProjectStack = CreateProjectStack;
