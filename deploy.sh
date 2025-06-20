#!/bin/bash

# Voice Translator Deployment Script
# This script deploys the voice translator application using Docker Compose

# Set environment to production
export NODE_ENV=production

# Default configuration
COMPOSE_FILE="docker-compose.yml"
ENVIRONMENT="development"
COMPOSE_ENV_FILE=""
PULL_IMAGES=false
BACKUP_DB=false
USE_GPU=true

# Detect Mac/Apple Silicon
if [[ $(uname) == "Darwin" && $(uname -m) == "arm64" ]]; then
  echo "🍎 Detected Apple Silicon (M-series Mac)"
  USE_GPU=false
  MAC_OVERRIDE="-f docker-compose.mac.yml"
else
  MAC_OVERRIDE=""
fi

# Process command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --prod|-p)
      ENVIRONMENT="production"
      COMPOSE_ENV_FILE="-f docker-compose.prod.yml"
      shift
      ;;
    --dev|-d)
      ENVIRONMENT="development"
      COMPOSE_ENV_FILE="-f docker-compose.development.yml"
      shift
      ;;
    --pull)
      PULL_IMAGES=true
      shift
      ;;
    --backup)
      BACKUP_DB=true
      shift
      ;;
    --no-gpu)
      USE_GPU=false
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --prod, -p       Deploy in production mode"
      echo "  --dev, -d        Deploy in development mode (optimized for local development)"
      echo "  --pull           Pull latest images before deploying"
      echo "  --backup         Backup the database before deploying"
      echo "  --no-gpu         Run without GPU support"
      echo "  --help, -h       Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed or not in your PATH."
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  echo "❌ Docker Compose is not installed or not in your PATH."
  exit 1
fi

echo "🚀 Deploying Voice Translator in $ENVIRONMENT mode..."

# Create directories if they don't exist
mkdir -p data
mkdir -p backups
mkdir -p traefik/acme

# Set permissions for the directories
chmod -R 755 data
chmod -R 755 backups
chmod -R 755 traefik

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env << EOF
# PostgreSQL Configuration
POSTGRES_PASSWORD=postgres
PG_HOST=postgres
PG_PORT=5432
PG_DATABASE=translation_memory
PG_USER=postgres
PG_PASSWORD=postgres

# Ollama Configuration
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=deepseek-r1:8b

# Grafana Configuration
GRAFANA_PASSWORD=admin

# Environment
NODE_ENV=$ENVIRONMENT
EOF
fi

# Backup the database if requested
if [ "$BACKUP_DB" = true ]; then
  echo "📦 Backing up the database..."
  BACKUP_FILENAME="backups/backup-$(date +%Y-%m-%d_%H-%M-%S).sql"
  docker-compose exec postgres pg_dump -U postgres -d translation_memory > "$BACKUP_FILENAME"
  gzip "$BACKUP_FILENAME"
  echo "✅ Database backup created: $BACKUP_FILENAME.gz"
fi

# Pull latest images if requested
if [ "$PULL_IMAGES" = true ]; then
  echo "📥 Pulling latest Docker images..."
  docker-compose -f $COMPOSE_FILE pull
fi

# Set GPU options
if [ "$USE_GPU" = false ]; then
  export DOCKER_COMPOSE_GPU_FLAG=""
  echo "🖥️ Running without GPU support"
else
  # Check if NVIDIA runtime is available
  if docker info | grep -q "Runtimes:.*nvidia"; then
    export DOCKER_COMPOSE_GPU_FLAG="--gpus all"
    echo "🖥️ Running with NVIDIA GPU support"
  else
    echo "⚠️ NVIDIA runtime not available. Running without GPU support."
    export DOCKER_COMPOSE_GPU_FLAG=""
  fi
fi

# Deploy the application
echo "🚀 Starting the Voice Translator services..."
FINAL_COMPOSE_FILE="docker-compose.yml ${COMPOSE_ENV_FILE} ${MAC_OVERRIDE}"
echo "Using Docker Compose files: ${FINAL_COMPOSE_FILE}"
docker-compose -f docker-compose.yml ${COMPOSE_ENV_FILE} ${MAC_OVERRIDE} up -d

# Check if the deployment was successful
if [ $? -eq 0 ]; then
  echo "✅ Voice Translator successfully deployed in $ENVIRONMENT mode!"
  echo "📊 Access the application at:"
  echo "   - Voice Translator: http://localhost:3000"
  echo "   - Streamlit UI: http://localhost:8501"
  
  if [ "$ENVIRONMENT" = "production" ]; then
    echo "   - Traefik Dashboard: http://localhost:8080"
  fi
  
  echo "   - Grafana Dashboard: http://localhost:3001 (admin/admin)"
  echo "   - Prometheus: http://localhost:9090"
else
  echo "❌ Deployment failed."
  exit 1
fi
