# Team 26 — Work Split for Assignment 2 (BiteStream front end)

**Team repo:** https://github.com/MohitT130/SSD_2 (branch `main`; contains the full `team10_a1` commit history, as the PDF requires)

```
git clone https://github.com/MohitT130/SSD_2.git
cd SSD_2
git checkout -b <your-name>/<feature>   # e.g. sai/map
```

| Member | Role | PRD |
|---|---|---|
| **Nisarg Bhojani** | Designer: all Figma work, design system, visual QA, demo video | [PRD_Nisarg_Design.md](PRD_Nisarg_Design.md) |
| **Mohit Tripathi** | Front end + API for **Browse, Transaction, Audit**; owns the project scaffold | [PRD_Mohit_Browse_Transaction_Audit.md](PRD_Mohit_Browse_Transaction_Audit.md) |
| **Kodavali Sai** | Front end + API for **Analytics, Map, Reviews + Menus** | [PRD_Sai_Analytics_Map_Reviews.md](PRD_Sai_Analytics_Map_Reviews.md) |

The 4th member on the allocation sheet (Jyotiraditya Kumar) is no longer at the college. We state this in the README contribution table.

## Screen ownership (from the PDF's Project mapping, P1 BiteStream)

| # | Screen | What it must show | Owner |
|---|---|---|---|
| 1 | Browse | users, restaurants, orders | Mohit |
| 2 | Transaction | place order (Workflow 1) | Mohit |
| 3 | Audit | wallet (`wallet_audit_logs`) | Mohit |
| 4 | Analytics | per restaurant (Workflow 2 + materialized view) | Sai |
| 5 | Map | nearest driver to restaurant (Workflow 3) | Sai |
| 6 | Reviews + catalog | Reviews + Menus (Workflow 4) | Sai |
| – | Look and feel of all 6 screens, wireframes, Figma | – | Nisarg |

## Stack (all free, no API keys, no card)

React + Vite · Mantine (UI, charts, dates) · TanStack Query · React Router · Leaflet + OpenStreetMap · Node.js + Express · `pg` + `mongodb` drivers · Vitest + Supertest · Figma (free/education plan) · OBS Studio → YouTube unlisted.

## Rules that stop us blocking each other

1. **The API contract is [docs/api_endpoints.md](../api_endpoints.md).** If you need to change an endpoint, change that file first and tell the others.
2. **Each person owns separate folders**, so merges don't conflict:

   | Path | Owner |
   |---|---|
   | `api/src/app.js`, `api/src/db/*`, `api/src/errors.js`, `web/` scaffold, `web/src/api/client.js` | Mohit (scaffold, first hour) |
   | `api/src/routes/{users,restaurants,orders,checkout,audit}.js`, `web/src/pages/{browse,transaction,audit}/` | Mohit |
   | `api/src/routes/{analytics,map,reviews,menus}.js`, `web/src/pages/{analytics,map,reviews}/` | Sai |
   | `web/src/theme.js`, `web/src/components/*` (shared UI), `docs/design/*` | Nisarg |
   | `sql/04_*`, `sql/07_fixes_transactions.sql`, `data_generation/postgres_seeder.py` | Mohit |
   | `sql/05_*`, `sql/06_*`, `mongo/*`, `data_generation/mongo_seeder.py`, `data_generation/ping_simulator.py` | Sai |
   | `README.md` sections | split, see each PRD |

3. Push to https://github.com/MohitT130/SSD_2 only. Mohit adds Nisarg and Sai as collaborators (Settings → Collaborators). Work on a branch per person (`mohit/…`, `sai/…`, `nisarg/…`) and open small PRs into `main`. Merge at every checkpoint below.
4. Every screen uses the shared `LoadingState`, `EmptyState` and `ErrorState` components, so no screen is ever blank.

## Timeline (due 15 Oct 2026; −10% per day late)

`H0` = the moment we start.

| When | Nisarg | Mohit | Sai |
|---|---|---|---|
| H0–H1 | Figma file set up, colour and type tokens | API + web scaffold pushed to `main` | Mongo seeder and SQL fixes |
| **H1 checkpoint** | Tokens shared as `theme.js` | Scaffold merged; everyone runs `npm run dev` | — |
| H1–H3 | Wireframes for all 6 screens (desktop + phone) | Fix checkout procedure, seeder, Browse endpoints and screen | Analytics endpoints, MV and window functions |
| **H3 checkpoint** | Wireframes exported to `docs/design/` | Browse works end-to-end | Analytics chart renders |
| H3–H6 | Hi-fi mockups + shared components in code | Transaction + Audit screens | Map + Reviews screens |
| **H6 checkpoint** | Visual QA pass on running app | All 3 screens wired | All 3 screens wired |
| H6–H8 | Screenshots, demo script | Tests, README setup | Tests, README assumptions |
| H8–H9 | **Record demo video (≤ 5 min)** | Final commit hash in README, ZIP | Fresh-clone run-through |

## Everyone, before the viva (25 marks)

Any of us can be asked about **any** part, including the inherited SQL and Mongo code. Each person should be able to explain:

- the partial unique index
- the wallet trigger
- why the original checkout procedure failed
- `DENSE_RANK()` and the 7-day window frame
- `REFRESH … CONCURRENTLY`
- `$geoNear` and the 2dsphere/TTL indexes
- `$facet`
