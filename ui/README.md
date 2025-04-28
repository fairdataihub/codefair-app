# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
yarn dev

# bun
bun run dev
```

## Database

The api uses a postgres database. You can create one of these locally via docker:

```bash
docker-compose -f ./dev-docker-compose.yaml up
docker-compose -f ./dev-docker-compose.yaml up -d # if you want the db to run in the background
```

Close the database with:

```bash
docker-compose -f ./dev-docker-compose.yaml down -v
```

## Production

Build the application for production:

```bash
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
