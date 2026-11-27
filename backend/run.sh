#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
export PATH="$JAVA_HOME/bin:/home/sakib/.local/bin:$PATH"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "Starting QuantumTech Spring Boot Backend on port ${PORT:-8080}..."
mvn spring-boot:run
