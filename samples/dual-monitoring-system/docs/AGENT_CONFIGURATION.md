# Agent Configuration Guide

This project uses a Strands Swarm multi-agent pattern for an airline reservation system. This guide covers the agent architecture, configuration, and how to customize it.

---

## Swarm Architecture

**Location**: `patterns/strands-swarm-agent/`

The system uses four specialized agents coordinated through the Strands Swarm pattern:

| Agent | Model | Role | Tools |
|-------|-------|------|-------|
| Supervisor | Claude Sonnet 4 | Orchestrates workflow, delegates to specialists | `calculate`, `think`, `transfer_to_human_agents` |
| User Agent | Claude 3 Sonnet | Manages user profiles and certificates | `get_user_details`, `send_certificate` |
| Flight Agent | Claude 3 Sonnet | Searches routes and airport information | `search_direct_flight`, `search_onestop_flight`, `list_all_airports` |
| Reservation Agent | Claude 3 Sonnet | Manages booking lifecycle | `book_reservation`, `cancel_reservation`, `get_reservation_details`, `update_reservation_*` |

The Supervisor receives all requests, plans subtasks, and dynamically routes work to specialists. Specialists return results to the Supervisor, which synthesizes the final response.

## Key Files

- `patterns/strands-swarm-agent/swarm_agent.py` — Main agent implementation with all four agents, swarm creation, and memory integration
- `patterns/strands-swarm-agent/airline/tools_strands/` — Tool implementations (flight search, reservations, user profiles)
- `patterns/strands-swarm-agent/airline/data/` — Mock data for the airline domain
- `patterns/strands-swarm-agent/Dockerfile` — Container configuration
- `patterns/strands-swarm-agent/requirements.txt` — Python dependencies

## Model Configuration

Each agent's model is configured in `swarm_agent.py`:

```python
# Supervisor — uses a more capable model for orchestration
model = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
    temperature=0.0,
    top_p=1,
)

# Specialist agents — use Claude 3 Sonnet for cost efficiency
model = BedrockModel(
    model_id="anthropic.claude-3-sonnet-20240229-v1:0",
    temperature=0.0,
    top_p=1,
)
```

To change models, update the `model_id` in the corresponding `create_*_agent()` function.

## System Prompts

Each agent has a domain-specific system prompt defined in its `create_*_agent()` function. The Supervisor prompt includes:

- Domain policy (airline-specific rules)
- Delegation instructions (when to route to which specialist)
- Response formatting guidelines

Specialist prompts focus on their specific domain (user data, flights, reservations).

## Swarm Configuration

The swarm is created with these settings in `swarm_agent.py`:

```python
swarm = Swarm(
    agents=[supervisor, user_agent, flight_agent, reservation_agent],
    supervisor=supervisor,
    max_handoffs=15,
)
```

- `max_handoffs=15` — limits the number of agent-to-agent delegations per request

## Memory Integration

The swarm uses AgentCore Memory for conversation history:

```python
memory_config = AgentCoreMemoryConfig(memory_id=os.environ["MEMORY_ID"])
session_manager = AgentCoreMemorySessionManager(config=memory_config)
```

Memory is configured via the `MEMORY_ID` environment variable, set automatically by CDK during deployment.

## Environment Variables

| Variable | Description | Set By |
|----------|-------------|--------|
| `STACK_NAME` | CDK stack name, used for SSM parameter lookups | CDK |
| `MEMORY_ID` | AgentCore Memory resource ID | CDK |
| `AWS_REGION` | AWS region | CDK |

## Adding Tools

1. Create a new tool in `patterns/strands-swarm-agent/airline/tools_strands/`:

```python
from strands import tool

@tool
def my_new_tool(param: str) -> str:
    """Tool description for the LLM."""
    return f"Result: {param}"
```

2. Import it in `swarm_agent.py` and add to the appropriate agent's tool list
3. Redeploy with `cd infra-cdk && npx cdk deploy`

## Deployment

See the [Deployment Guide](DEPLOYMENT.md) for full instructions. After making agent changes:

```bash
cd infra-cdk && npx cdk deploy
```

This rebuilds the Docker container and updates the AgentCore Runtime.
