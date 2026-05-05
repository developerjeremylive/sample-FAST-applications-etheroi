# Makefile for code quality and formatting

# Define color codes
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m  # No Color

# Default target - run both lint and test
all: lint test

# Run all tests
test:
	uv run pytest tests/ -v

# Run property-based tests only
test-property:
	uv run pytest tests/property/ -v

# Run property tests with statistics
test-property-stats:
	uv run pytest tests/property/ -v --hypothesis-show-statistics

# Run unit tests only
test-unit:
	uv run pytest tests/unit/ -v

# Run integration tests only
test-integration:
	uv run pytest tests/integration/ -v

# Run Gateway integration tests specifically
test-gateway:
	uv run pytest tests/property/test_ssm_properties.py -v

# Run both linting and formatting in one command
lint: ruff-lint format eslint

# Run ESLint on frontend code
eslint:
	cd frontend && npm run lint

# Run linting checks and fix issues automatically
ruff-lint:
	ruff check --fix

# Format code according to project standards
format:
	ruff format

# CI/CD version of lint that only checks but doesn't modify files
# Used in CI pipelines to verify code quality without making changes
lint-cicd:
	@echo "Running code quality checks..."
	@if ! ruff check; then \
		echo -e "$(RED)ERROR: Ruff linting failed!$(NC)"; \
		echo -e "$(YELLOW)Please run 'make ruff-lint' locally to fix these issues.$(NC)"; \
		exit 1; \
	fi
	@if ! ruff format --check; then \
		echo -e "$(RED)ERROR: Code formatting check failed!$(NC)"; \
		echo -e "$(YELLOW)Please run 'make format' locally to fix these issues.$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(GREEN)All code quality checks passed!$(NC)"
