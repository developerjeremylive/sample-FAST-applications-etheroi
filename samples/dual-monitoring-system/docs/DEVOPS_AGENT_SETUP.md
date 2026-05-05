# AWS DevOps Agent Setup Guide

This guide walks you through deploying the AWS DevOps Agent and connecting it to the Dual Monitoring system.

## Overview

The DevOps Agent acts as an autonomous on-call engineer. When incidents occur, it analyzes CloudWatch logs, traces failures across service boundaries (IAM, Bedrock, AgentCore Runtime), and provides root cause analysis with remediation steps.

The integration has three parts:
1. **DevOps Agent Space** — the AWS-managed agent that performs investigations
2. **Event Channel Webhook** — how incidents are sent to the agent
3. **Proxy Lambda** — bridges the frontend UI to the webhook with HMAC signing

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18+ and AWS CDK CLI installed
- The main Dual Monitoring stack already deployed (`cdk deploy` completed)

## Step 1: Deploy the DevOps Agent Space

Use the [sample-aws-devops-agent-cdk](https://github.com/aws-samples/sample-aws-devops-agent-cdk) repo:

```bash
git clone https://github.com/aws-samples/sample-aws-devops-agent-cdk.git
cd sample-aws-devops-agent-cdk
```

Edit `lib/constants.ts` and set your account ID:

```typescript
export const MONITORING_ACCOUNT_ID = "<YOUR_ACCOUNT_ID>";
```

Deploy:

```bash
npm install
npm run build
cdk deploy DevOpsAgentStack
```

Note the outputs:
```
DevOpsAgentStack.AgentSpaceArn = arn:aws:aidevops:us-east-1:<ACCOUNT_ID>:agentspace/<SPACE_ID>
```

Save the `<SPACE_ID>` — you'll need it in Step 3.

## Step 2: Create the Event Channel Webhook

You can create the webhook via CDK or the console.

### Option A: Via CDK (Recommended)

Add an Event Channel association to the `devops-agent-stack.ts`:

```typescript
import * as devopsagent from 'aws-cdk-lib/aws-devopsagent';

const eventChannel = new devopsagent.CfnAssociation(this, 'EventChannelAssociation', {
  agentSpaceId: agentSpace.ref,
  serviceId: 'event-channel',
  configuration: {
    eventChannel: {
      enableWebhookUpdates: true,
    },
  },
});
eventChannel.addDependency(agentSpace);
```

Redeploy:

```bash
npm run build
cdk deploy DevOpsAgentStack
```

### Option B: Via Console

1. Open the [AWS DevOps Agent Console](https://console.aws.amazon.com/devops-agent/)
2. Navigate to **Agent Spaces** → select your space
3. Go to the **Webhooks** or **Event Channels** tab → **Create webhook**
4. Copy the webhook URL and HMAC secret

## Step 3: Store Webhook Credentials

The proxy Lambda reads the webhook URL from SSM and the HMAC secret from Secrets Manager.

```bash
# Store the webhook URL
aws ssm put-parameter \
  --name "/prod-agent-monitoring-stack/devops-agent/webhook-url" \
  --value "https://event-ai.<REGION>.api.aws/webhook/generic/<WEBHOOK_ID>" \
  --type String \
  --overwrite

# Store the HMAC secret
aws secretsmanager create-secret \
  --name "/prod-agent-monitoring-stack/devops-agent/webhook-secret" \
  --secret-string "<YOUR_HMAC_SECRET>"
```

Replace the parameter name prefix if your stack name differs from `prod-agent-monitoring-stack`.

## Step 4: Set the Agent Space ID

Update the proxy Lambda's environment variable:

```bash
aws lambda update-function-configuration \
  --function-name prod-agent-monitoring-stack-devops-agent \
  --environment "Variables={ \
    AGENT_SPACE_ID=<YOUR_SPACE_ID>, \
    WEBHOOK_URL_PARAM=/prod-agent-monitoring-stack/devops-agent/webhook-url, \
    WEBHOOK_SECRET_ARN=/prod-agent-monitoring-stack/devops-agent/webhook-secret, \
    CORS_ALLOWED_ORIGIN=<YOUR_AMPLIFY_URL> \
  }"
```

## Step 5: Redeploy Frontend

```bash
python scripts/deploy-frontend.py
```

This picks up the `DevOpsIncidentApiUrl` from CDK outputs and writes it to `aws-exports.json`.

## Verification

1. Open your Amplify URL and navigate to the **DevOps Agent** tab
2. Submit a test incident (e.g., "High CPU usage on production server")
3. Check the DevOps Agent console — you should see a new investigation started

## How It Works

```
Frontend (DevOps Agent tab)
  → POST /devops-agent/incident
    → API Gateway (Cognito auth)
      → Proxy Lambda
        → Reads webhook URL from SSM
        → Reads HMAC secret from Secrets Manager
        → HMAC-signs the incident payload
        → Forwards to DevOps Agent webhook
          → DevOps Agent investigates
            → Pulls CloudWatch logs
            → Builds topology graph
            → Identifies root cause
            → Returns remediation steps
```

## Troubleshooting

**"Incident API URL is missing"** — Run `python scripts/deploy-frontend.py` to regenerate `aws-exports.json`.

**"Could not retrieve webhook URL"** — Verify the SSM parameter exists:
```bash
aws ssm get-parameter --name "/prod-agent-monitoring-stack/devops-agent/webhook-url"
```

**"Could not retrieve webhook secret"** — Verify the secret exists:
```bash
aws secretsmanager get-secret-value --secret-id "/prod-agent-monitoring-stack/devops-agent/webhook-secret"
```

**Webhook returns 403** — The HMAC secret may be incorrect. Re-copy it from the DevOps Agent console and update Secrets Manager.

**No investigation started** — Check the proxy Lambda logs:
```bash
aws logs tail /aws/lambda/prod-agent-monitoring-stack-devops-agent --follow
```
