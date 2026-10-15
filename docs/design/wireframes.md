# Wireframes (low fidelity)

Rendered wireframes, one PNG per screen, are in [wireframes/](wireframes/) (`01_browse.png` … `07_phone_layout.png`, drawn from [wireframes/wireframes.html](wireframes/wireframes.html)). The text sketches below were the first pass, written before any code.

## 0. Layout (every screen)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🍔 BiteStream     Role: [Customer ▾]   Acting as: [Maya Patel ▾]    │
│                   Wallet ₹4,550.00   ● Active order        ● API ok │
├───────────────┬──────────────────────────────────────────────────────┤
│ Browse        │                                                      │
│ Place Order   │                 page content                         │
│ Wallet History│                                                      │
│ Analytics     │                                                      │
│ Driver Map    │                                                      │
│ Reviews & Menu│                                                      │
└───────────────┴──────────────────────────────────────────────────────┘
Phone: sidebar → ☰ burger; actor picker moves into the burger menu.
```

## 1. Browse (tabs: Users | Restaurants | Orders)

```
[ Users ] [ Restaurants ] [ Orders ]
┌───────────────────────────────┐ Status: [All ▾]   Active only: [ ]
│ 🔍 Search by name…            │
└───────────────────────────────┘
┌──────────────┬──────────────────┬────────────┬────────────┬─────────┐
│ Order ID     │ Customer         │ Restaurant │   Amount   │ Status  │
├──────────────┼──────────────────┼────────────┼────────────┼─────────┤
│ 3f2a…        │ Maya Patel       │ Spice 214  │  ₹1,250.00 │[PREPAR.]│  ← click row
│ …            │ …                │ …          │        …   │ …       │
└──────────────┴──────────────────┴────────────┴────────────┴─────────┘
Showing 1–20 of 50,000          « ‹ 1 2 3 … 2500 › »

Detail drawer (right side):
┌ Order 3f2a… ─────────────────── ✕ ┐
│ Customer    Maya Patel           │
│ Restaurant  Spice Garden 214     │
│ Amount      ₹1,250.00            │
│ Status      [PREPARING]          │
│ Created     14 Oct 2026 15:02    │
│ [ Advance to DELIVERING → ]      │
└──────────────────────────────────┘
States: skeleton rows while loading · "No results for 'xyz'" · error card with Retry
```

## 2. Place Order (Workflow 1)

```
┌ Place an order ────────────────────┐  ┌ Wallet ───────────────────────┐
│ Customer   [Maya Patel ▾]          │  │ Before        ₹5,000.00       │
│ Restaurant [🔍 Spice Garden 214 ▾] │  │ After         ₹4,550.00  ▼450 │
│ Amount (₹) [ 450.00 ]              │  └───────────────────────────────┘
│                                    │
│ ⚠ Maya already has an active order │  ← shown before submitting
│   [View order]                     │
│            [ Place order ]         │
└────────────────────────────────────┘

SUCCESS                                   FAILURE
┌ ✅ Order placed ─────────────────────┐   ┌ ❌ Not enough money in wallet ───────┐
│ Order 9b1c… is PREPARING             │   │ Wallet has ₹120.00, order costs      │
│ New wallet_audit_logs row (trigger): │   │ ₹450.00. Nothing was charged.        │
│  DEBIT  ₹450.00  bal ₹4,550.00 15:03 │   │ Balance still ₹120.00                │
└──────────────────────────────────────┘   └──────────────────────────────────────┘
                                          ┌ ❌ An order is already in progress ──┐
                                          │ Only one PREPARING/DELIVERING order  │
                                          │ is allowed. [Advance that order]     │
                                          └──────────────────────────────────────┘
```

## 3. Wallet History (Audit trail)

```
User [Maya Patel ▾]   From [01 Oct 2026]  To [14 Oct 2026]   [Apply]
┌ Opening ₹5,000.00 ┐ ┌ Debits −₹2,100 ┐ ┌ Credits +₹650 ┐ ┌ Closing ₹3,550 ┐
┌──────────────────┬────────┬───────────┬───────────────┬─────────────────┐
│ Time             │ Action │ Amount    │ Balance after │ Running balance │
├──────────────────┼────────┼───────────┼───────────────┼─────────────────┤
│ 14 Oct 15:03     │ DEBIT  │ −₹450.00  │ ₹4,550.00     │ ₹4,550.00       │
│ 12 Oct 09:41     │ CREDIT │ +₹200.00  │ ₹5,000.00     │ ₹5,000.00       │
└──────────────────┴────────┴───────────┴───────────────┴─────────────────┘
Read-only. Paginated. Empty: "No wallet activity in this date range."
```

## 4. Analytics (Workflow 2 + materialized view)

```
┌ Completed revenue ┐ ┌ Completed orders ┐ ┌ Restaurants ┐ ┌ Avg / restaurant ┐
│ ₹2,04,51,300      │ │ 40,320           │ │ 500         │ │ ₹40,902          │
└───────────────────┘ └──────────────────┘ └─────────────┘ └──────────────────┘
Last refreshed: 14 Oct 2026 15:00:12         [⟳ Refresh materialized view]

┌ 7-day moving average revenue — [Spice Garden 214 ▾] ────────────────────┐
│ ₹  ▁▂▃▅▆▅▄▅▆▇  — daily revenue (bars)                                  │
│    ───────────  — 7-day moving average (line)                           │
│    15 Sep ………………………………………………… 14 Oct                                 │
└─────────────────────────────────────────────────────────────────────────┘

┌ Ranking (DENSE_RANK by latest 7-day avg) ─────────────────────────────┐
│ Rank │ Restaurant       │ Latest day │ Daily rev │ 7-day avg          │
│  1   │ Urban Bites 77   │ 14 Oct     │ ₹42,100   │ ₹31,450            │
│  2   │ Byte Cafe 310    │ 14 Oct     │ ₹38,900   │ ₹30,980            │
└──────┴──────────────────┴────────────┴───────────┴────────────────────┘  paginated
```

## 5. Driver Map (Workflow 3)

```
Origin: (•) Restaurant [Spice Garden 214 ▾]   ( ) Click on map
Radius: 5 km        Auto-refresh every 5 s ●  Last update 15:04:31
┌──────────────────────────────────────────┐ ┌ Nearest active drivers ──┐
│              ·  🚗                        │ │ 1. Driver #1     44 m    │
│        🚗   ( ◯ 5 km circle )             │ │ 2. Driver #812  310 m    │
│          🚗    🍴 origin    🚗            │ │ 3. Driver #77   690 m    │
│                    🚗                     │ │ …                        │
│   (OpenStreetMap tiles via Leaflet)      │ │ 20. Driver #5   4.8 km   │
└──────────────────────────────────────────┘ └──────────────────────────┘
Empty: "No active drivers within 5 km right now." Phone: list below map.
```

## 6. Reviews & Menu (Workflow 4)

```
Restaurant [All restaurants ▾]
┌ Average rating ┐ ┌ Rating distribution ───────┐ ┌ Top tags ───────────────┐
│   ★ 3.01       │ │ 5★ ████████ 10,021          │ │ tasty         ███████ │
│ 50,000 reviews │ │ 4★ ███████  9,980           │ │ fresh         ██████  │
└────────────────┘ │ 3★ ████████ 10,050  …       │ │ slow-delivery ████    │
                   └─────────────────────────────┘ └───────────────────────┘
┌ Menu — Spice Hub (updated 14 Oct) ──────────────────────────────────────┐
│ ▸ Main Course                                                           │
│     Paneer Biryani ........................................ ₹220        │
│        + Extra Paneer ₹50   + Extra Spicy ₹0                            │
│ ▸ Pizza                                                                 │
│     Veg Pizza ............................................. ₹250        │
└─────────────────────────────────────────────────────────────────────────┘
Empty: "This restaurant has no menu yet."
```
