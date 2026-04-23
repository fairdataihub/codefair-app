#!/bin/bash

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Start the UI app
cd "$ROOT/ui"
yarn dev &

# Start the bot app
cd "$ROOT/bot"
yarn dev &

# Start the validator app
cd "$ROOT/validator"
docker compose -f ./docker-compose.yaml up -d --build


## Run the following command to make the script executable
# chmod +x dev.sh
# ./dev.sh
