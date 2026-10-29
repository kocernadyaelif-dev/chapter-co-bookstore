# Project abstract

## Introduction and objective

Chapter & Co. is a guest bookstore prototype for Task 2 of the web programming portfolio. The objective is a working shopping journey that combines client-side interaction, server-side logic and a database. Twelve fictional books provide a controlled demonstration dataset across Fiction, Nature, Design and Travel. The core path covers the catalogue, a product detail view, an editable cart, guest checkout and stored order confirmation. Search, genre filtering and price sorting support browsing. Real payments, accounts and administration are outside the chosen scope.

The success criterion is a complete simulated order whose items and total remain available after the application restarts. A responsive layout, visible feedback and clear empty states support use on desktop and mobile. Fictional contact information keeps the demonstration separate from actual transactions.

## Methods and implementation

The frontend uses semantic HTML, responsive CSS and vanilla JavaScript modules. Fetch exchanges JSON with a Python WSGI API. The add action updates the bag badge and displays feedback without a full-page reload. Hash routes select the catalogue, detail, cart, checkout and confirmation views. SQLite stores products, guest sessions, cart rows, orders and order items. This standard-library stack keeps setup simple and makes the request and persistence boundaries explicit.

An opaque HttpOnly, SameSite cookie identifies a guest session. Each cart row links that session to a product and quantity. Repeated additions merge into the same row. The server reads prices from SQLite and calculates totals in integer euro cents. At checkout, it validates customer fields, verifies the simulation acknowledgment and rechecks stock. One transaction writes the order and price/title snapshots, reduces stock and clears the cart. A unique checkout key makes retries return the existing order. Parameterized SQL, CSRF verification, escaped browser text and a same-origin content policy provide basic safeguards.

Git records the scaffold, backend, browser interface and verification milestones. The source package contains reproducible SQL scripts, original SVG covers, run instructions and a requirement-to-evidence matrix.

## Results and verification

The implemented prototype supports the planned journey and stores the result in a relational database. The catalogue contains twelve products, including one unavailable title to demonstrate the stock state. In the verification example, adding The Quiet Atlas twice produces one cart row with quantity two and a total of EUR 37.80. Successful checkout generates an order ID, stores item snapshots and clears the bag. Reloading the confirmation retrieves the stored order for the owning session.

All 24 database-backed integration tests passed. They cover catalogue queries, duplicate additions, quantity changes, removal, invalid input, empty checkout, guest isolation, forged client prices and order ownership. Additional cases verify persistence after restart, preserved price snapshots, rollback when stock changes, idempotent retries and competing purchases of the final copy. Browser checks exercise the interactive flow and responsive views. This evidence supports the prototype requirements, rather than a claim of production readiness or large-scale performance.

## Reflection on the approach

The central design challenge is keeping state consistent across the browser and database. A stored cart makes the server responsible for quantities, while checkout treats the order, stock reduction and cart clearing as one unit. The transaction and retry tests make that responsibility observable. Another review finding was that oversized product IDs could exceed SQLite binding limits. Explicit bounds now convert that case into a client error.

The limited scope supports a finished end-to-end flow. Accounts and payments would introduce concerns beyond the objective. Original covers and seeded data keep the project reproducible. The implementation demonstrates how interface feedback and server checks complement one another. A future iteration could compare this approach with a framework and evaluate whether its added structure justifies more setup.

## Conclusion and future work

The prototype meets the core objective with persistent orders and a usable guest journey. Future work includes accounts, administration and wider accessibility testing. Public hosting requires HTTPS, a production server and privacy controls. The academic process still requires the repository link, sequential submissions and genuine feedback.

