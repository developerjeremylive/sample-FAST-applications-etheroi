# Dual Monitoring System for Agent Lifecycle with AgentCore Evaluations and AWS DevOps Agent

This repository demonstrates a dual-layer monitoring architecture for multi-agent systems: continuous quality assessment with AgentCore Evaluations and autonomous infrastructure investigation with AWS DevOps Agent.

## The Problem

Agentic solutions in dev/prod env fail in ways traditional monitoring misses. An agent can invoke its model, call every tool without errors, and return a response — while completely misunderstanding what the user needs. Infrastructure metrics stay green while the agent silently degrades. These problems compound in swarm-based systems where execution paths change at runtime and failures propagate unpredictably across agent handoffs.

## What This Repo Demonstrates

### Layer 1: AgentCore Evaluations — Is the Agent Working Well?

A full evaluation dashboard that continuously scores live agent interactions using LLM-as-a-Judge methodology.

**Evaluation Dashboard** — Aggregated quality metrics across sessions with score distribution breakdowns, filterable by date range.

**Session Explorer** — Browse individual sessions, drill into traces and spans to see exactly where an agent spent time or made decisions.

**On-Demand Evaluation** — Run any of the 15 built-in AgentCore evaluators (or custom evaluators) against specific sessions. Useful for investigating user complaints or edge cases that fall outside the sampling rate.

**AI Pattern Analysis** — Identifies recurring failure patterns across low-scoring sessions using unsupervised pattern detection. Surfaces systemic issues like wrong tool selection for specific request types, with frequency counts and affected session IDs.

**Prompt Improvement** — Generates revised prompts that directly address identified patterns, with side-by-side comparison showing what changed, why, and the expected impact.

**Online Evaluation Config** — Configure which evaluators run continuously in production, set sampling rates, and manage evaluation configs through the UI.

### Layer 2: AWS DevOps Agent — Is the Infrastructure Healthy?

An incident submission interface that triggers autonomous infrastructure investigation.

**Incident Submission** — Submit incidents via signed webhook to an AWS DevOps Agent Space. The agent automatically pulls CloudWatch logs, builds topology graphs of affected resources, and correlates errors across services (IAM, Bedrock, AgentCore Runtime).

**Root Cause Analysis** — Traces complete failure paths (e.g., User Request → AgentCore Runtime → Bedrock API Call → Access Denied → Agent Failure) and provides specific remediation steps.

### The Airline Reservation System (Demo Workload)

The monitoring layers are demonstrated on a four-agent swarm built with Strands Agents:

- **Supervisor Agent** — Receives requests, plans subtasks, routes work to specialists
- **Flight Agent** — Searches routes and handles multi-city connections
- **User Agent** — Fetches loyalty status, certificates, and profile data
- **Reservation Agent** — Creates, modifies, and cancels bookings with validation

The swarm uses dynamic handoffs (no fixed execution graph), making it a realistic test case for monitoring — failures can occur at any handoff point and the failure path changes each time.

## Architecture

<!-- TODO: Replace with final architecture diagram -->
![Architecture Diagram](docs/architecture-diagram/Dual-monitoring-20260407.jpg)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   React UI      │     │  Evaluation Dashboard│     │  DevOps Agent Tab   │
│   (Next.js)     │     │  - Dashboard View    │     │  - Incident Submit  │
│                 │     │  - Session Explorer  │     │  - Webhook Trigger  │
│                 │     │  - AI Analysis       │     │                     │
└────────┬────────┘     └──────────┬───────────┘     └──────────┬──────────┘
         │                         │                            │
         ▼                         ▼                            ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  AgentCore      │     │  Evaluation Lambda   │     │  DevOps Agent       │
│  Runtime        │────▶│  (CloudWatch Logs +  │     │  Lambda (Webhook    │
│  (Swarm Agent)  │     │   AgentCore SDK)     │     │   + SigV4 Signing)  │
└────────┬────────┘     └──────────┬───────────┘     └──────────┬──────────┘
         │                         │                            │
         ▼                         ▼                            ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Amazon Bedrock │     │  Amazon CloudWatch   │     │  AWS DevOps Agent   │
│  + AgentCore    │     │  (Logs, Metrics,     │     │  Space              │
│  Gateway        │     │   OTel Traces)       │     │  (Investigations)   │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
```

## Project Structure

```
├── frontend/src/components/
│   ├── evaluations/          # Evaluation dashboard (12 components)
│   │   ├── DashboardView     # Aggregated metrics & score distributions
│   │   ├── SessionExplorer   # Session browsing & filtering
│   │   ├── TraceViewer       # Trace & span visualization
│   │   ├── OnDemandEvaluation# Run evaluators on specific sessions
│   │   ├── AnalysisPanel     # AI pattern detection
│   │   ├── PromptComparison  # Side-by-side prompt improvements
│   │   └── ...               # Charts, filters, error handling
│   ├── devops-agent/         # DevOps Agent incident submission
│   └── chat/                 # Chat interface for the swarm agent
├── infra-cdk/
│   ├── lib/                  # CDK stacks (backend, cognito, evaluation, devops)
│   └── lambdas/
│       ├── evaluation/       # Evaluation API (sessions, metrics, analysis, on-demand)
│       ├── devops-agent/     # Incident webhook proxy with SigV4 signing
│       └── feedback/         # User feedback collection
├── patterns/
│   └── strands-swarm-agent/  # Four-agent swarm implementation
│       └── airline/          # Airline domain tools (flights, reservations, users)
├── gateway/                  # AgentCore Gateway tool access
├── tests/                    # Unit and property-based tests
└── docs/                     # Deployment, configuration, and integration guides
```

## Quick Start

This project is built on the [Fullstack AgentCore Solution Template (FAST)](https://github.com/awslabs/fullstack-solution-template-for-agentcore) for deployment infrastructure. See the FAST documentation for detailed CDK, Cognito, and Amplify setup.

### Prerequisites

- Node.js 20+, Python 3.11+, AWS CLI configured
- Docker or Finch running
- AWS CDK CLI: `npm install -g aws-cdk`

### Deploy

```bash
# Backend
cd infra-cdk
npm install
cdk bootstrap    # first time only
cdk deploy

# Configure runtime logging (required for evaluation dashboard)
# See docs/DEPLOYMENT.md for console or CLI instructions

# Frontend
cd ..
python scripts/deploy-frontend.py
```

### Create a User

- Go to AWS Cognito Console → find your User Pool → create a user with a verified email

### Access

- Chat: `https://<your-amplify-url>/`
- Evaluations: `https://<your-amplify-url>/evaluations`
- DevOps Agent: `https://<your-amplify-url>/devops-agent`

## Key Technologies

- **Amazon Bedrock AgentCore** — Runtime, Gateway, Identity, Evaluations, Observability
- **Strands Agents** — Multi-agent swarm orchestration
- **AWS DevOps Agent** — Autonomous infrastructure investigation
- **OpenTelemetry** — Distributed tracing via AgentCore Runtime → CloudWatch
- **React / Next.js** — Frontend with evaluation dashboard components
- **AWS CDK** — Infrastructure as code

## Configuration

### Online Evaluation

Configure which evaluators run continuously and at what sampling rate:

```yaml
evaluations:
  online_evaluation:
    enabled: true
    sampling_rate: 0.20    # 20% of requests
    evaluators:
      - helpfulness
      - correctness
      - goal_success_rate
```

### DevOps Agent Webhook

The DevOps Agent requires a separate CDK deployment to create the Agent Space. Use the [sample-aws-devops-agent-cdk](https://github.com/aws-samples/sample-aws-devops-agent-cdk) repo:

```bash
git clone https://github.com/aws-samples/sample-aws-devops-agent-cdk.git
cd sample-aws-devops-agent-cdk

# Set your account ID in lib/constants.ts
npm install && npm run build
cdk deploy DevOpsAgentStack
```

After the Agent Space is deployed, add an Event Channel association to create the webhook programmatically:

```typescript
import * as devopsagent from 'aws-cdk-lib/aws-devopsagent';

// Create event channel association (this generates the webhook URL + secret)
const eventChannel = new devopsagent.CfnAssociation(this, 'EventChannelAssociation', {
  agentSpaceId: agentSpace.ref,       // from DevOpsAgentStack
  serviceId: 'event-channel',
  configuration: {
    eventChannel: {
      enableWebhookUpdates: true,
    },
  },
});
```

The association outputs a webhook URL and HMAC secret. The proxy Lambda in this repo (`infra-cdk/lambdas/devops-agent/index.py`) receives incidents from the frontend, HMAC-signs them, and forwards to that webhook. It needs these environment variables:
- `AGENT_SPACE_ID` — from the DevOps Agent CDK output
- `WEBHOOK_URL_PARAM` — SSM parameter name storing the webhook URL
- `WEBHOOK_SECRET_ARN` — Secrets Manager ARN storing the HMAC secret

For the full CDK setup including IAM roles and cross-account monitoring, see the [sample-aws-devops-agent-cdk](https://github.com/aws-samples/sample-aws-devops-agent-cdk) repo and the [DevOps Agent webhook documentation](https://docs.aws.amazon.com/devopsagent/latest/userguide/configuring-capabilities-for-aws-devops-agent-invoking-devops-agent-through-webhook.html).

## Testing

```bash
make test              # all tests
make test-unit         # unit tests
make test-property     # property-based tests
```

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Dataset Setup](docs/DATASET_SETUP.md)
- [Agent Configuration](docs/AGENT_CONFIGURATION.md)
- [DevOps Agent Setup](docs/DEVOPS_AGENT_SETUP.md)
- [Gateway Integration](docs/GATEWAY.md)
- [Streaming](docs/STREAMING.md)

## License

Apache-2.0

