# BobAI 🤖

Hey! Welcome to **BobAI**, my attempt at building an AI platform of my own.

The idea is to bring a bunch of useful AI features into one project: model providers, memory, file understanding, agents, automations, and an API that ties things together. It's a big project, and it's still a work in progress, so expect things to change as I keep building and learning.

## What's in here?

- **Model providers** for connecting AI models
- **Memory** and file-understanding features
- **Agents and automations** for getting tasks done
- **An API** and optional supporting services
- **Self-hosting support**, so you can run your own instance

Not every feature works without extra setup. Some need provider credentials, a database, or local services.

## Getting started

You'll need:

- Node.js 24 or newer
- npm
- PostgreSQL, with the extensions required by your setup
- Credentials for whichever providers or services you want to use

Clone the repo and install its dependencies:

```bash
git clone https://github.com/BobPlayz/BobAi.git
cd BobAi
npm ci
```

Make a local environment file:

**Windows (Command Prompt):**
```bat
copy .env.example .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

Open `.env` and fill in the settings needed for the features you want to try. Don't put real secrets in the repo.

## Useful commands

```bash
npm run ai     # Start the development services
npm run build  # Build the project
npm test       # Run tests
```

If something doesn't work right away, check the environment settings first. This project has a few moving parts, and I'm still improving how they fit together.

## A quick security note

Never commit API keys, bot tokens, private keys, database URLs, or your real `.env` file. Before putting an instance on the public internet, configure HTTPS, authentication, CORS, and a production-ready database properly.

## Still building 🚧

BobAI is a personal project that I'm growing over time. Suggestions, bug reports, and ideas are welcome!

## License

Check the repository's license information for the current terms.
