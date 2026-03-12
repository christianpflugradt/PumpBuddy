.PHONY: check install-git-hooks compose-up compose-reset

check:
	agent/scripts/run-quality.sh check

compose-up:
	docker compose up -d

compose-reset:
	docker compose down --volumes --remove-orphans
	docker compose build --no-cache
	docker compose up -d --force-recreate

install-git-hooks:
	agent/scripts/install-git-hooks.sh install
