# Groundbnb

Greenfield Groundbnb route planner. The current site is a holding page while the product implementation starts at M0.

The Project Control Center is maintained separately at [finallyaiagency/project-control-center](https://github.com/finallyaiagency/project-control-center).

## Start

Use Node.js 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The holding page runs at `http://localhost:3000`.

## Checks

```sh
pnpm state:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Start with [docs/STATE.md](docs/STATE.md) for the current milestone and blockers. The frozen product specification is in `docs/source/`; `docs/ledger.csv` is the requirement status authority. No Groundbnb product requirement has been verified yet.
