include .env.deploy

.PHONY: build deploy clean

APP=exercisedb
APP_TAG=v1.0.0
USER_API_ADDRESS=$(USER)@$(HOST)
SSH_DEPLOY_PATH=$(USER_API_ADDRESS):$(DEPLOY_PATH)

# ======== 1. OS 判斷與變數定義 (必須在 Target 外部) ========
ifeq ($(OS),Windows_NT)
    # Windows 環境
	SHELL := cmd.exe
    # 使用 Sysnative 繞過 32bit 重導向陷阱
    # 注意：在 64bit shell 中看得到 System32，但在 32bit make 中要用 Sysnative
    SCP   := "C:\Windows\Sysnative\OpenSSH\scp.exe"
    SSH   := "C:\Windows\Sysnative\OpenSSH\ssh.exe"
    RM    := del /Q
    # 定義 Windows 執行的指令字串
    define DEPLOY_CMD
    $(SCP) $(APP).tar $(SSH_DEPLOY_PATH)/
    $(SCP) docker-compose.yml $(SSH_DEPLOY_PATH)/
    $(SSH) $(USER_API_ADDRESS) "docker load -i $(DEPLOY_PATH)/$(APP).tar; rm $(DEPLOY_PATH)/$(APP).tar; docker compose up -d"
    endef
    # 定義 Windows 清理邏輯
    define CLEAN_CMD
    if exist $(APP).tar $(RM) $(APP).tar
    endef
else
    # Linux / macOS 環境
    SHELL := /bin/bash
    .SHELLFLAGS := -e -o pipefail -c
    SCP   := scp
    SSH   := ssh
    RM    := rm -f
    define DEPLOY_CMD
    rsync -avzh $(APP).tar $(SSH_DEPLOY_PATH)
    $(SSH) $(USER_API_ADDRESS) 'docker load -i $(DEPLOY_PATH)/$(APP).tar; rm $(DEPLOY_PATH)/$(APP).tar; docker compose up -d'
    endef
    define CLEAN_CMD
    $(RM) $(APP).tar
    endef
endif

# ======== 2. Targets (指令區只放變數引用) ========

build:
	docker build --platform="linux/amd64" -t zihyan/$(APP):$(APP_TAG) -f Dockerfile .
	docker save zihyan/$(APP):$(APP_TAG) -o $(APP).tar

deploy:
	@echo Starting deployment for $(OS)...
	$(DEPLOY_CMD)

clean:
	$(CLEAN_CMD)
	docker rmi zihyan/$(APP):$(APP_TAG) || true