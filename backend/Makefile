# ==============================================================================
# Installation & Setup
# ==============================================================================

# Install dependencies using uv package manager
install:
	@command -v uv >/dev/null 2>&1 || { echo "uv is not installed. Installing uv..."; curl -LsSf https://astral.sh/uv/0.8.13/install.sh | sh; source $HOME/.local/bin/env; }
	uv sync

# ==============================================================================
# Playground Targets
# ==============================================================================

# Launch local dev playground
playground:
	@echo "==============================================================================="
	@echo "| 🚀 Starting your agent playground...                                        |"
	@echo "|                                                                             |"
	@echo "| 💡 Try asking: What's the weather in San Francisco?                         |"
	@echo "|                                                                             |"
	@echo "| 🔍 IMPORTANT: Select the 'agents' folder to interact with your agent.          |"
	@echo "==============================================================================="
	uv run adk web . --port 8501 --reload_agents

# ==============================================================================
# Backend Deployment Targets
# ==============================================================================

# Deploy the agent remotely
deploy:
	# Export dependencies to requirements file using uv export.
	(uv export --no-hashes --no-header --no-dev --no-emit-project --no-annotate > agents/app_utils/.requirements.txt 2>/dev/null || \
	uv export --no-hashes --no-header --no-dev --no-emit-project > agents/app_utils/.requirements.txt) && \
	uv run -m agents.app_utils.deploy \
		--source-packages=./agents \
		--entrypoint-module=agents.agent_engine_app \
		--entrypoint-object=agent_engine \
		--set-env-vars="GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true,OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true,BQ_DATASET_ID=autaugafarms,GOOGLE_PROJECT_ID=farm-pulse-478001" \
		--requirements-file=agents/app_utils/.requirements.txt

# Alias for 'make deploy' for backward compatibility
backend: deploy


# ==============================================================================
# Infrastructure Setup
# ==============================================================================

# Set up development environment resources using Terraform
setup-dev-env:
	PROJECT_ID=$$(gcloud config get-value project) && \
	(cd deployment/terraform/dev && terraform init && terraform apply --var-file vars/env.tfvars --var dev_project_id=$$PROJECT_ID --auto-approve)

# ==============================================================================
# Testing & Code Quality
# ==============================================================================

# Run unit and integration tests
test:
	uv sync --dev
	uv run pytest tests/unit && uv run pytest tests/integration

# Run code quality checks (codespell, ruff, mypy)
lint:
	uv sync --dev --extra lint
	uv run codespell
	uv run ruff check . --diff
	uv run ruff format . --check --diff
	uv run mypy .

# ==============================================================================
# Gemini Enterprise Integration
# ==============================================================================

# Register the deployed agent to Gemini Enterprise
# Usage: ID="projects/.../engines/xxx" make register-gemini-enterprise
# Optional env vars: GEMINI_DISPLAY_NAME, GEMINI_DESCRIPTION, GEMINI_TOOL_DESCRIPTION, AGENT_ENGINE_ID
register-gemini-enterprise:
	uvx agent-starter-pack@0.20.4 register-gemini-enterprise