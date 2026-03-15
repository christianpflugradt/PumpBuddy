.PHONY: \
	check \
	setup-dev \
	run-app \
	stop-app \
	rebuild-app \
	refresh-api-clients \
	refresh-backend-api-client \
	refresh-frontend-api-client

OPENAPI_CONTRACT := agent/design/api-contract.yaml
OPENAPI_GENERATOR_IMAGE ?= openapitools/openapi-generator-cli:v7.20.0
OPENAPI_BACKEND_OUTPUT := backend/target/generated/openapi/rust
OPENAPI_RENDERER_OUTPUT := renderer/dist/generated/openapi/typescript

OPENAPI_DOCKER_RUN = docker run --rm -u "$$(id -u):$$(id -g)" -v "$(CURDIR):/local" "$(OPENAPI_GENERATOR_IMAGE)"

check:
	agent/scripts/run-quality.sh check

run-app:
	docker compose up -d

stop-app:
	docker compose stop

rebuild-app:
	docker compose down --volumes --remove-orphans
	docker compose build --no-cache
	docker compose up -d --force-recreate

setup-dev:
	agent/scripts/install-git-hooks.sh install

refresh-api-clients: refresh-backend-api-client refresh-frontend-api-client

refresh-backend-api-client:
	rm -rf "$(OPENAPI_BACKEND_OUTPUT)"
	$(OPENAPI_DOCKER_RUN) generate \
		-i "/local/$(OPENAPI_CONTRACT)" \
		-g rust \
		-o "/local/$(OPENAPI_BACKEND_OUTPUT)" \
		--global-property models,apis=false,supportingFiles=false,modelDocs=false,modelTests=false

refresh-frontend-api-client:
	rm -rf "$(OPENAPI_RENDERER_OUTPUT)"
	$(OPENAPI_DOCKER_RUN) generate \
		-i "/local/$(OPENAPI_CONTRACT)" \
		-g typescript-fetch \
		-o "/local/$(OPENAPI_RENDERER_OUTPUT)" \
		--global-property models,apis=false,supportingFiles=false,modelDocs=false,modelTests=false
