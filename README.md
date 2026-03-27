# gaffr
gaffr pulls live data from the official Fantasy Premier League API and external news sources to surface actionable insights — fixture analysis, player form tracking, transfer suggestions, captaincy recommendations, chip strategy, and deadline countdowns — all in one place.

## Tech Stack

- Expo 55 / React Native 0.83
- TypeScript 5.9
- React Navigation (bottom tabs with swipe)
- AsyncStorage for offline caching
- Jest + fast-check for unit and property-based testing

## Getting Started

```bash
git clone <repo-url>
npm install
npm start
```

Scan the QR code with Expo Go, or press `a` for Android / `i` for iOS.

## Scripts

| Command           | What it does                      |
|-------------------|-----------------------------------|
| `npm start`       | Start the Expo dev server         |
| `npm run android` | Launch on Android emulator/device |
| `npm run ios`     | Launch on iOS simulator/device    |
| `npm run web`     | Launch in browser                 |
| `npm test`        | Run the test suite                |

## Screens

**HOME** — Dashboard with deadline countdown, budget/FT/chips stat trio, starting XI with status indicators, bench order warnings, team overlap alerts, and a prioritised news feed.

**FIX** — Fixture difficulty grid with per-team schedule view, FDR colour coding, and BGW/DGW detection.

**SQUAD** — Two modes. Players view: form-ranked player list with position and price filters, 10-gameweek breakdown on tap. Transfers view: suggested outs/ins with projected points gain, hit calculator, price change alerts, and buy urgency targets.

**CHIPS** — Chip status and roadmap (recommended GW for each unused chip), captaincy picks with DGW/injury/rotation tags, bench order analysis, BGW/DGW squad impact planning, and mini-league standings.

## Architecture

```
src/
├── data/           API clients, data parser, local cache
├── domain/         Pure analytics functions (no side effects)
├── hooks/          React hooks bridging data → UI
├── models/         TypeScript interfaces
├── components/     Reusable UI components
├── screens/        Tab screen compositions
├── navigation/     Bottom tab navigator with swipe
├── notifications/  Deadline push reminders
└── theme/          Colours, typography, spacing, borders
```

Data flows in one direction:

```
FPL API → fplApiClient → dataParser → hooks (state + cache) → screens → domain functions
```

`useBootstrap` loads first (players, teams, gameweeks). `useFixtures` and `useNews` load in parallel. `useSquad` waits for bootstrap data, then fires three API calls in parallel (`/entry`, `/picks`, `/history`) and joins them with bootstrap player data to build the composite squad.

Every hook writes to AsyncStorage on success and falls back to cached data on network failure.

Domain modules are pure functions — no API calls, no state. They take data as parameters and return computed results: captaincy scores, chip recommendations, transfer suggestions, fixture analysis, price predictions, bench order checks, and more.

## Design System

Retro arcade aesthetic. Dark-only. Monospace-only (`Courier New`). No border-radius above 4px, no shadows, no gradients, no icon libraries. Status is communicated through coloured squares and text characters. Screen transitions are instant.

Colour palette is hardcoded: dark navy backgrounds, gold primary accent, neon green for positive states, red for alerts, purple for chip indicators.

## Testing

54 test files covering domain logic, hooks, and edge cases. Includes property-based tests via fast-check for fixture analysis, transfer calculations, and mini-league functions.

```bash
npm test
```

## License

GPL-2.0 — see [LICENSE](LICENSE) for details.
