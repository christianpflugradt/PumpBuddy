.PHONY: \
	check \
	setup-dev \
	install-git-hooks \
	git-hooks-status \
	run-app \
	stop-app \
	rebuild-app \
	generate-openapi \
	generate-openapi-backend \
	generate-openapi-renderer \
	refresh-api-clients \
	refresh-backend-api-client \
	refresh-frontend-api-client

OPENAPI_CONTRACT := agent/design/api-contract.yaml
OPENAPI_GENERATOR_IMAGE ?= openapitools/openapi-generator-cli:v7.21.0
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
	$(MAKE) generate-openapi-backend
	docker compose build --no-cache
	docker compose up -d --force-recreate
	agent/scripts/seed-dev-access-key.sh

setup-dev:
	agent/scripts/install-git-hooks.sh install

install-git-hooks:
	agent/scripts/install-git-hooks.sh install

git-hooks-status:
	agent/scripts/install-git-hooks.sh status

refresh-api-clients: refresh-backend-api-client refresh-frontend-api-client

generate-openapi: refresh-api-clients

generate-openapi-backend: refresh-backend-api-client

generate-openapi-renderer: refresh-frontend-api-client

refresh-backend-api-client:
	rm -rf "$(OPENAPI_BACKEND_OUTPUT)"
	$(OPENAPI_DOCKER_RUN) generate \
		-i "/local/$(OPENAPI_CONTRACT)" \
		-g rust \
		-o "/local/$(OPENAPI_BACKEND_OUTPUT)" \
		--type-mappings UUID=String,Uuid=String,uuid=String,date-time=String,DateTime=String \
		--global-property models,apis=false,supportingFiles=false,modelDocs=false,modelTests=false

refresh-frontend-api-client:
	rm -rf "$(OPENAPI_RENDERER_OUTPUT)"
	$(OPENAPI_DOCKER_RUN) generate \
		-i "/local/$(OPENAPI_CONTRACT)" \
		-g typescript-fetch \
		-o "/local/$(OPENAPI_RENDERER_OUTPUT)" \
		--additional-properties=modelPropertyNaming=original \
		--global-property models,apis=false,supportingFiles=runtime.ts,modelDocs=false,modelTests=false
