# Contributing to nostter

Contributions are welcome. You can contribute by reporting issues, suggesting improvements, or submitting pull requests.

## Getting started

The web application is located in the `web` directory.

Requirements:

- Node.js 24
- npm 11.10.0 or later

Install dependencies and start the development server:

```
cd web
npm ci
npm run dev
```

## Development

Run commands from the `web` directory.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the application |
| `npm run check` | Run Svelte and TypeScript checks |
| `npm run lint` | Run Prettier and ESLint checks |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run format` | Format source files |

The application has default relay settings and does not require an `.env` file for normal development. To override relay settings, see [`web/.env.example`](web/.env.example).

## Testing

Run the checks relevant to your changes before submitting a pull request.

Pull requests are automatically checked with:

- `npm run check`
- `npm run lint`
- `npm test`
- `npm run test:e2e`

Playwright browser binaries are required to run the end-to-end tests locally. Install them with:

```
npx playwright install
```

## Making changes

- Keep changes focused on the purpose of the pull request.
- Follow the existing code style.
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
