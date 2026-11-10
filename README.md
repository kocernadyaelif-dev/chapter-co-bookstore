# Chapter & Co.

Chapter & Co. is a guest bookstore prototype for IU's **Project: Getting Started in Web Programming (DLBITPEWP01_E), Task 2: E-Commerce Site**. It demonstrates a complete shopping journey connecting an interactive browser interface, server-side processing and persistent relational storage.

The initial catalogue contains twelve fictional books across **Fiction, Nature, Design and Travel**, with original SVG covers.

**Repository:** https://github.com/kocernadyaelif-dev/chapter-co-bookstore

## Scope

Included features:

- Product catalogue and individual book details.
- Search by title or author, category filtering and price sorting.
- A guest cart stored on the server, identified by a session cookie.
- Add-to-cart feedback and an AJAX cart badge showing the total quantity of books.
- Quantity changes, item removal and server-calculated cart totals.
- Guest checkout with customer fields and explicit acknowledgment of the simulation.
- Stored orders, item snapshots and confirmation restricted to the owning session.
- Responsive layouts, shared navigation, empty-cart guidance and stock indicators.

**Outside scope:** registration, user accounts, administration, real payments and actual delivery. No login or password is required. Use fictional contact information during checkout.

## User journey and interface

The main path is **catalogue → product detail → session cart with AJAX badge → guest checkout → server-calculated order → confirmation**.

Adding a book sends its product ID and quantity to the server. The response updates the header badge and displays feedback without a full-page reload; the guest then opens the cart. Cart contents remain in SQLite rather than being copied between pages. The badge counts quantities, so two copies of one book produce a badge of 2 and one cart row.

The catalogue, detail, cart and checkout views share a header with navigation and the cart count. CSS Grid and media queries adapt the interface to smaller screens. Browser hash routes include `#catalog`, `#product/1`, `#cart`, `#checkout` and `#order/ORDER_ID`, where `ORDER_ID` is the generated order ID.

## Technologies

| Component | Technology and purpose |
| --- | --- |
| Frontend | HTML5, responsive CSS and vanilla JavaScript modules |
| Browser/server communication | Same-origin Fetch requests and JSON responses |
| Backend | Python standard-library WSGI routes and validation |
| Database | SQLite with foreign keys and constraints |
| Version control | Git and the repository linked above |

The application needs **Python 3.11+ with SQLite support**. No third-party Python packages, database server, credentials or external services are required to run it. `package.json` relates to optional browser verification and is not required for normal startup.

## Run locally

Extract the source ZIP or clone the repository, then open a terminal in the project folder containing `app.py`.

On Windows:

```cmd
python app.py
```

If the Windows Python launcher is installed, `py app.py` is also supported. On macOS/Linux:

```sh
python3 app.py
```

Open **http://127.0.0.1:8000** in a browser. Stop the server with **Ctrl+C**. The application must be opened through its server; do not open `static/index.html` directly.

To use another port:

```sh
python app.py --port 8001
```

Then open http://127.0.0.1:8001.

### Database initialization and persistence

The first start creates `data/shop.sqlite3` using `sql/schema.sql` and `sql/seed.sql`. Restarting preserves stored carts, stock and orders. Returning to an existing cart or confirmation also requires the same valid guest cookie.

To reset a disposable demo, stop the server, delete **only `data/shop.sqlite3`**, then restart. This deletes local orders, guest sessions and cart contents, and resets product data and stock to the seed values.

Optional environment settings:

| Variable | Behaviour |
| --- | --- |
| `SHOP_DB` | Overrides the database file path; the default is `data/shop.sqlite3` |
| `COOKIE_SECURE` | Setting it to `1` adds the Secure cookie flag for HTTPS; leave it unset for the default local HTTP demo |

## Data model and checkout rules

| Table | Responsibility |
| --- | --- |
| `products` | Book ID, title, author, category, description, cover path, `price_cents` and stock |
| `sessions` | Guest session token hash, CSRF token and creation time |
| `cart_items` | Session/product relationship and quantity; composite primary key `(session_id, product_id)` |
| `orders` | Order ID, owning session, checkout key, customer fields, total and creation time |
| `order_items` | Purchased products with title, unit-price and quantity snapshots |

The cart and checkout follow these rules:

1. **One cart row per session/product pair.** Adding the same product again increases the existing quantity. Quantities must be integers from 1 to 99, subject to available stock.
2. **Prices come only from `products` on the server.** The server calculates totals using integer euro cents. Browser-supplied prices or totals are ignored. Order items preserve the title and unit price recorded at checkout.
3. **Stock is checked at checkout.** Add and quantity-change requests also check stock, but placing books in a cart does not reserve or reduce it. Checkout rechecks all requested quantities against current stock.
4. **Successful checkout is atomic.** One database transaction stores the order and its items, reduces stock and clears the guest cart. If it fails, these changes are rolled back together.
5. **Retries do not create duplicate orders.** A unique `(session_id, idempotency_key)` identifies a checkout attempt. Reusing that key in the same session returns the existing order after a successful commit.

## Try the main flow

Start with an empty cart and seeded product data:

1. Open the catalogue and search for `Mira`. Clear the search, then filter by `Nature` and try both price-sort directions.
2. Reset the category to **All genres**, clear the search and open **The Quiet Atlas**.
3. Add one copy twice. The badge should show **2** without a full-page reload. Open the bag: it should contain one row with quantity **2** and total **EUR 37.80** at the seeded price.
4. Change the quantity to **3**: the total should become **EUR 56.70**. Reload the page to check persistence. Remove the book to see the empty-cart state.
5. Add two copies again and continue to checkout. Use fictional values such as **Demo Reader**, **reader@example.test**, **12 Fiction Lane**, **12345**, **Sample Town**.
6. Acknowledge the simulation and place the demo order. Confirmation should show a generated `CC-...` order ID and stored item details; the bag should be empty. Reloading confirmation should retrieve the order for the same valid guest session.

**Lines and Light** starts with zero stock to demonstrate the unavailable state. A separate private browser session should have its own empty cart and should not retrieve another guest's order. Successful demo purchases reduce stock, so the initial stock values change as the demo is used.

## API

| Method and path | Purpose |
| --- | --- |
| `GET /api/session` | Create or retrieve a guest session and return its CSRF token |
| `GET /api/products?q=&category=` | Query books by title/author and category; return categories |
| `GET /api/products/{id}` | Retrieve book details |
| `GET /api/cart` | Return the current guest's items, quantities, count and total |
| `POST /api/cart` | Add JSON `product_id` and `quantity`; merge repeated additions |
| `PATCH /api/cart/{id}` | Change a cart quantity |
| `DELETE /api/cart/{id}` | Remove an item from the current guest's cart |
| `POST /api/checkout` | Validate customer fields and demo acknowledgment; place or retrieve an idempotent order |
| `GET /api/orders/{id}` | Retrieve a stored order only for its owning guest session |

JSON request bodies use `Content-Type: application/json`. Mutations require `X-CSRF-Token`, obtained from `/api/session`. Validation and stock errors return JSON error messages with appropriate HTTP status codes. Price sorting is performed by the frontend on the returned catalogue results.

## Project files

| Path | Purpose |
| --- | --- |
| `app.py` | WSGI application, routes, validation, sessions, cart and checkout |
| `db.py` | SQLite connections, foreign-key settings and schema/seed initialization |
| `static/` | Browser interface, styles, JavaScript and SVG covers |
| `sql/` | Schema and twelve reproducible seed products |
| `tests/test_shop.py` | Database-backed API integration tests |
| `tests/browser_check.mjs` | Optional automated browser verification |
| `tools/` | Asset-generation and order-inspection helpers |
| `package.json` | Optional browser-test dependency and command |
| `.gitignore` | Excludes the local database, caches and dependency directories |

## Verification

From the project folder, run:

```sh
python -m unittest discover -s tests -v
```

Use `python3` instead of `python` where required. The suite contains 24 integration tests using isolated temporary databases. Cases cover duplicate additions, quantity edits, session isolation, forged client prices, order ownership, persistence, price snapshots, checkout rollback, idempotent retries and competing purchases of the last copy. Run the suite against the version being assessed to obtain its current result.

To inspect saved order items without printing customer contact details:

```sh
python tools/inspect_orders.py
```

## Safeguards and limitations

The server uses parameterized SQL, input validation, CSRF verification and session-restricted order retrieval. Browser text is escaped, and a same-origin Content Security Policy limits loaded resources. The session cookie is HttpOnly and SameSite=Lax.

Guest sessions expire seven days after creation. Clearing cookies starts a new guest session and removes that browser's access to previous carts and confirmations; it does not erase the stored order records. Expired database rows are not automatically purged.

This is a local development prototype with simulated orders. Public deployment would require HTTPS, a production WSGI server, abuse controls and a suitable privacy and retention policy. Keep generated databases and real personal information out of the source repository and distributable source ZIP.
