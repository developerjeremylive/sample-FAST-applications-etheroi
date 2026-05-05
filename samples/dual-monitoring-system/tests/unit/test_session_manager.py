# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Unit tests for session manager creation in Strands Swarm Agent.
"""

import os
import sys
from unittest.mock import MagicMock, Mock, patch

import pytest

# Mock the bedrock_agentcore and strands modules before importing swarm_agent
sys.modules["bedrock_agentcore"] = Mock()
sys.modules["bedrock_agentcore.memory"] = Mock()
sys.modules["bedrock_agentcore.memory.integrations"] = Mock()
sys.modules["bedrock_agentcore.memory.integrations.strands"] = Mock()

# Create mock classes
mock_config_class = MagicMock()
mock_session_manager_class = MagicMock()

sys.modules["bedrock_agentcore.memory.integrations.strands.config"] = Mock()
sys.modules[
    "bedrock_agentcore.memory.integrations.strands.config"
].AgentCoreMemoryConfig = mock_config_class
sys.modules["bedrock_agentcore.memory.integrations.strands.session_manager"] = Mock()
sys.modules[
    "bedrock_agentcore.memory.integrations.strands.session_manager"
].AgentCoreMemorySessionManager = mock_session_manager_class

sys.modules["bedrock_agentcore.runtime"] = Mock()
sys.modules["strands"] = Mock()
sys.modules["strands.models"] = Mock()
sys.modules["strands.multiagent"] = Mock()
sys.modules["strands.tools"] = Mock()
sys.modules["strands.tools.mcp"] = Mock()
sys.modules["mcp"] = Mock()
sys.modules["mcp.client"] = Mock()
sys.modules["mcp.client.streamable_http"] = Mock()

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "../../patterns/strands-swarm-agent")
)

from swarm_agent import create_session_manager  # noqa: E402


def test_create_session_manager_success():
    """Test successful session manager creation with valid inputs."""
    memory_id = "test-memory-123"
    session_id = "session-456"
    actor_id = "user-789"

    # Create mock instances
    mock_config_instance = MagicMock()
    mock_session_manager_instance = MagicMock()

    # Patch the classes in the swarm_agent module
    with (
        patch("swarm_agent.AgentCoreMemoryConfig") as mock_config,
        patch("swarm_agent.AgentCoreMemorySessionManager") as mock_session_mgr,
        patch.dict(os.environ, {"AWS_REGION": "us-west-2"}),
    ):
        mock_config.return_value = mock_config_instance
        mock_session_mgr.return_value = mock_session_manager_instance

        # Call function
        result = create_session_manager(memory_id, session_id, actor_id)

        # Verify AgentCoreMemoryConfig was created with correct parameters
        mock_config.assert_called_once_with(
            memory_id=memory_id,
            session_id=session_id,
            actor_id=actor_id,
        )

        # Verify AgentCoreMemorySessionManager was created with config
        mock_session_mgr.assert_called_once_with(
            agentcore_memory_config=mock_config_instance,
            region_name="us-west-2",
        )

        # Verify result is the session manager instance
        assert result == mock_session_manager_instance


def test_create_session_manager_missing_memory_id():
    """Test that ValueError is raised when memory_id is missing."""
    session_id = "session-456"
    actor_id = "user-789"

    # Test with None
    with pytest.raises(ValueError) as exc_info:
        create_session_manager(None, session_id, actor_id)

    assert "MEMORY_ID" in str(exc_info.value)
    assert "required" in str(exc_info.value)

    # Test with empty string
    with pytest.raises(ValueError) as exc_info:
        create_session_manager("", session_id, actor_id)

    assert "MEMORY_ID" in str(exc_info.value)
    assert "required" in str(exc_info.value)


def test_create_session_manager_default_region():
    """Test that default region is used when AWS_REGION is not set."""
    memory_id = "test-memory-123"
    session_id = "session-456"
    actor_id = "user-789"

    # Create mock instances
    mock_config_instance = MagicMock()
    mock_session_manager_instance = MagicMock()

    # Patch the classes in the swarm_agent module
    with (
        patch("swarm_agent.AgentCoreMemoryConfig") as mock_config,
        patch("swarm_agent.AgentCoreMemorySessionManager") as mock_session_mgr,
        patch.dict(os.environ, {}, clear=True),
    ):
        mock_config.return_value = mock_config_instance
        mock_session_mgr.return_value = mock_session_manager_instance

        # Call function without AWS_REGION set
        create_session_manager(memory_id, session_id, actor_id)

        # Verify default region was used
        mock_session_mgr.assert_called_once()
        call_kwargs = mock_session_mgr.call_args[1]
        assert call_kwargs["region_name"] == "us-east-1"


def test_create_session_manager_uses_aws_default_region():
    """Test that AWS_DEFAULT_REGION is used when AWS_REGION is not set."""
    memory_id = "test-memory-123"
    session_id = "session-456"
    actor_id = "user-789"

    # Create mock instances
    mock_config_instance = MagicMock()
    mock_session_manager_instance = MagicMock()

    # Patch the classes in the swarm_agent module
    with (
        patch("swarm_agent.AgentCoreMemoryConfig") as mock_config,
        patch("swarm_agent.AgentCoreMemorySessionManager") as mock_session_mgr,
        patch.dict(os.environ, {"AWS_DEFAULT_REGION": "eu-west-1"}, clear=True),
    ):
        mock_config.return_value = mock_config_instance
        mock_session_mgr.return_value = mock_session_manager_instance

        # Call function with AWS_DEFAULT_REGION set
        create_session_manager(memory_id, session_id, actor_id)

        # Verify AWS_DEFAULT_REGION was used
        mock_session_mgr.assert_called_once()
        call_kwargs = mock_session_mgr.call_args[1]
        assert call_kwargs["region_name"] == "eu-west-1"
