# Contributing to nostter

Contributions are welcome. You can contribute by reporting issues, suggesting improvements, or submitting pull requests.

## Getting started

This repository is an npm workspace. The web application is located in the `web` workspace.

Requirements:

- Node.js 24
- npm 11.10.0 or later

Install dependencies from the repository root and start the development server:

```
npm ci
npm run dev -w web
```

## Development

Run commands from the repository root and select the `web` workspace with `-w web`.

| Command | Description |
| --- | --- |
| `npm run dev -w web` | Start the development server |
| `npm run build -w web` | Build the application |
| `npm run check -w web` | Run Svelte and TypeScript checks |
| `npm run lint -w web` | Run Prettier and ESLint checks |
| `npm test -w web` | Run unit tests |
| `npm run test:e2e -w web` | Run end-to-end tests |
| `npm run format -w web` | Format source files |

The application has default relay settings and does not require an `.env` file for normal development. To override relay settings, see [`web/.env.example`](web/.env.example).

## Testing

Run the checks relevant to your changes before submitting a pull request.

Pull requests are automatically checked with:

- `npm run check -w web`
- `npm run lint -w web`
- `npm test -w web`
- `npm run test:e2e -w web`

Playwright browser binaries are required to run the end-to-end tests locally. Install them with:

```
npm exec -w web -- playwright install
```

To run the end-to-end tests, run a Nostr relay locally and pass its URL with `E2E_RELAY_URL` (default: `ws://127.0.0.1:8080/`):

```
E2E_RELAY_URL=ws://localhost:7000/ npm run test:e2e -w web
```

## Making changes

See the [architecture guide](ARCHITECTURE.md) for module responsibilities and dependency rules, and the [coding guidelines](docs/coding-guidelines.md) for coding conventions.

- Keep changes focused on the purpose of the pull request.
- Add or update tests when changing behavior.
- Avoid unrelated refactoring or formatting changes.

## Pull requests

When submitting a pull request:

- Describe what the change does and why it is needed.
- Link related issues when applicable.
- Include screenshots or other visual evidence for user interface changes when useful.
- Keep each pull request focused on a single purpose.

## Issues and discussions

Use GitHub Issues for bug reports and feature requests.

Use GitHub Discussions for questions and broader ideas.
