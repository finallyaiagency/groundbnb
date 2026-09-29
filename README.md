# Groundbnb

Greenfield Groundbnb rebuild. The first deliverable is the Project Control Center, a read-only dashboard backed by versioned project evidence. Groundbnb product implementation begins at M0 after the Control Center gate.

## Start

Use Node.js 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The dashboard runs at `http://localhost:3000`.

## Checks

```sh
pnpm state:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Start with [docs/STATE.md](docs/STATE.md) for the current milestone and blockers. The frozen source specification is in `docs/source/`; `docs/ledger.csv` is the requirement status authority. `docs/tasks/` contains bounded execution packets. Do not treat a build or mock as proof of a live product requirement.
