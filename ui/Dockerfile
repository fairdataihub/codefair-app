# Build stage
FROM node:20-alpine AS builder

# Use alpine-based image and install only necessary dependencies
RUN apk add --no-cache openssl

WORKDIR /app

# Only needed for prisma build
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production

# Copy only necessary files for dependency installation
COPY package.json yarn.lock ./
COPY prisma ./prisma/

# Install dependencies and generate prisma client
RUN yarn install --frozen-lockfile --production \
  && yarn prisma:generate \
  && yarn cache clean \
  && yarn prisma:migrate:deploy

# Build stage for the application
FROM node:20-alpine AS build

WORKDIR /app

# Copy all source files
COPY . .
# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Only needed for prisma build
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production

# Build the application
RUN yarn run build \
  && yarn prisma:generate

# Production stage
FROM node:20-alpine

LABEL maintainer="FAIR Data Innovations Hub <contact@fairdataihub.org>" \
  description="Your coding assistant to make research software reusable without breaking a sweat!"

RUN apk add --no-cache openssl

WORKDIR /app

# Only needed for prisma build
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production

# Copy only the necessary files from previous stages
COPY --from=build /app/.output ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma


EXPOSE 3000

CMD ["node", "/app/server/index.mjs"]