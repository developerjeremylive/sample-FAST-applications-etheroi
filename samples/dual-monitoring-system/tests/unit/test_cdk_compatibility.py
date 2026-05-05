"""
Unit tests for CDK compatibility validation.

These tests verify that the strands-swarm-agent pattern follows the expected
directory structure and conventions required by the FAST CDK infrastructure.
"""

from pathlib import Path

import pytest


class TestDirectoryStructure:
    """Test suite for validating pattern directory structure."""

    @pytest.fixture
    def pattern_dir(self):
        """Get the path to the strands-swarm-agent pattern directory."""
        repo_root = Path(__file__).parent.parent.parent
        return repo_root / "patterns" / "strands-swarm-agent"

    def test_pattern_directory_exists(self, pattern_dir):
        """Verify patterns/strands-swarm-agent/ directory exists."""
        assert pattern_dir.exists(), f"Pattern directory not found: {pattern_dir}"
        assert pattern_dir.is_dir(), f"Pattern path is not a directory: {pattern_dir}"

    def test_required_files_present(self, pattern_dir):
        """Verify all required files are present in the pattern directory."""
        required_files = [
            "__init__.py",
            "swarm_agent.py",
            "Dockerfile",
            "requirements.txt",
        ]

        for filename in required_files:
            file_path = pattern_dir / filename
            assert file_path.exists(), f"Required file missing: {filename}"
            assert file_path.is_file(), f"Required path is not a file: {filename}"

    def test_main_agent_file_naming(self, pattern_dir):
        """Verify the main agent file follows naming conventions."""
        # The main agent file should be swarm_agent.py (snake_case)
        main_file = pattern_dir / "swarm_agent.py"
        assert main_file.exists(), "Main agent file swarm_agent.py not found"

        # Verify it's not using incorrect naming patterns
        incorrect_names = ["swarmAgent.py", "SwarmAgent.py", "swarm-agent.py"]
        for incorrect_name in incorrect_names:
            incorrect_path = pattern_dir / incorrect_name
            assert not incorrect_path.exists(), (
                f"Found incorrectly named file: {incorrect_name}"
            )

    def test_dockerfile_naming(self, pattern_dir):
        """Verify Dockerfile follows naming conventions."""
        dockerfile = pattern_dir / "Dockerfile"
        assert dockerfile.exists(), "Dockerfile not found"

        # Verify the exact filename matches (case-sensitive check)
        actual_files = [f.name for f in pattern_dir.iterdir() if f.is_file()]
        assert "Dockerfile" in actual_files, (
            "Dockerfile with correct capitalization not found"
        )

        # Verify no .txt extension
        assert not (pattern_dir / "Dockerfile.txt").exists() or (
            pattern_dir / "Dockerfile.txt"
        ).samefile(dockerfile), "Found Dockerfile.txt instead of Dockerfile"

    def test_requirements_file_naming(self, pattern_dir):
        """Verify requirements.txt follows naming conventions."""
        requirements = pattern_dir / "requirements.txt"
        assert requirements.exists(), "requirements.txt not found"

        # Verify the exact filename matches (case-sensitive check)
        actual_files = [f.name for f in pattern_dir.iterdir() if f.is_file()]
        assert "requirements.txt" in actual_files, (
            "requirements.txt with correct capitalization not found"
        )

        # Verify no incorrect extensions
        assert not (pattern_dir / "requirements.pip").exists(), (
            "Found requirements.pip instead of requirements.txt"
        )
        assert (
            not (pattern_dir / "requirements").exists()
            or (pattern_dir / "requirements").is_dir()
        ), "Found 'requirements' file without .txt extension"

    def test_python_package_structure(self, pattern_dir):
        """Verify the pattern follows Python package structure."""
        init_file = pattern_dir / "__init__.py"
        assert init_file.exists(), "__init__.py not found"

        # Verify parent patterns directory also has __init__.py
        patterns_dir = pattern_dir.parent
        patterns_init = patterns_dir / "__init__.py"
        assert patterns_init.exists(), "patterns/__init__.py not found"

    def test_no_unexpected_top_level_files(self, pattern_dir):
        """Verify there are no unexpected files at the top level."""
        # Get all files in the pattern directory (non-recursive)
        actual_files = {f.name for f in pattern_dir.iterdir() if f.is_file()}

        # Define expected files (can include optional files)
        expected_files = {
            "__init__.py",
            "swarm_agent.py",
            "Dockerfile",
            "requirements.txt",
            "README.md",  # Optional but acceptable
            "TESTING.md",  # Optional but acceptable
            "CDK_COMPATIBILITY.md",  # Optional but acceptable
        }

        # Check for unexpected files
        unexpected_files = actual_files - expected_files
        assert not unexpected_files, f"Unexpected files found: {unexpected_files}"

    def test_directory_structure_matches_pattern(self, pattern_dir):
        """Verify the directory structure matches other patterns."""
        # Compare with strands-single-agent structure
        repo_root = pattern_dir.parent.parent
        reference_pattern = repo_root / "patterns" / "strands-single-agent"

        if reference_pattern.exists():
            # Both should have __init__.py
            assert (pattern_dir / "__init__.py").exists()
            assert (reference_pattern / "__init__.py").exists()

            # Both should have Dockerfile
            assert (pattern_dir / "Dockerfile").exists()
            assert (reference_pattern / "Dockerfile").exists()

            # Both should have requirements.txt
            assert (pattern_dir / "requirements.txt").exists()
            assert (reference_pattern / "requirements.txt").exists()


class TestEnvironmentVariableUsage:
    """Test suite for validating environment variable usage."""

    @pytest.fixture
    def swarm_agent_code(self):
        """Read the swarm_agent.py file content."""
        repo_root = Path(__file__).parent.parent.parent
        swarm_agent_path = (
            repo_root / "patterns" / "strands-swarm-agent" / "swarm_agent.py"
        )
        with open(swarm_agent_path, "r") as f:
            return f.read()

    def test_stack_name_environment_variable(self, swarm_agent_code):
        """Verify code uses STACK_NAME environment variable."""
        assert "STACK_NAME" in swarm_agent_code, (
            "STACK_NAME environment variable not found in code"
        )
        assert (
            'os.environ["STACK_NAME"]' in swarm_agent_code
            or "os.environ.get('STACK_NAME')" in swarm_agent_code
            or 'os.environ.get("STACK_NAME")' in swarm_agent_code
        ), "STACK_NAME not accessed via os.environ"

    def test_memory_id_environment_variable(self, swarm_agent_code):
        """Verify code uses MEMORY_ID environment variable."""
        assert "MEMORY_ID" in swarm_agent_code, (
            "MEMORY_ID environment variable not found in code"
        )
        assert (
            'os.environ["MEMORY_ID"]' in swarm_agent_code
            or "os.environ.get('MEMORY_ID')" in swarm_agent_code
            or 'os.environ.get("MEMORY_ID")' in swarm_agent_code
        ), "MEMORY_ID not accessed via os.environ"

    def test_aws_region_environment_variable(self, swarm_agent_code):
        """Verify code uses AWS_REGION or AWS_DEFAULT_REGION environment variable."""
        has_aws_region = (
            "AWS_REGION" in swarm_agent_code or "AWS_DEFAULT_REGION" in swarm_agent_code
        )
        assert has_aws_region, (
            "AWS_REGION or AWS_DEFAULT_REGION environment variable not found in code"
        )

    def test_ssm_parameter_path_construction(self, swarm_agent_code):
        """Verify SSM parameter paths are constructed using STACK_NAME."""
        # Check for SSM parameter path patterns like /{stack_name}/...
        assert (
            "/{" in swarm_agent_code
            or 'f"/' in swarm_agent_code
            or "f'/" in swarm_agent_code
        ), "SSM parameter path construction not found"

        # Check for specific SSM parameters that CDK provisions
        expected_params = ["gateway_url", "cognito_provider", "machine_client_id"]
        for param in expected_params:
            assert param in swarm_agent_code, (
                f"Expected SSM parameter '{param}' not found in code"
            )

    def test_secrets_manager_access(self, swarm_agent_code):
        """Verify Secrets Manager access matches CDK provisioning."""
        # Check for Secrets Manager client usage
        assert (
            "secretsmanager" in swarm_agent_code.lower()
            or "get_secret_value" in swarm_agent_code
        ), "Secrets Manager access not found in code"

        # Check for machine_client_secret parameter
        assert "machine_client_secret" in swarm_agent_code, (
            "machine_client_secret parameter not found in code"
        )

    def test_ssm_parameter_format_matches_cdk(self, swarm_agent_code):
        """Verify SSM parameter format matches CDK provisioning pattern."""
        # CDK uses format: /{stack_name_base}/parameter_name
        # Code should construct paths like: f"/{stack_name}/gateway_url"

        # Check for gateway_url parameter (CDK: /{stack_name_base}/gateway_url)
        assert "gateway_url" in swarm_agent_code, "gateway_url parameter not found"

        # Check for cognito_provider parameter (CDK: /{stack_name_base}/cognito_provider)
        assert "cognito_provider" in swarm_agent_code, (
            "cognito_provider parameter not found"
        )

        # Check for machine_client_id parameter (CDK: /{stack_name_base}/machine_client_id)
        assert "machine_client_id" in swarm_agent_code, (
            "machine_client_id parameter not found"
        )

    def test_environment_variable_validation(self, swarm_agent_code):
        """Verify code validates required environment variables."""
        # Check for validation logic
        assert "ValueError" in swarm_agent_code or "raise" in swarm_agent_code, (
            "No error handling for missing environment variables found"
        )

    def test_stack_name_validation(self, swarm_agent_code):
        """Verify STACK_NAME is validated before use."""
        # Check for validation patterns
        has_validation = any(
            [
                "validate" in swarm_agent_code.lower(),
                "if not" in swarm_agent_code,
                "ValueError" in swarm_agent_code,
            ]
        )
        assert has_validation, "No validation logic found for STACK_NAME"


class TestCDKIntegrationPoints:
    """Test suite for validating CDK integration points."""

    @pytest.fixture
    def dockerfile_content(self):
        """Read the Dockerfile content."""
        repo_root = Path(__file__).parent.parent.parent
        dockerfile_path = repo_root / "patterns" / "strands-swarm-agent" / "Dockerfile"
        with open(dockerfile_path, "r") as f:
            return f.read()

    @pytest.fixture
    def requirements_content(self):
        """Read the requirements.txt content."""
        repo_root = Path(__file__).parent.parent.parent
        requirements_path = (
            repo_root / "patterns" / "strands-swarm-agent" / "requirements.txt"
        )
        with open(requirements_path, "r") as f:
            return f.read()

    def test_dockerfile_copies_gateway_directory(self, dockerfile_content):
        """Verify Dockerfile copies gateway/ directory as expected by CDK."""
        # CDK reads gateway/ directory for ZIP deployment
        assert (
            "COPY gateway" in dockerfile_content
            or "COPY ./gateway" in dockerfile_content
        ), "Dockerfile does not copy gateway/ directory"

    def test_dockerfile_copies_tools_directory(self, dockerfile_content):
        """Verify Dockerfile copies tools/ directory as expected by CDK."""
        # CDK reads tools/ directory for ZIP deployment
        assert (
            "COPY tools" in dockerfile_content or "COPY ./tools" in dockerfile_content
        ), "Dockerfile does not copy tools/ directory"

    def test_dockerfile_exposes_port_8080(self, dockerfile_content):
        """Verify Dockerfile exposes port 8080 as expected by AgentCore Runtime."""
        assert "EXPOSE 8080" in dockerfile_content, (
            "Dockerfile does not expose port 8080"
        )

    def test_dockerfile_uses_opentelemetry(self, dockerfile_content):
        """Verify Dockerfile uses OpenTelemetry instrumentation."""
        assert "opentelemetry-instrument" in dockerfile_content, (
            "Dockerfile does not use opentelemetry-instrument"
        )

    def test_requirements_includes_bedrock_agentcore(self, requirements_content):
        """Verify requirements.txt includes bedrock-agentcore package."""
        assert "bedrock-agentcore" in requirements_content, (
            "requirements.txt does not include bedrock-agentcore"
        )

    def test_requirements_includes_strands_agents(self, requirements_content):
        """Verify requirements.txt includes strands-agents package."""
        assert "strands-agents" in requirements_content, (
            "requirements.txt does not include strands-agents"
        )

    def test_requirements_includes_boto3(self, requirements_content):
        """Verify requirements.txt includes boto3 for AWS SDK."""
        assert "boto3" in requirements_content, (
            "requirements.txt does not include boto3"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
