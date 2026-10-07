# Big Boss Digital Command Center

A futuristic, dark-mode control room for running a Big Boss style house: contestants, tasks, scores, nominations, immunity, evictions, scheduled events and live analytics. Built for a tech event competition.

**Stack:** Next.js 14 (App Router), React 18, Tailwind CSS 3, `lucide-react` icons, `recharts` charts.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For a production check:

```bash
npm run build
npm start
```

## Features

| Area | What it does |
| --- | --- |
| Contestants | 9 housemates split evenly across Team Alpha, Beta and Gamma. Each has name, team, points, status (Active/Evicted), role (Captain/Housemate) and immunity. |
| Live leaderboard | Active contestants ranked by points, re-sorted instantly. |
| Point system | +5 / -5 buttons per contestant (points never go below 0). |
| Captaincy | One House Captain at a time. Assigning a new captain removes the old one. |
| Nominations | Nominate or un-nominate contestants for eviction. |
| Immunity | Grant or revoke immunity. Immune contestants cannot be nominated (button disabled), and granting immunity clears an existing nomination. |
| Danger Zone | Dedicated panel listing everyone currently nominated, with an Evict button. |
| Eviction | Removes the contestant from the house and leaderboard and moves them to the Evicted list. |
| Tasks | Assign tasks to active contestants and mark them complete or reopen them. |
| Task timer | Countdown with Start, Pause and Reset, a progress bar and a "Time's up" alert. |
| Big Boss announcement | Text input that triggers a full-screen announcement overlay. |
| House statistics | Highest scorer, tasks completed, total nominees and active/evicted count. |
| Event management | Schedule events (title, description, type, time). When the time arrives, a notification fires automatically. |
| Event notifications | Toast system for announcements and critical alerts such as "X Evicted!". |
| Performance analytics | Points per housemate, task completion, team total and average points, team trend over time, and a trend chip per team. |
| Activity log | Scrolling feed that timestamps every action. |
| Role-based access | Three roles with strict hiding of restricted controls (see below). |
| Persistence | All state is saved to `localStorage` and restored on refresh. |

## Roles and permissions

Switch roles with the toggle at the top of the screen. Restricted controls are **not rendered at all** for roles that lack permission, and the state layer also ignores actions a role is not allowed to perform.

| Capability | Big Boss (admin) | Task Master (moderator) | Viewer |
| --- | :---: | :---: | :---: |
| See dashboard, leaderboard, charts, log, events | Yes | Yes | Yes |
| Adjust points | Yes | Yes | No |
| Assign and complete tasks | Yes | Yes | No |
| Use task timer | Yes | Yes | No |
| Captain, immunity, nominate | Yes | No | No |
| Evict and see the Danger Zone | Yes | No | No |
| Send announcements | Yes | No | No |
| Create or cancel events | Yes | No | No |
| Reset the house | Yes | No | No |

To change what a role can do, edit the `PERMS` table in `app/page.jsx`.

## Project structure

```
app/
  globals.css   Tailwind layers, neon grid background, animations
  layout.jsx    Root layout and metadata
  page.jsx      State (reducer + context), permissions and all components
package.json
tailwind.config.js
postcss.config.js
FIXES.md        Change notes for the judge-feedback upgrades
```

## How state works

- One `useReducer` lives inside a Context provider in `app/page.jsx`.
- Every state change writes to `localStorage` under the key `bigboss-v2`, except toasts and the announcement overlay.
- The timer always restores as paused after a refresh.
- Every action that changes the house adds a timestamped line to the activity log.

To start fresh, use **Reset house** (Big Boss only) or clear `bigboss-v2` in the browser's localStorage.

## Suggested demo flow

1. Add points to a few contestants and watch the leaderboard and charts update.
2. Make someone Captain, then make someone else Captain to show only one holds the role.
3. Nominate two contestants, then grant one immunity and show their Nominate button is disabled.
4. Evict the other nominee and point out the toast, the activity log and the Evicted list.
5. Send an announcement and show the overlay.
6. Start, pause and reset the timer.
7. Schedule an event a minute ahead and wait for its notification.
8. Switch to Task Master, then Viewer, to show controls disappearing.
9. Refresh the page to show everything persisted.

## Troubleshooting

- **Old data showing after an update:** clear localStorage for the site, or click Reset house.
- **Charts not showing:** charts render after the page mounts, so wait a moment after load.
- **Port in use:** run `npm run dev -- -p 3001`.
