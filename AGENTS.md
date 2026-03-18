# Repository Guidelines

## Project Structure & Module Organization
This is an Electron app with static HTML/CSS/JS.
- `html/`: page templates (e.g., `01_index.html`, `03_main.html`) and shared snippets in `html/partials/`.
- `js/`: app logic, including Electron main process in `js/main.js` and DB access in `js/db.js`.
- `style/`: page-level and shared styles.
- Root config: `package.json`, `.env` (local config), and `README.md`.

## Build, Test, and Development Commands
Use the npm scripts defined in `package.json`:
- `npm install`: install dependencies.
- `npm start`: run the Electron app locally (uses UTF-8 code page on Windows).
- `npm run build`: package the app with electron-builder.
- `npm run test:db`: runs `scripts/test-db.js` (script path is referenced in `package.json`; ensure the file exists before relying on it).

## Coding Style & Naming Conventions
- Indentation and style should follow existing files in `html/`, `js/`, and `style/`.
- Naming patterns are page-based: `renderer-*.js`, `*-style.css`, and numbered HTML pages.
- A formatter is configured for this repo; run it before committing and keep changes consistent with nearby code.

## Testing Guidelines
There is no test framework configured in the repo. If you add tests, document:
- Framework choice (e.g., Jest) and how to run it.
- Naming pattern (e.g., `*.test.js`) and location (e.g., `tests/`).

## Commit & Pull Request Guidelines
Recent commit messages are short, descriptive, and written in Korean (no strict prefixing). Follow that pattern:
- Example: concise summary of the change in one line.
For pull requests, include:
- A clear description of behavior changes.
- Steps to verify (commands or UI path).
- Screenshots for UI changes.

## Security & Configuration Tips
Local configuration is stored in `.env`. Do not commit secrets.
DB connection settings live in `js/db.js`; update carefully and document any schema or query changes.
