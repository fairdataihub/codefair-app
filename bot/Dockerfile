# Build stage
FROM node:20-slim AS builder

# Combine RUN commands to reduce layers and cleanup in the same layer
RUN apt-get update -y \
    && apt-get install -y openssl --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only needed for prisma build
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production

# Build (only needs DATABASE_URL)
# docker build --build-arg DATABASE_URL=xxx .

# Copy only files needed for installation and prisma generation
COPY package.json yarn.lock ./
COPY prisma ./prisma/

# Install dependencies, generate prisma, and clean up
RUN yarn install --frozen-lockfile --production \
    && yarn prisma:generate \
    && yarn cache clean

# App stage
FROM node:20-slim

LABEL maintainer="FAIR Data Innovations Hub <contact@fairdataihub.org>"
LABEL description="Your coding assistant to make research software reusable without breaking a sweat!"

ENV DATABASE_URL=""
ENV NODE_ENV=production

RUN apt-get update -y \
    && apt-get install -y openssl --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Create app directory structure and copy files
COPY api ./api
COPY archival ./archival
COPY citation ./citation
COPY codemeta ./codemeta
COPY cwl ./cwl
COPY license ./license
COPY metadata ./metadata
COPY migrations ./migrations
COPY public ./public
COPY scripts ./scripts
COPY utils ./utils
COPY commands ./commands

# Copy configuration files
COPY app.yml db.js main.js index.js ./

EXPOSE 3000

CMD [ "node", "main.js" ]