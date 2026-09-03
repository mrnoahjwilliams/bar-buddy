# Definition

## Purpose

**Bar Buddy** is a personal-first, multi-user home-bar app for answering: **What do I have? What can I make? What should I buy? What have I made, and how much remains? What do I like? What should I drink?** Each user's data is isolated from the beginning.

The initial product is a mobile-friendly web app/PWA with Home, Bar, Drinks, and More. Release 1 is independently publishable; Releases 2–7 add exploration, shopping, history, quantities, personalization, and explainable recommendations. [Requirements](02-requirements.md) defines the obligations; [Plan](06-plan.md) sequences implementation.

## Terms

| Term | Meaning |
|---|---|
| Ingredient | Curated canonical ingredient such as Bourbon, Lime Juice, Campari, or Angostura bitters; not a commercial bottle/SKU catalog. Brands can be canonical when they function as standard recipe ingredients. |
| Inventory item | A user's physical or conceptual bar item mapped to an ingredient, optionally labeled “Buffalo Trace”; multiple bottles may satisfy Bourbon. |
| Cocktail / recipe | The conceptual drink / one specific way to make it. Keep them separate so a cocktail can have variations. |
| Recipe ingredient | An ingredient's quantity, unit, requirement type, and display position in a recipe. |
| Availability | A calculated result from the selected recipe and current inventory. |
| Out / Wishlist | A deliberately tracked depleted item / a desired acquisition. Neither counts as available; unowned catalog items are not automatically Out. |
| One Ingredient Away | Exactly one distinct required ingredient is unavailable; optional garnishes do not count. |
| Made This Drink | Records a prepared cocktail and, from Release 5, deducts tracked quantities. |
| Menu | A named, ordered saved cocktail collection with calculated ingredient needs and availability. |

## Boundaries

Release 0 prepares the environment and catalog; it is not a public release. Releases 1–7 contain all planned features, with their assignments in Requirements and executable work in Plan. There is no separate unscheduled feature backlog.

Use curated, manageable ingredient and cocktail catalogs. System content is shared and read-only to normal users; private custom content arrives in Release 6. The app owns its domain behavior, business logic, authorization, API, and data access. Managed services provide commodity infrastructure. Offline AI-assisted catalog preparation requires human review; recommendations through Release 7 do not depend on user-facing AI.

Someday scope remains deferred: **8** party guests, QR menus, requests and guest ratings; **9** barcode/photo input; **10** AI bartender, substitutions and recipes; **11** AI party quantities and shopping/crowd optimization; **12** commerce and affiliate integrations. Exhaustive bottle/cocktail coverage, public sharing of custom content, and native packaging are not scheduled. Avoid obvious architectural dead ends without implementing these early.
