.PHONY: \
	check \
	check-format \
	check-framework \
	check-api-contract \
	check-bootstrap-secret-handoff \
	check-backend \
	check-renderer \
	check-release-artifacts \
	check-release-candidate \
	check-release-toolchain \
	check-release-rules \
	check-rust-audit \
	prepare \
	coverage-backend \
	coverage-renderer \
	release-package \
	release-package-verify \
	run-app \
	stop-app \
	rebuild-app \
	rebuild-renderer \
	refresh-api-clients \
	refresh-backend-api-client \
	refresh-frontend-api-client

OPENAPI_CONTRACT := agent/design/api-contract.yaml
OPENAPI_GENERATOR_IMAGE ?= openapitools/openapi-generator-cli:v7.27.0@sha256:949efd0d5cf3c093ef169887b2ebe0879ee2e8074b6476264232ce4fd8ef46d0
OPENAPI_BACKEND_OUTPUT := backend/target/generated/openapi/rust
OPENAPI_RENDERER_OUTPUT := renderer/generated/openapi/typescript
OPENAPI_RENDERER_LEGACY_OUTPUT := renderer/dist/generated/openapi/typescript
COMPOSE_DEV_FILE := runtime/compose/compose.dev.yaml

OPENAPI_DOCKER_RUN = docker run --pull never --network none --rm -u "$$(id -u):$$(id -g)" -v "$(CURDIR):/local" "$(OPENAPI_GENERATOR_IMAGE)"

check:
	please run --at pre-push --checks-only

check-format:
	agent/scripts/run-quality.sh format

check-framework:
	python3 -B -m unittest discover -s agent/scripts/governance -p 'test_*.py'
	@PATH="$(CURDIR)/.tools/validation-venv/bin:$(PATH)" agent/scripts/check/validate-docs.sh
	@for task in discuss-plan refine-plan plan-item implement-item review-item finalize-plan review-architecture review-consistency review-quality review-security review-technology freestyle next-item; do \
		PATH="$(CURDIR)/.tools/validation-venv/bin:$(PATH)" agent/scripts/check/check-task-contract.sh "$$task" || exit; \
	done

check-bootstrap-secret-handoff:
	agent/scripts/check/check-bootstrap-secret-handoff.sh

check-api-contract:
	agent/scripts/check/verify-api-contract-alignment.sh

check-backend:
	agent/scripts/run-quality.sh backend

check-renderer:
	agent/scripts/run-quality.sh renderer

check-release-artifacts:
	agent/scripts/run-quality.sh release-artifacts

check-release-candidate:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 agent/scripts/run-quality.sh release-artifacts

check-release-toolchain:
	node agent/scripts/check/check-release-notes-toolchain.mjs

check-release-rules: check-release-toolchain
	node --test agent/scripts/release/test-release.mjs
	python3 -m unittest discover -s agent/scripts/release -p 'test_*.py'

check-rust-audit:
	cargo audit --file backend/Cargo.lock

prepare:
	agent/scripts/governance/prepare.sh check

coverage-backend:
	BACKEND_CHECK_WITH_COVERAGE=1 WRITE_COVERAGE_BADGES=1 $(MAKE) check-backend

coverage-renderer:
	WRITE_COVERAGE_BADGES=1 $(MAKE) check-renderer

release-package:
	python3 agent/scripts/release/artifacts.py package

release-package-verify:
	python3 agent/scripts/release/artifacts.py verify

run-app: refresh-api-clients
	docker compose -f "$(COMPOSE_DEV_FILE)" up -d

stop-app:
	docker compose -f "$(COMPOSE_DEV_FILE)" stop

rebuild-app: refresh-api-clients
	docker compose -f "$(COMPOSE_DEV_FILE)" down --volumes --remove-orphans
	docker compose -f "$(COMPOSE_DEV_FILE)" build --no-cache
	docker compose -f "$(COMPOSE_DEV_FILE)" up -d --force-recreate
	COMPOSE_FILE="$(COMPOSE_DEV_FILE)" agent/scripts/seed-dev-access-key.sh

rebuild-renderer: refresh-frontend-api-client
	docker compose -f "$(COMPOSE_DEV_FILE)" build --no-cache renderer
	docker compose -f "$(COMPOSE_DEV_FILE)" up -d --no-deps --force-recreate renderer

refresh-api-clients: refresh-backend-api-client refresh-frontend-api-client

refresh-backend-api-client:
	rm -rf "$(OPENAPI_BACKEND_OUTPUT)"
	$(OPENAPI_DOCKER_RUN) generate \
		-i "/local/$(OPENAPI_CONTRACT)" \
		-g rust \
		-o "/local/$(OPENAPI_BACKEND_OUTPUT)" \
		--type-mappings UUID=String,Uuid=String,uuid=String,date-time=String,DateTime=String \
		--model-name-mappings application/json=ApplicationJson \
		--global-property models,apis=false,supportingFiles=false,modelDocs=false,modelTests=false

refresh-frontend-api-client:
	rm -rf "$(OPENAPI_RENDERER_LEGACY_OUTPUT)" "$(OPENAPI_RENDERER_OUTPUT)"
	$(OPENAPI_DOCKER_RUN) generate \
		-i "/local/$(OPENAPI_CONTRACT)" \
		-g typescript-fetch \
		-o "/local/$(OPENAPI_RENDERER_OUTPUT)" \
		--additional-properties=modelPropertyNaming=original \
		--global-property models,apis=false,supportingFiles=runtime.ts,modelDocs=false,modelTests=false
