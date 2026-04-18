.PHONY: help install dev build preview clean lint \
        docker-build docker-run docker-stop docker-logs docker-shell \
        docker-clean docker-push check precheck

# ─── Variables ────────────────────────────────────────────────────────────────
DOCKER_IMAGE_NAME := visual-learning
DOCKER_IMAGE_TAG := latest
DOCKER_CONTAINER_NAME := $(DOCKER_IMAGE_NAME)-app
DOCKER_PORT := 3000
NODE_VERSION := $(shell node --version)
NPM_VERSION := $(shell npm --version)
DOCKER_VERSION := $(shell docker --version 2>/dev/null || echo "not installed")

# ─── Default ──────────────────────────────────────────────────────────────────
.DEFAULT_GOAL := help

# ─── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo "╔════════════════════════════════════════════════════════════════════════════════╗"
	@echo "║                         System Design Simulator                                ║"
	@echo "║                    Interactive Learning Tool • React + Vite                    ║"
	@echo "╚════════════════════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📦 SETUP & BUILD"
	@echo "  make install          Install dependencies"
	@echo "  make check            Verify environment prerequisites"
	@echo "  make build            Build for production"
	@echo ""
	@echo "🚀 DEVELOPMENT"
	@echo "  make dev              Start dev server with HMR"
	@echo "  make lint             Run ESLint checks"
	@echo "  make preview          Preview production build locally"
	@echo ""
	@echo "🐳 DOCKER"
	@echo "  make docker-build     Build Docker image"
	@echo "  make docker-run       Run container (port 3000)"
	@echo "  make docker-stop      Stop running container"
	@echo "  make docker-logs      View container logs"
	@echo "  make docker-shell     Open shell in running container"
	@echo "  make docker-clean     Remove image and container"
	@echo ""
	@echo "🧹 CLEANUP"
	@echo "  make clean            Remove node_modules, dist, build artifacts"
	@echo ""
	@echo "ℹ️  ENVIRONMENT"
	@echo "  Node $(NODE_VERSION) | npm $(NPM_VERSION)"
	@echo "  Docker: $(DOCKER_VERSION)"

# ─── Check & Precheck ─────────────────────────────────────────────────────────
check: precheck
	@echo "✅ All checks passed!"

precheck:
	@echo "🔍 Checking prerequisites..."
	@command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "❌ npm required"; exit 1; }
	@echo "✓ Node.js $(NODE_VERSION)"
	@echo "✓ npm $(NPM_VERSION)"
	@[ -f package.json ] || { echo "❌ package.json not found"; exit 1; }
	@echo "✓ package.json present"
	@[ -f src/App.tsx ] || { echo "❌ src/App.tsx not found"; exit 1; }
	@echo "✓ Source files present"
	@echo ""

# ─── Setup ────────────────────────────────────────────────────────────────────
install: precheck
	@echo "📦 Installing dependencies..."
	npm ci --frozen-lockfile
	@echo "✅ Dependencies installed"

# ─── Development ──────────────────────────────────────────────────────────────
dev: precheck
	@echo "🚀 Starting development server..."
	npm run dev

build: precheck
	@echo "🔨 Building for production..."
	npm run build
	@echo "✅ Build complete (dist/)"

preview: build
	@echo "👀 Previewing production build..."
	npm run preview

lint: precheck
	@echo "🔍 Running ESLint..."
	npm run lint

# ─── Docker ───────────────────────────────────────────────────────────────────
docker-build: precheck
	@echo "🐳 Building Docker image: $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG)"
	docker build -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) \
		-f Dockerfile \
		--build-arg NODE_ENV=production \
		.
	@echo "✅ Docker image built successfully"
	@docker images | grep $(DOCKER_IMAGE_NAME) | head -1

docker-run: docker-build
	@echo "🚀 Running container: $(DOCKER_CONTAINER_NAME)"
	@docker ps -q -f name=$(DOCKER_CONTAINER_NAME) && docker stop $(DOCKER_CONTAINER_NAME) 2>/dev/null || true
	docker run -d \
		--name $(DOCKER_CONTAINER_NAME) \
		-p $(DOCKER_PORT):80 \
		--health-cmd='wget -qO- http://localhost/healthz || exit 1' \
		--health-interval=30s \
		--health-timeout=5s \
		--health-retries=3 \
		-v /etc/localtime:/etc/localtime:ro \
		$(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG)
	@echo "✅ Container running on http://localhost:$(DOCKER_PORT)"
	@sleep 2 && docker ps | grep $(DOCKER_CONTAINER_NAME)

docker-stop:
	@echo "⏸️  Stopping container: $(DOCKER_CONTAINER_NAME)"
	docker stop $(DOCKER_CONTAINER_NAME) 2>/dev/null || true
	docker rm $(DOCKER_CONTAINER_NAME) 2>/dev/null || true
	@echo "✅ Container stopped"

docker-logs:
	@echo "📋 Container logs:"
	docker logs -f $(DOCKER_CONTAINER_NAME)

docker-shell:
	@echo "🔓 Opening shell in container..."
	docker exec -it $(DOCKER_CONTAINER_NAME) sh

docker-clean: docker-stop
	@echo "🗑️  Removing Docker image: $(DOCKER_IMAGE_NAME)"
	docker rmi $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) 2>/dev/null || true
	@echo "✅ Docker cleanup complete"

# ─── Cleanup ──────────────────────────────────────────────────────────────────
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf node_modules dist dist-ssr .vite .eslintcache
	@echo "✅ Cleanup complete"

# ─── Phony targets ────────────────────────────────────────────────────────────
.PHONY: help check precheck install dev build preview lint \
        docker-build docker-run docker-stop docker-logs docker-shell docker-clean clean
