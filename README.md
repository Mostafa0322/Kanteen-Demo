# Kanteen — cashless school canteen (clickable demo)

> ⚠️ **Demo only — not real money.** No real payments, NFC, authentication or production security.

Students pay at the canteen by tapping a bracelet. Parents top up, set a daily limit and block items/allergens from a mobile app. Schools track income and manage students from a dashboard. All three are connected and update live, side by side.

| Route | What it is |
|---|---|
| `/` | Landing page with links to everything |
| `/demo` | **Split screen**: parent app + POS + dashboard in one window, plus the Demo panel |
| `/parent` | Parent mobile app (shown inside a phone frame on desktop) |
| `/pos` | Canteen terminal simulator |
| `/school` | School dashboard |

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

No backend, database or API keys are needed. `npm run build` type-checks and produces a static bundle in `dist/`.

## Demo script

Open **`/demo`** (or open `/parent`, `/pos` and `/school` in separate tabs/windows side by side). Click **Demo mode** (bottom corner, or docked on the right on very wide screens) and either press **Run full demo script** or run each step:

1. **Parent tops up 200 EGP.** Mona Hassan tops up her son Omar's wallet by card. The balance changes in the parent app and the top-up appears on the dashboard.
2. **Parent blocks nuts, POS sale blocked.** Nuts are added to Omar's allergy profile. The POS tries to sell a *Peanut Butter Cookie* and shows a red **BLOCKED** screen naming the item and the allergen. The parent gets a "Purchase blocked" notification.
3. **Daily limit 50 EGP, second purchase declined.** A Koshari Bowl (45) is approved. Potato Chips (15) would take the day to 60, so the POS shows **DECLINED: daily limit reached**.
4. **Dashboard in real time.** Today's sales, top-ups, the blocked attempt and the declined attempt are already on the dashboard overview and in its live feed.

**Reset scenario** clears Omar's limit, nut block and freeze so you can run the script again. **Reset all data** re-seeds everything. **Simulated network** switches API latency between instant, normal and slow so you can show loading states.

### Doing it by hand

- **Parent**: sign in with any demo account (password: anything), for example `mona@demo.kanteen`, who has two children. Use *Top up*, *Controls* (limit, allergies, blocked categories/items, freeze, low-balance alert), *Activity* (filters, receipts, notifications) and *Menu* (what's blocked and why, plus a per-item block).
- **POS**: tap menu items, choose a bracelet in the reader dropdown and press **Tap bracelet**. To show each outcome:
  - *Approved*: any student with enough balance.
  - *Blocked (allergy)*: Laila Hassan (dairy) with Fruit Yogurt.
  - *Blocked (parent restriction)*: Youssef Adel (desserts blocked) with any dessert.
  - *Insufficient balance*: a large cart.
  - *Daily limit*: Laila (60/day) with a few meals.
  - *Frozen*: freeze the bracelet in the parent app first.
  - *Deactivated*: replace a bracelet on the dashboard, then tap the old one.
  - **Offline mode**: toggle *Online → Offline*. Charges are authorised against a cached snapshot and queued. *Reconnect & sync* replays them through the API, which re-checks every rule and reports any conflicts.
- **School**: overview, students (search, assign a bracelet, lost-bracelet replacement with balance carry-over), transactions (date/vendor/type/status/search filters, CSV export), daily closing report (float reconciliation, print, CSV), menu management, refunds with an audit log, weekly reports, and currency settings.

**Language**: the toggle switches English/Arabic with full RTL across all apps (and all open tabs). Currency defaults to EGP and can be changed in *School → Settings*.

## Architecture

```
src/
  mock-api/          ← the only data layer the UI talks to
    types.ts         domain model + API request/response shapes
    api.ts           async API facade (swap for HTTP calls later)
    engine.ts        pure payment rules (also used by the offline POS)
    store.ts         in-memory DB, localStorage persistence, BroadcastChannel sync
    seed.ts          deterministic seed: 2 schools, 60 students, 3 parents, 26 items, 3 weeks of history
    dates.ts         local-time day helpers (Sun–Thu school week)
  i18n/              en/ar dictionaries (Arabic is type-checked for completeness), RTL, Intl formatting
  ui/                design system: Button, Card, Badge, Form controls, Modal, Toast, states, meters
  components/        shared domain pieces (transaction rows, reason text, Demo panel, logo)
  demo/script.ts     the 4-step scripted demo, written against the public API
  apps/
    parent/          mobile app (login, child picker, home, top-up, controls, activity, menu)
    pos/             terminal, result screen, offline queue
    school/          dashboard pages + charts
    demo/            split-screen view
    landing/
```

- **Swappable backend.** Screens only call `api.*` from `@/mock-api`. Every call is async and returns plain JSON, so a real HTTP client with the same signatures can replace `api.ts`. `api.subscribe` stands in for a websocket/SSE feed.
- **Live sync.** Every write goes to localStorage and is broadcast on a `BroadcastChannel` together with the new snapshot. Tabs and same-origin iframes apply it immediately; timestamps keep an older snapshot from overwriting a newer one. The snapshot travels in the message because localStorage replicates between browser processes asynchronously, and re-reading it on receipt can return stale data.
- **Rules engine.** `evaluateCharge` checks, in order: bracelet valid → not frozen → items available → allergy / item / category blocks → balance → daily limit. Blocked and declined attempts are stored as transactions, so they show up in history, reports and the closing report, and they notify the parent.
- **Offline POS.** A terminal keeps a cached snapshot while online. While offline it authorises locally, deducts from the snapshot and queues only *approved* charges, so nobody is charged for food they didn't receive. On reconnect each queued charge is replayed with its original timestamp and re-validated by the API.

## Notes and limitations

- All data lives in your browser's localStorage (key `kanteen.db.v3`). Clearing site data or using *Reset all data* re-seeds it. Seed dates are generated relative to "now", so there is always three weeks of history ending today.
- Two tabs writing at the same instant resolve last-write-wins. That's fine for a demo and is the main thing a real backend would replace.
- Authentication, payments, card handling and NFC are simulated. Test card `4000 0000 0000 0002`, or the *Simulate a failed payment* switch, shows the failure path.
