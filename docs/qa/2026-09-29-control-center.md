# Control Center foundation verification — 2026-09-29

Application revision: `30657f7e85f5c46b5b73f025b50209233700adc0`. Preview deployment: `dpl_2ocV1u7rY6BUNr1gNHHx7SBLU2er` at `https://groundbnb-qon2vkcjj-finally-ais-projects.vercel.app` (Vercel Ready, Next.js 16.3.6). These checks cover the read-only Project Control Center foundation, not Groundbnb product requirements or live integrations.

| Run | Check | Result | Evidence / limit |
| --- | --- | --- | --- |
| QA-001 | `node scripts/check-project-state.mjs` | Passed | 249 unique IDs, frozen source SHA-256 matched. |
| QA-002 | `node --test tests/forecast.test.ts` | Passed | 3 forecast tests, 0 failures. |
| QA-003 | `tsc --noEmit` and `eslint app components lib scripts tests` | Passed | No diagnostics after package-policy repair. |
| QA-004 | Local `next build` and Vercel build | Passed | Dynamic `/` and `/[view]` routes compiled; Vercel build completed. The two earlier failed Vercel attempts are retained in deployment history. |
| QA-005 | Live preview navigation and requirement search | Passed | Overview shows revision `30657f7e`, 249 IDs, 0 falsely verified. `/requirements?q=SYS-14` returned one row. Entering `SYS-13` and pressing Enter returned one matching row with the correct source link. No browser console errors observed in the checked pages. |
| QA-006 | Responsive layout at 390×844, 768×1024, 1440×900 | Passed | Browser DOM widths stayed within viewport (scroll width 390, 753, 1425 respectively); main content and cards reflowed. In-app browser viewport screenshots used an internal scaling crop, so visual judgment was based on default-size screenshot plus DOM geometry at the three breakpoints. This is a layout smoke check, not a full accessibility audit. |

No durable client submission, Neon schema, live provider call, production release, or Groundbnb product acceptance was verified. GitHub Actions status is tracked separately from these local and preview checks.
