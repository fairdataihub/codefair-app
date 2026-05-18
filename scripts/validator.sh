#!/usr/bin/env sh

docker compose -f "$(dirname "$0")/../validator/docker-compose.yaml" up -d --build
