# BobAI

BobAI is a self-hostable AI platform built around a modular API, model providers, memory, file understanding, agents, automations, and optional local services.

## Requirements

- Node.js 24+
- npm
- PostgreSQL with the required extensions for your deployment
- Optional provider credentials or local model services, depending on the features you enable

## Download

Clone the repository:

```bash
git clone https://github.com/BobPlayz/BobAi.git
cd BobAi
npm ci
```

Create your environment file from the example:

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Fill in only the credentials and service settings required for the features you use.

## Run

Install dependencies:

```bash
npm ci
```

Start the development services:

```bash
npm run ai
```

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Security

Never commit real credentials, private keys, tokens, database URLs, model artifacts, or local environment files. Keep secrets in environment variables or your deployment platform's secret store.

Before exposing an instance to the internet, configure production environment values, HTTPS, an explicit CORS origin, strong authentication secrets, and a production database.

## License

See the repository metadata for the current licensing terms.
