# Build stage
FROM node:20-alpine AS builder

# Use alpine-based image and install only necessary dependencies
RUN apk add --no-cache openssl

WORKDIR /app

# Only needed for prisma build
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Write DATABASE_URL to .env file
RUN echo "DATABASE_URL=$DATABASE_URL" > .env

# Copy only necessary files for dependency installation
COPY package.json yarn.lock ./
COPY prisma ./prisma/

# Install dependencies and generate prisma client
RUN yarn install --frozen-lockfile 
RUN yarn prisma:generate
RUN yarn prisma:migrate:deploy
RUN yarn cache clean

# RUN yarn install --frozen-lockfile --production \
#   && yarn prisma:generate \
#   && yarn prisma:migrate:deploy \
#   && yarn cache clean

# Copy source files and build
COPY . .
RUN yarn run build

# Production stage
FROM node:20-alpine

LABEL maintainer="FAIR Data Innovations Hub <contact@fairdataihub.org>" \
  description="Your coding assistant to make research software reusable without breaking a sweat!"

RUN apk add --no-cache openssl

WORKDIR /app

# Copy only the necessary files from builder stage
COPY --from=builder /app/.output ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

CMD ["node", "/app/server/index.mjs"]