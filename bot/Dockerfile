# Start from a slim Node.js base image
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml (or pnpmfile.js if using custom pnpm configuration)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies with pnpm
RUN pnpm install --production

# Clean up pnpm store to reduce image size
RUN pnpm store prune --production

# Set environment variable for Node.js environment
ENV NODE_ENV="production"

# Copy the entire project files into the working directory
COPY . .

# Specify the command to run your application
CMD [ "pnpm", "start" ]
