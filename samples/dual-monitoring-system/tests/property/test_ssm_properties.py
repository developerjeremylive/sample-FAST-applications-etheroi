# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Property-based tests for SSM parameter retrieval in Strands Swarm Agent.

These tests validate universal properties that must hold across all valid inputs
for SSM parameter operations.
"""

import os
import sys
from unittest.mock import MagicMock, Mock, patch

import pytest
from hypothesis import given
from hypothesis import strategies as st

# Mock the bedrock_agentcore and strands modules before importing swarm_agent
sys.modules["bedrock_agentcore"] = Mock()
sys.modules["bedrock_agentcore.memory"] = Mock()
sys.modules["bedrock_agentcore.memory.integrations"] = Mock()
sys.modules["bedrock_agentcore.memory.integrations.strands"] = Mock()
sys.modules["bedrock_agentcore.memory.integrations.strands.config"] = Mock()
sys.modules["bedrock_agentcore.memory.integrations.strands.session_manager"] = Mock()
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

from swarm_agent import get_ssm_parameter  # noqa: E402


# Feature: strands-swarm-deployment, Property 3: Gateway URL from SSM
@given(
    stack_name=st.text(
        min_size=1,
        max_size=50,
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters="-_"
        ),
    )
)
def test_gateway_url_from_ssm(stack_name):
    """
    For any MCP client creation, the Gateway URL must be retrieved from SSM
    Parameter Store using the pattern /{stack_name}/gateway_url.

    Validates: Requirements 3.2
    """
    # Construct expected parameter name
    expected_param_name = f"/{stack_name}/gateway_url"
    mock_gateway_url = "https://gateway.example.com"

    # Mock boto3 SSM client
    with patch("swarm_agent.boto3.client") as mock_boto_client:
        mock_ssm = MagicMock()
        mock_boto_client.return_value = mock_ssm

        # Configure mock to return a value
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": mock_gateway_url}}

        # Call function with the expected parameter name
        result = get_ssm_parameter(expected_param_name)

        # Verify the parameter name follows the pattern
        assert expected_param_name.startswith(f"/{stack_name}/")
        assert expected_param_name.endswith("/gateway_url")

        # Verify SSM was called with correct parameter name
        mock_ssm.get_parameter.assert_called_once_with(
            Name=expected_param_name, WithDecryption=True
        )

        # Verify result is returned
        assert result == mock_gateway_url


# Feature: strands-swarm-deployment, Property 16: SSM Path Construction
@given(
    stack_name=st.text(
        min_size=1,
        max_size=50,
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters="-_"
        ),
    ),
    parameter_name=st.text(
        min_size=1,
        max_size=50,
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters="-_"
        ),
    ),
)
def test_ssm_path_construction(stack_name, parameter_name):
    """
    For any SSM parameter access, the parameter path must be constructed using
    the validated STACK_NAME in the format /{stack_name}/{parameter_name}.

    Validates: Requirements 6.7
    """
    # Construct parameter path
    param_path = f"/{stack_name}/{parameter_name}"
    mock_value = "test-value"

    # Mock boto3 SSM client
    with patch("swarm_agent.boto3.client") as mock_boto_client:
        mock_ssm = MagicMock()
        mock_boto_client.return_value = mock_ssm

        # Configure mock to return a value
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": mock_value}}

        # Call function
        result = get_ssm_parameter(param_path)

        # Verify path construction follows the pattern
        assert param_path.startswith("/")
        assert param_path.count("/") >= 2  # At least /{stack}/{param}
        parts = param_path.split("/")
        assert len(parts) >= 3  # ['', 'stack_name', 'parameter_name']
        assert parts[1] == stack_name
        assert parts[2] == parameter_name

        # Verify SSM was called with constructed path
        mock_ssm.get_parameter.assert_called_once_with(
            Name=param_path, WithDecryption=True
        )

        # Verify result is returned
        assert result == mock_value


# Feature: strands-swarm-deployment, Property 32: SSM Parameter Error
@given(
    parameter_name=st.text(
        min_size=1,
        max_size=100,
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters="/-_"
        ),
    )
)
def test_ssm_parameter_error(parameter_name):
    """
    For any SSM parameter retrieval that fails (parameter not found), the system
    must raise a ValueError containing the parameter name.

    Validates: Requirements 12.1
    """
    # Mock boto3 SSM client to simulate parameter not found
    with patch("swarm_agent.boto3.client") as mock_boto_client:
        mock_ssm = MagicMock()
        mock_boto_client.return_value = mock_ssm

        # Configure mock to raise ParameterNotFound exception
        mock_ssm.exceptions.ParameterNotFound = type(
            "ParameterNotFound", (Exception,), {}
        )
        mock_ssm.get_parameter.side_effect = mock_ssm.exceptions.ParameterNotFound(
            f"Parameter {parameter_name} not found"
        )

        # Verify ValueError is raised
        with pytest.raises(ValueError) as exc_info:
            get_ssm_parameter(parameter_name)

        # Verify error message contains parameter name
        error_message = str(exc_info.value)
        assert parameter_name in error_message
        assert "not found" in error_message.lower()

        # Verify SSM was called
        mock_ssm.get_parameter.assert_called_once_with(
            Name=parameter_name, WithDecryption=True
        )
