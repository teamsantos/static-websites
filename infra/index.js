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
const cdk = __importStar(require("aws-cdk-lib"));
const bucketStack_1 = require("./bucketStack");
const ProjectStack_1 = require("./ProjectStack");
const CreateProjectStack_1 = require("./CreateProjectStack");
const app = new cdk.App();
const config = {
    region: "eu-south-2",
    domain: "e-info.click",
    s3Bucket: "teamsantos-static-websites",
    certificateRegion: "us-east-1",
};
const account = process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account');
if (!account) {
    console.warn("Warning: No AWS account specified. Use CDK_DEFAULT_ACCOUNT env var or --profile");
}
new bucketStack_1.BucketStack(app, "StaticWebsitesBucket", {
    bucketName: config.s3Bucket,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "StaticWebsiteHosting",
    },
});
new CreateProjectStack_1.CreateProjectStack(app, "CreateProjectStack", {
    env: {
        account: account,
        region: config.region,
    },
    domain: config.domain,
    certificateRegion: config.certificateRegion,
});
const projectsParam = app.node.tryGetContext("projects");
const templatesParam = app.node.tryGetContext("templates");
if (!projectsParam && !templatesParam) {
    console.error("No projects or templates provided.");
    console.log("Usage: cdk deploy --context projects=\"project1,project2\" --context templates=\"template1,template2\"");
    console.log("You can specify either projects, templates, or both.");
}
else {
    let totalStacks = 0;
    // Handle projects
    if (projectsParam) {
        const projects = projectsParam.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
        if (projects.length > 0) {
            console.log(`Deploying ${projects.length} project(s): ${projects.join(", ")}`);
            projects.forEach((project) => {
                if (!/^[a-z0-9-]+$/.test(project)) {
                    console.warn(`Warning: Project name '${project}' may not be DNS-safe. Use lowercase letters, numbers, and hyphens only.`);
                }
                console.log(`Creating stack for project: ${project}.${config.domain}`);
                new ProjectStack_1.ProjectSite(app, `Site-${project}`, {
                    s3Bucket: config.s3Bucket,
                    region: config.region,
                    projectName: project,
                    domainName: `${project}.${config.domain}`,
                    hostedZoneDomainName: config.domain,
                    type: 'project',
                    env: {
                        account: account,
                        region: config.certificateRegion,
                    },
                    tags: {
                        Project: project,
                        Type: 'project',
                        Domain: `${project}.${config.domain}`,
                        ManagedBy: "CDK",
                        Environment: "production",
                    },
                });
            });
            totalStacks += projects.length;
        }
    }
    // Handle templates
    if (templatesParam) {
        const templates = templatesParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (templates.length > 0) {
            console.log(`Deploying ${templates.length} template(s): ${templates.join(", ")}`);
            templates.forEach((template) => {
                if (!/^[a-z0-9-]+$/.test(template)) {
                    console.warn(`Warning: Template name '${template}' may not be DNS-safe. Use lowercase letters, numbers, and hyphens only.`);
                }
                console.log(`Creating stack for template: ${template}.${config.domain}`);
                new ProjectStack_1.ProjectSite(app, `Site-template-${template}`, {
                    s3Bucket: config.s3Bucket,
                    region: config.region,
                    projectName: template,
                    domainName: `${template}.templates.${config.domain}`,
                    hostedZoneDomainName: config.domain,
                    type: 'template',
                    env: {
                        account: account,
                        region: config.certificateRegion,
                    },
                    tags: {
                        Project: template,
                        Type: 'template',
                        Domain: `${template}.templates.${config.domain}`,
                        ManagedBy: "CDK",
                        Environment: "production",
                    },
                });
            });
            totalStacks += templates.length;
        }
    }
    if (totalStacks > 0) {
        console.log(`Created ${totalStacks} stack(s) successfully`);
    }
    else {
        console.error("No valid projects or templates found after parsing.");
    }
}
app.synth();
