.PHONY: \
	check \
	check-framework \
	check-api-contract \
	check-bootstrap-secret-handoff \
	check-backend \
	check-renderer \
	check-release-artifacts \
	check-release-candidate-backend \
	check-release-candidate-renderer \
	prepare \
	coverage-backend \
	coverage-renderer \
	run-app \
	stop-app \
	rebuild-app \
	rebuild-renderer \
	refresh-api-clients \
	refresh-backend-api-client \
	refresh-frontend-api-client

OPENAPI_CONTRACT := specs/design/api-contract.yaml
OPENAPI_GENERATOR_IMAGE ?= openapitools/openapi-generator-cli:v7.27.0@sha256:949efd0d5cf3c093ef169887b2ebe0879ee2e8074b6476264232ce4fd8ef46d0
OPENAPI_BACKEND_OUTPUT := backend/target/generated/openapi/rust
OPENAPI_RENDERER_OUTPUT := renderer/generated/openapi/typescript
OPENAPI_RENDERER_LEGACY_OUTPUT := renderer/dist/generated/openapi/typescript
COMPOSE_DEV_FILE := runtime/compose/compose.dev.yaml

OPENAPI_DOCKER_RUN = docker run --pull never --network none --rm -u "$$(id -u):$$(id -g)" -v "$(CURDIR):/local" "$(OPENAPI_GENERATOR_IMAGE)"

check:
	please run --at pre-push --checks-only

check-framework:
	python3 -B -m unittest discover -s tools/governance -p 'test_*.py'
	@PATH="$(CURDIR)/.tools/validation-venv/bin:$(PATH)" tools/check/validate-docs.sh

check-bootstrap-secret-handoff:
	tools/check/check-bootstrap-secret-handoff.sh

check-api-contract:
	tools/check/verify-api-contract-alignment.sh

check-backend:
	tools/run-quality.sh backend

check-renderer:
	tools/run-quality.sh renderer

check-release-artifacts:
	tools/run-quality.sh release-artifacts

check-release-candidate-backend:
	tools/run-quality.sh release-candidate-backend

check-release-candidate-renderer:
	tools/run-quality.sh release-candidate-renderer

prepare:
	tools/governance/prepare.sh check

coverage-backend:
	BACKEND_CHECK_WITH_COVERAGE=1 WRITE_COVERAGE_METRICS=1 $(MAKE) check-backend

coverage-renderer:
	WRITE_COVERAGE_METRICS=1 $(MAKE) check-renderer

run-app: refresh-api-clients
	docker compose -f "$(COMPOSE_DEV_FILE)" up -d

stop-app:
	docker compose -f "$(COMPOSE_DEV_FILE)" stop

rebuild-app: refresh-api-clients
	docker compose -f "$(COMPOSE_DEV_FILE)" down --volumes --remove-orphans
	docker compose -f "$(COMPOSE_DEV_FILE)" build --no-cache
	docker compose -f "$(COMPOSE_DEV_FILE)" up -d --force-recreate
	COMPOSE_FILE="$(COMPOSE_DEV_FILE)" tools/seed-dev-access-key.sh

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
