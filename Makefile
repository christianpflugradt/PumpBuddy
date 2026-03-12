.PHONY: check install-git-hooks git-hooks-status

check:
	agent/scripts/run-quality.sh check

install-git-hooks:
	agent/scripts/install-git-hooks.sh install

git-hooks-status:
	agent/scripts/install-git-hooks.sh status
