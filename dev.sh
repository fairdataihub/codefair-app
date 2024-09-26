#!/bin/bash

# Start the UI app
cd ui
yarn dev &

# Start the bot app
cd ../bot
yarn dev &


## Run the following command to make the script executable
# chmod +x dev.sh
# ./dev.sh