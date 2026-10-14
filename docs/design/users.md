# Users of BiteStream

Real login is out of scope. A **role switch** and an **actor picker** in the header let a demo user act as any customer or as the restaurant manager / operations view.

## 1. Customer (e.g. "Maya Patel")

Someone ordering food and paying from a prepaid BiteStream wallet.

| Wants to… | Screen |
|---|---|
| Find a restaurant and look at its menu and reviews before ordering | Browse → Restaurant detail, Reviews & Menu |
| Place an order and immediately see how much was deducted from the wallet | Place Order |
| Understand why an order was refused (not enough money, or an order is already on its way) | Place Order (error panel) |
| Check every debit and credit on the wallet over a period, with the balance after each change | Wallet History |
| Track the current order (PREPARING → DELIVERING → DELIVERED) | My Orders / Order detail |

Pain points: surprise charges, unclear failures, not knowing whether a payment went through.

## 2. Restaurant manager (e.g. "Ravi Kumar, Spice Garden 214")

Runs one restaurant and wants to know how it is performing.

| Wants to… | Screen |
|---|---|
| See revenue trend smoothed over a week (7-day moving average) | Analytics |
| See where the restaurant ranks against others | Analytics → ranking table |
| See headline totals (completed revenue, completed orders) and refresh them | Analytics → summary cards |
| Know what customers say: rating spread, most common tags, average | Reviews & Menu |
| Check the menu as customers see it | Reviews & Menu |
| Move an order forward (PREPARING → DELIVERING → DELIVERED) | Orders → "Advance status" |

## 3. Operations / dispatch (secondary, can be the same person as the manager in the demo)

| Wants to… | Screen |
|---|---|
| See active drivers within 5 km of a restaurant, nearest first, updating live | Driver Map |
| Browse all users, restaurants and orders to investigate an issue | Browse |
