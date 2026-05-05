# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Strands Swarm Agent - Multi-agent orchestration pattern for AWS AgentCore.

This module implements a four-agent swarm system that collaborates through handoffs:
- Supervisor Agent: Orchestrates workflow and delegates to specialized agents
- User Agent: Manages user profile operations and certificate issuance
- Flight Agent: Handles flight searches and airport information
- Reservation Agent: Manages booking lifecycle operations

The swarm integrates with:
- AgentCore Gateway: Centralized tool access through OAuth2-authenticated MCP protocol
- AgentCore Memory: Conversation history and session state management
- Amazon Bedrock: LLM interactions for all agents
"""

import os
import sys
import traceback
from pathlib import Path
from typing import Dict, Any

import boto3
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models import BedrockModel
from strands.multiagent import Swarm

app = BedrockAgentCoreApp()

# Add the current directory to Python path to enable airline module imports
current_dir = Path(__file__).parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

# Import airline tools directly from the tools_strands module
from airline.tools_strands import (
    book_reservation,
    calculate,
    cancel_reservation,
    get_reservation_details,
    get_user_details,
    list_all_airports,
    search_direct_flight,
    search_onestop_flight,
    send_certificate,
    think,
    transfer_to_human_agents,
    update_reservation_baggages,
    update_reservation_flights,
    update_reservation_passengers,
)

print("[TOOLS] Airline tools imported successfully")

# Create a dictionary for easy tool lookup
AIRLINE_TOOLS = {
    "book_reservation": book_reservation,
    "calculate": calculate,
    "cancel_reservation": cancel_reservation,
    "get_reservation_details": get_reservation_details,
    "get_user_details": get_user_details,
    "list_all_airports": list_all_airports,
    "search_direct_flight": search_direct_flight,
    "search_onestop_flight": search_onestop_flight,
    "send_certificate": send_certificate,
    "think": think,
    "transfer_to_human_agents": transfer_to_human_agents,
    "update_reservation_baggages": update_reservation_baggages,
    "update_reservation_flights": update_reservation_flights,
    "update_reservation_passengers": update_reservation_passengers,
}


def validate_environment_variables() -> None:
    """
    Validate required environment variables are present and properly formatted.

    This function checks for all required environment variables and validates their
    format to prevent configuration errors and potential security issues.

    Raises:
        ValueError: If any required environment variable is missing or invalid
    """
    print("[VALIDATION] Validating environment variables")
    
    # Check for STACK_NAME
    stack_name = os.environ.get("STACK_NAME")
    if not stack_name:
        error_msg = "STACK_NAME environment variable is required"
        print(f"[VALIDATION ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    # Validate STACK_NAME format (alphanumeric, hyphens, underscores only)
    # This prevents injection attacks through SSM parameter paths
    if not stack_name.replace("-", "").replace("_", "").isalnum():
        error_msg = f"Invalid STACK_NAME format: '{stack_name}'. Must contain only alphanumeric characters, hyphens, and underscores"
        print(f"[VALIDATION ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    print(f"[VALIDATION] STACK_NAME validated: {stack_name}")
    
    # Check for MEMORY_ID
    memory_id = os.environ.get("MEMORY_ID")
    if not memory_id:
        error_msg = "MEMORY_ID environment variable is required"
        print(f"[VALIDATION ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    print(f"[VALIDATION] MEMORY_ID validated: {memory_id}")
    
    # Check for AWS region (either AWS_REGION or AWS_DEFAULT_REGION)
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
    if not region:
        error_msg = "AWS_REGION or AWS_DEFAULT_REGION environment variable is required"
        print(f"[VALIDATION ERROR] {error_msg}")
        raise ValueError(error_msg)
    
    print(f"[VALIDATION] AWS region validated: {region}")
    print("[VALIDATION] All required environment variables validated successfully")


def get_ssm_parameter(parameter_name: str) -> str:
    """
    Fetch parameter from SSM Parameter Store.

    SSM Parameter Store is AWS's service for storing configuration values securely.
    This function retrieves values like Gateway URLs that are set during deployment.

    Args:
        parameter_name: The name of the SSM parameter to retrieve

    Returns:
        The parameter value as a string

    Raises:
        ValueError: If the parameter is not found or cannot be accessed
    """
    region = os.environ.get(
        "AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    )
    ssm = boto3.client("ssm", region_name=region)
    try:
        response = ssm.get_parameter(Name=parameter_name, WithDecryption=True)
        return response["Parameter"]["Value"]
    except ssm.exceptions.ParameterNotFound:
        raise ValueError(f"SSM parameter not found: {parameter_name}")
    except Exception as e:
        raise ValueError(f"Failed to retrieve SSM parameter {parameter_name}: {e}")


def create_supervisor_agent(
    user_id: str,
    session_id: str,
    session_manager: AgentCoreMemorySessionManager,
) -> Agent:
    """
    Create Supervisor agent for orchestration and delegation.

    The Supervisor agent is responsible for analyzing user requests, decomposing
    complex tasks, delegating to specialized agents, and synthesizing responses.

    Args:
        user_id: User identifier for trace attributes
        session_id: Session identifier for trace attributes
        session_manager: AgentCore Memory session manager for conversation history

    Returns:
        Configured Supervisor Agent instance

    Raises:
        ValueError: If configuration is invalid
        Exception: If agent creation fails
    """
    print(f"[AGENT] Creating Supervisor agent for user: {user_id}, session: {session_id}")

    # Domain policy for travel website
    domain_policy = """
    - Always prioritize customer satisfaction and safety
    - Provide accurate and up-to-date information
    - Handle sensitive customer data with care
    - Follow airline and travel industry regulations
    - Escalate complex issues to human agents when necessary
    """

    system_prompt = f"""
You are a helpful assistant for a travel website. Help the user answer any questions.

<policy>
{domain_policy}
</policy>

<capabilities>
- You can perform calculations using the calculate tool
- You can use the think tool for complex reasoning and task breakdown
- You can escalate to human agents when necessary using transfer_to_human_agents
- Ensure the handoff from agents happens to complete the task
- You can ask for the user_id from the user or extract it from the query
- The reservation details can be found by getting user details first
</capabilities>

<workflow_guidelines>
1. ANALYZE user requests to determine which specialized agent(s) should handle different aspects
2. DECOMPOSE complex multi-part requests into discrete subtasks
3. DELEGATE each subtask to the appropriate specialized agent
4. SYNTHESIZE information from multiple agents into coherent responses
5. ESCALATE to human agents when requests exceed automated capabilities
</workflow_guidelines>

<delegation_rules>
- For user profile or certificate operations → User Agent
- For flight searches or airport information → Flight Agent
- For booking, modifications, or cancellations → Reservation Agent
- For mathematical operations or price comparisons → calculate tool
- For complex reasoning or planning → think tool
- For issues requiring human judgment → transfer_to_human_agents
</delegation_rules>

<instructions>
- DO NOT ASK USER TO CONFIRM WITH MODIFICATION. ASSUME IT IS YES.
- Make sure you handoff to the proper agents
- Remember to check if the airport city is in the state mentioned by the user
- Infer about the U.S. state in which the airport city resides
- You should not use made-up or placeholder arguments
- Do not ask for any confirmation from the user. Just go ahead and execute your actions
- Do not ask the user if they want you to proceed or not
</instructions>
"""

    # Configure BedrockModel
    region = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
    model = BedrockModel(
        model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
        temperature=0.0,
        top_p=1,
        max_tokens=1024,
        region_name=region,
    )

    # Configure trace attributes
    trace_attributes = {
        "user.id": user_id,
        "session.id": session_id,
        "langfuse.tags": [
            user_id,
            session_id,
            "strands-swarm-supervisor"
        ]
    }

    # Get supervisor tools directly from AIRLINE_TOOLS
    supervisor_tool_names = ["calculate", "think", "transfer_to_human_agents"]
    supervisor_tools = [AIRLINE_TOOLS[name] for name in supervisor_tool_names]

    # Create Supervisor agent
    agent = Agent(
        agent_id="supervisor",
        name="Supervisor",
        model=model,
        tools=supervisor_tools,
        system_prompt=system_prompt,
        trace_attributes=trace_attributes,
    )

    print("[AGENT] Supervisor agent created successfully")
    print(f"[AGENT] Supervisor tools configured: {supervisor_tool_names}")
    print(f"[AGENT] Supervisor trace attributes: user.id={user_id}, session.id={session_id}")
    return agent


def create_user_agent(
    user_id: str,
    session_id: str,
    session_manager: AgentCoreMemorySessionManager,
) -> Agent:
    """
    Create User agent for profile management and certificate operations.

    The User agent specializes in customer data management, retrieving user information,
    and issuing certificates and benefits.

    Args:
        user_id: User identifier for trace attributes
        session_id: Session identifier for trace attributes
        session_manager: AgentCore Memory session manager for conversation history

    Returns:
        Configured User Agent instance

    Raises:
        ValueError: If configuration is invalid
        Exception: If agent creation fails
    """
    print(f"[AGENT] Creating User agent for user: {user_id}, session: {session_id}")

    # Domain policy for travel website
    domain_policy = """
    - Always prioritize customer satisfaction and safety
    - Provide accurate and up-to-date information
    - Handle sensitive customer data with care
    - Follow airline and travel industry regulations
    - Escalate complex issues to human agents when necessary
    """

    system_prompt = f"""
You are the User Agent for a travel website, specializing in customer data management and user profile operations.
Your primary responsibilities include retrieving user information and managing customer benefits.
Use the provided tools to assist queries for user information.

<policy>
{domain_policy}
</policy>

<capabilities>
- You can access user profiles and retrieve customer details using the get_user_details tool
- You can issue certificates and benefits to users through the send_certificate tool
- You can use the think tool for internal reasoning
</capabilities>

<instructions>
- You should not use made-up or placeholder arguments
- Do not ask for any confirmation. Just go ahead and execute your actions
- Once the user details are found, you can get the reservation and flights information
- You can hand off to the relevant agent to use that for modifying or updating the flights
- If reservation ID is needed, it can be obtained from user details
- Do not ask if they want you to proceed or not
</instructions>
"""

    # Configure BedrockModel
    region = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
    model = BedrockModel(
        model_id="anthropic.claude-3-sonnet-20240229-v1:0",
        temperature=0.0,
        top_p=1,
        max_tokens=1024,
        region_name=region,
    )

    # Configure trace attributes
    trace_attributes = {
        "user.id": user_id,
        "session.id": session_id,
        "langfuse.tags": [
            user_id,
            session_id,
            "strands-swarm-user"
        ]
    }

    # Get user tools directly from AIRLINE_TOOLS
    user_tool_names = ["get_user_details", "send_certificate", "think"]
    user_tools = [AIRLINE_TOOLS[name] for name in user_tool_names]

    # Create User agent
    agent = Agent(
        agent_id="user",
        name="User",
        model=model,
        tools=user_tools,
        system_prompt=system_prompt,
        trace_attributes=trace_attributes,
    )

    print("[AGENT] User agent created successfully")
    print(f"[AGENT] User tools configured: {user_tool_names}")
    print(f"[AGENT] User trace attributes: user.id={user_id}, session.id={session_id}")
    return agent


def create_flight_agent(
    user_id: str,
    session_id: str,
    session_manager: AgentCoreMemorySessionManager,
) -> Agent:
    """
    Create Flight agent for flight search and airport information.

    The Flight agent specializes in finding flight routes, searching for direct and
    connecting flights, and providing airport information.

    Args:
        user_id: User identifier for trace attributes
        session_id: Session identifier for trace attributes
        session_manager: AgentCore Memory session manager for conversation history

    Returns:
        Configured Flight Agent instance

    Raises:
        ValueError: If configuration is invalid
        Exception: If agent creation fails
    """
    print(f"[AGENT] Creating Flight agent for user: {user_id}, session: {session_id}")

    # Domain policy for travel website
    domain_policy = """
    - Always prioritize customer satisfaction and safety
    - Provide accurate and up-to-date information
    - Handle sensitive customer data with care
    - Follow airline and travel industry regulations
    - Escalate complex issues to human agents when necessary
    """

    system_prompt = f"""
You are the Flight Agent for a travel website, specializing in flight search operations and airport information management.
Your expertise lies in finding flight routes and providing accurate airport data to support the reservation process.
Use the provided tools to search for flights.

<policy>
{domain_policy}
</policy>

<capabilities>
- You can search for direct flights between airports using the search_direct_flight tool
- You can find connecting flights with one stop using the search_onestop_flight tool
- You can provide comprehensive airport information via the list_all_airports tool
- You can use the think tool for reasoning
</capabilities>

<instructions>
- You should not use made-up or placeholder arguments
- Do not ask for any confirmation. Just go ahead and execute your actions
- Do not ask if they want you to proceed or not
- Once the flight details are found you can hand off to the relevant agent to use that for modifying or updating the flights
- If the flights need to be modified or updated hand off to reservation agent with the required details
</instructions>
"""

    # Configure BedrockModel
    region = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
    model = BedrockModel(
        model_id="anthropic.claude-3-sonnet-20240229-v1:0",
        temperature=0.0,
        top_p=1,
        max_tokens=1024,
        region_name=region,
    )

    # Configure trace attributes
    trace_attributes = {
        "user.id": user_id,
        "session.id": session_id,
        "langfuse.tags": [
            user_id,
            session_id,
            "strands-swarm-flight"
        ]
    }

    # Get flight tools directly from AIRLINE_TOOLS
    flight_tool_names = ["search_direct_flight", "search_onestop_flight", "list_all_airports", "think"]
    flight_tools = [AIRLINE_TOOLS[name] for name in flight_tool_names]

    # Create Flight agent
    agent = Agent(
        agent_id="flight",
        name="Flight",
        model=model,
        tools=flight_tools,
        system_prompt=system_prompt,
        trace_attributes=trace_attributes,
    )

    print("[AGENT] Flight agent created successfully")
    print(f"[AGENT] Flight tools configured: {flight_tool_names}")
    print(f"[AGENT] Flight trace attributes: user.id={user_id}, session.id={session_id}")
    return agent


def create_reservation_agent(
    user_id: str,
    session_id: str,
    session_manager: AgentCoreMemorySessionManager,
) -> Agent:
    """
    Create Reservation agent for booking lifecycle management.

    The Reservation agent specializes in managing the complete lifecycle of travel bookings
    from creation through modification to cancellation.

    Args:
        user_id: User identifier for trace attributes
        session_id: Session identifier for trace attributes
        session_manager: AgentCore Memory session manager for conversation history

    Returns:
        Configured Reservation Agent instance

    Raises:
        ValueError: If configuration is invalid
        Exception: If agent creation fails
    """
    print(f"[AGENT] Creating Reservation agent for user: {user_id}, session: {session_id}")

    # Domain policy for travel website
    domain_policy = """
    - Always prioritize customer satisfaction and safety
    - Provide accurate and up-to-date information
    - Handle sensitive customer data with care
    - Follow airline and travel industry regulations
    - Escalate complex issues to human agents when necessary
    """

    system_prompt = f"""
You are the Reservation Agent for a travel website, specializing in managing the complete lifecycle of travel bookings from creation through modification to cancellation.
Your expertise ensures seamless reservation management and transaction integrity throughout the booking process.
Use the provided tools to update, cancel, book, and get reservation details.

<policy>
{domain_policy}
</policy>

<capabilities>
- You can create new reservations through the book_reservation tool
- You can cancel existing reservations using the cancel_reservation tool
- You can retrieve comprehensive booking information via the get_reservation_details tool
- You can modify baggage allocations with the update_reservation_baggages tool
- You can change flight selections using the update_reservation_flights tool
- You can update passenger information through the update_reservation_passengers tool
- You can use the think tool for reasoning
</capabilities>

<instructions>
- You should not use made-up or placeholder arguments
- Do not ask for any confirmation. Just go ahead and execute your actions
- If you need more information you can use the user_agent or flights_agent to get the additional details
- Once the reservation details are found, match the flights asked in the query if given and use that to perform any updates
- Do not ask if they want you to proceed or not
</instructions>
"""

    # Configure BedrockModel
    region = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
    model = BedrockModel(
        model_id="anthropic.claude-3-sonnet-20240229-v1:0",
        temperature=0.0,
        top_p=1,
        max_tokens=1024,
        region_name=region,
    )

    # Configure trace attributes
    trace_attributes = {
        "user.id": user_id,
        "session.id": session_id,
        "langfuse.tags": [
            user_id,
            session_id,
            "strands-swarm-reservation"
        ]
    }

    # Get reservation tools directly from AIRLINE_TOOLS
    reservation_tool_names = [
        "book_reservation",
        "cancel_reservation",
        "get_reservation_details",
        "update_reservation_baggages",
        "update_reservation_flights",
        "update_reservation_passengers",
        "think"
    ]
    reservation_tools = [AIRLINE_TOOLS[name] for name in reservation_tool_names]

    # Create Reservation agent
    agent = Agent(
        agent_id="reservation",
        name="Reservation",
        model=model,
        tools=reservation_tools,
        system_prompt=system_prompt,
        trace_attributes=trace_attributes,
    )

    print("[AGENT] Reservation agent created successfully")
    print(f"[AGENT] Reservation tools configured: {reservation_tool_names}")
    print(f"[AGENT] Reservation trace attributes: user.id={user_id}, session.id={session_id}")
    return agent


def create_session_manager(
    memory_id: str, session_id: str, actor_id: str
) -> AgentCoreMemorySessionManager:
    """
    Create AgentCore Memory session manager for conversation history persistence.

    AgentCore Memory provides conversation history and session state management across
    multiple turns. This function creates a session manager that all agents in the swarm
    will share to maintain consistent context.

    Args:
        memory_id: Memory identifier from environment variables (MEMORY_ID)
        session_id: Session identifier from request payload (runtimeSessionId)
        actor_id: User identifier from request payload (userId)

    Returns:
        Configured AgentCoreMemorySessionManager instance

    Raises:
        ValueError: If memory_id is missing or empty
        Exception: If session manager creation fails
    """
    if not memory_id:
        raise ValueError("MEMORY_ID environment variable is required")

    region = os.environ.get(
        "AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    )

    print(f"[MEMORY] Creating session manager for memory: {memory_id}")
    print(f"[MEMORY] Session ID: {session_id}")
    print(f"[MEMORY] Actor ID: {actor_id}")
    print(f"[MEMORY] Region: {region}")

    try:
        # Create AgentCore Memory configuration
        memory_config = AgentCoreMemoryConfig(
            memory_id=memory_id,
            session_id=session_id,
            actor_id=actor_id,
        )

        # Create session manager with configuration
        session_manager = AgentCoreMemorySessionManager(
            agentcore_memory_config=memory_config,
            region_name=region,
        )

        print("[MEMORY] Session manager created successfully")
        return session_manager

    except Exception as e:
        print(f"[MEMORY ERROR] Failed to create session manager: {e}")
        print(f"[MEMORY ERROR] Exception type: {type(e).__name__}")
        traceback.print_exc()
        raise


def create_swarm(
    supervisor: Agent,
    user: Agent,
    flight: Agent,
    reservation: Agent,
) -> Swarm:
    """
    Create Strands Swarm for multi-agent coordination.

    The Swarm orchestrates collaboration between specialized agents through handoffs.
    Each agent can delegate tasks to other agents when their specialized capabilities
    are needed. The Swarm manages the coordination, tracks handoff history, and
    enforces limits to prevent infinite loops.

    Args:
        supervisor: Supervisor agent for orchestration and delegation
        user: User agent for profile management and certificate operations
        flight: Flight agent for flight search and airport information
        reservation: Reservation agent for booking lifecycle management

    Returns:
        Configured Swarm instance ready for execution

    Raises:
        ValueError: If any agent is None or invalid
        Exception: If swarm creation fails
    """
    print("[SWARM] Creating swarm with four specialized agents")
    print(f"[SWARM] Agents: {supervisor.name}, {user.name}, {flight.name}, {reservation.name}")
    print(f"[SWARM] Starting agent: {supervisor.name}")

    try:
        # Validate agents
        if not all([supervisor, user, flight, reservation]):
            raise ValueError("All four agents (supervisor, user, flight, reservation) are required")

        print("[SWARM] All agents validated successfully")

        # Create Swarm with all four agents
        # The first agent in the list is the starting agent (supervisor)
        swarm = Swarm(
            [supervisor, user, flight, reservation],
            max_handoffs=15,  # Limit coordination cycles to prevent excessive handoffs
            max_iterations=10,  # Prevent infinite loops within a single agent
            execution_timeout=300.0,  # Total execution timeout in seconds (5 minutes)
            node_timeout=300.0,  # Per-agent timeout in seconds (5 minutes)
        )

        print("[SWARM] Swarm created successfully")
        print("[SWARM] Configuration:")
        print(f"[SWARM]   - max_handoffs: 15")
        print(f"[SWARM]   - max_iterations: 10")
        print(f"[SWARM]   - execution_timeout: 300.0s")
        print(f"[SWARM]   - node_timeout: 300.0s")
        print("[SWARM] Handoff capabilities enabled between all agents")

        return swarm

    except ValueError as e:
        # Re-raise validation errors
        print(f"[SWARM ERROR] Validation error: {e}")
        raise
    except Exception as e:
        # Log and raise swarm creation errors
        print(f"[SWARM ERROR] Failed to create swarm: {e}")
        print(f"[SWARM ERROR] Exception type: {type(e).__name__}")
        traceback.print_exc()
        raise


@app.entrypoint
async def agent_stream(payload: dict):
    """
    Main streaming entrypoint for the Strands Swarm agent.

    This async function handles incoming requests, creates the swarm with all four
    specialized agents, and streams responses back to the user in real-time.

    The function:
    1. Validates required payload fields (prompt, userId, runtimeSessionId)
    2. Creates session manager for conversation history
    3. Retrieves OAuth2 token for Gateway authentication
    4. Creates all four specialized agents with shared session manager
    5. Creates swarm for multi-agent coordination
    6. Invokes swarm with user query
    7. Streams responses using agent.stream_async()
    8. Handles exceptions and yields error status

    Args:
        payload: Request payload containing:
            - prompt: User query string
            - userId: User identifier for tracing and memory
            - runtimeSessionId: Session identifier for conversation history

    Yields:
        Response events in streaming format:
        - Success events with status="streaming" and content
        - Error events with status="error" and error message
        - Completion events with status="completed" and result

    Raises:
        Does not raise exceptions - all errors are yielded as error status events
    """
    print("[ENTRYPOINT] Starting agent_stream")
    print(f"[ENTRYPOINT] Payload keys: {list(payload.keys())}")

    try:
        # Validate environment variables first
        validate_environment_variables()
        
        # Extract required fields from payload
        prompt = payload.get("prompt")
        user_id = payload.get("userId")
        session_id = payload.get("runtimeSessionId")

        print(f"[ENTRYPOINT] Extracted fields:")
        print(f"[ENTRYPOINT]   - prompt: {prompt[:50] if prompt else None}...")
        print(f"[ENTRYPOINT]   - userId: {user_id}")
        print(f"[ENTRYPOINT]   - runtimeSessionId: {session_id}")

        # Validate required fields
        missing_fields = []
        if not prompt:
            missing_fields.append("prompt")
        if not user_id:
            missing_fields.append("userId")
        if not session_id:
            missing_fields.append("runtimeSessionId")

        if missing_fields:
            error_msg = f"Missing required fields: {', '.join(missing_fields)}"
            print(f"[ENTRYPOINT ERROR] {error_msg}")
            yield {
                "status": "error",
                "error": error_msg,
                "error_type": "payload_validation",
            }
            return

        # Get MEMORY_ID from environment
        memory_id = os.environ.get("MEMORY_ID")
        if not memory_id:
            error_msg = "MEMORY_ID environment variable is required"
            print(f"[ENTRYPOINT ERROR] {error_msg}")
            yield {
                "status": "error",
                "error": error_msg,
                "error_type": "configuration",
            }
            return

        print("[ENTRYPOINT] Creating session manager")
        # Create session manager for conversation history
        session_manager = create_session_manager(
            memory_id=memory_id,
            session_id=session_id,
            actor_id=user_id,
        )

        print("[ENTRYPOINT] Creating all four agents")
        # Create all four specialized agents with shared session manager
        supervisor = create_supervisor_agent(
            user_id=user_id,
            session_id=session_id,
            session_manager=session_manager,
        )

        user_agent = create_user_agent(
            user_id=user_id,
            session_id=session_id,
            session_manager=session_manager,
        )

        flight_agent = create_flight_agent(
            user_id=user_id,
            session_id=session_id,
            session_manager=session_manager,
        )

        reservation_agent = create_reservation_agent(
            user_id=user_id,
            session_id=session_id,
            session_manager=session_manager,
        )

        print("[ENTRYPOINT] Creating swarm")
        # Create swarm with all four agents
        swarm = create_swarm(
            supervisor=supervisor,
            user=user_agent,
            flight=flight_agent,
            reservation=reservation_agent,
        )

        print(f"[ENTRYPOINT] Invoking swarm with query: {prompt[:100]}...")
        
        # Use stream_async for true token-by-token streaming
        print("[ENTRYPOINT] Starting streaming execution")
        
        async for event in swarm.stream_async(prompt):
            event_type = event.get("type")
            print(f"[ENTRYPOINT] Received event type: {event_type}")
            
            # Handle different swarm event types
            if event_type == "multiagent_node_start":
                # Agent is taking control
                node_id = event.get("node_id")
                print(f"[ENTRYPOINT] Agent {node_id} taking control")
                # Don't yield this to UI, just log it
                
            elif event_type == "multiagent_node_stream":
                # This contains the actual streaming content from the agent
                inner_event = event.get("event", {})
                
                # Check if this is a content block delta event
                if "data" in inner_event:
                    # Yield the data directly
                    yield inner_event
                else:
                    # Yield the entire inner event
                    yield inner_event
                    
            elif event_type == "multiagent_handoff":
                # Agent is handing off to another agent
                from_nodes = ", ".join(event.get('from_node_ids', []))
                to_nodes = ", ".join(event.get('to_node_ids', []))
                print(f"[ENTRYPOINT] Handoff: {from_nodes} → {to_nodes}")
                # Don't yield this to UI, just log it
                
            elif event_type == "multiagent_result":
                # Final result from the swarm
                result = event.get("result")
                print(f"[ENTRYPOINT] Swarm completed with status: {result.status if result else 'unknown'}")
                # Don't yield this to UI, just log it
                
            else:
                # Unknown event type, log and yield it
                print(f"[ENTRYPOINT] Unknown event type: {event_type}, yielding as-is")
                yield event

        print("[ENTRYPOINT] Swarm streaming completed successfully")

    except ValueError as e:
        # Configuration or validation errors
        error_msg = str(e)
        print(f"[ENTRYPOINT ERROR] Validation error: {error_msg}")
        print(f"[ENTRYPOINT ERROR] Stack trace:")
        traceback.print_exc()
        yield {
            "status": "error",
            "error": error_msg,
            "error_type": "validation",
        }

    except Exception as e:
        # Unexpected errors during execution
        error_msg = f"Agent execution failed: {str(e)}"
        print(f"[ENTRYPOINT ERROR] Execution error: {error_msg}")
        print(f"[ENTRYPOINT ERROR] Exception type: {type(e).__name__}")
        print(f"[ENTRYPOINT ERROR] Stack trace:")
        traceback.print_exc()
        yield {
            "status": "error",
            "error": error_msg,
            "error_type": "execution",
            "details": {
                "exception_type": type(e).__name__,
                "exception_message": str(e),
            }
        }


if __name__ == "__main__":
    app.run()
