# Chapter & Co.

Complete guest bookstore for IU Getting Started in Web Programming, Task 2.
Twelve fictional books, original SVG covers, responsive catalogue and details,
search/filter/sort, persistent cart and transactional simulated checkout.

## Run

Install Python 3.11+ with SQLite support. Extract the ZIP and open a terminal in
`chapter-co`. On Windows run `py app.py` (or `python app.py`). On macOS/Linux run
`python3 app.py`. Open **http://127.0.0.1:8000**. Stop with Ctrl+C.
No application packages, credentials or external services are needed.
Do not open index.html directly. `python app.py --port 8001` uses another port.

First start creates `data/shop.sqlite3` from `sql/schema.sql` and `sql/seed.sql`.
Restarting preserves carts, stock and orders. To reset a disposable demo, stop the
server, delete only `data/shop.sqlite3` and restart. This erases local orders and
stock changes. The source ZIP includes no customer database.

## Try it

Search `Mira`, filter Nature, sort by price. Open The Quiet Atlas and add twice.
The bag has one row, quantity 2, EUR 37.80. Update quantity or remove it.
Checkout with fictional details: Demo Reader, reader@example.test, 12 Fiction Lane,
12345, Sample Town. Acknowledge the simulation and place the order. Confirmation
shows a generated ID and item snapshots. No payment/delivery takes place.
Lines and Light deliberately has zero stock. No login or password is required.

## Stack and files

HTML5, CSS, ES-module JavaScript, Python standard-library WSGI and SQLite.

| Path | Purpose |
| --- | --- |
| app.py | Routing, session/CSRF validation, cart and checkout |
| db.py | SQLite connection and schema/seed initialization |
| static/ | Browser UI and original SVG covers |
| sql/ | Reproducible schema and twelve seed products |
| tests/test_shop.py | 24 database-backed integration tests |
| docs/ | Architecture, requirements, test report and reflection journal |
| tools/ | Original asset generation, order inspection and repository link update |

Hash routes include #product/1, #cart, #checkout. Fetch sends JSON and updates the
DOM and badge without full page reloads. An opaque HttpOnly SameSite cookie
identifies the guest. Cart contents live in SQLite. Prices are integer euro cents.

## API

| Method/path | Purpose |
| --- | --- |
| GET /api/session | Session and CSRF token |
| GET /api/products?q=&category= | Catalogue and categories |
| GET /api/products/{id} | Product details |
| GET /api/cart | Items, quantities, count and totals |
| POST /api/cart | JSON product_id and quantity, repeated adds merge |
| PATCH /api/cart/{id} | JSON quantity, integer 1-99 subject to stock |
| DELETE /api/cart/{id} | Remove that guest's row |
| POST /api/checkout | Customer fields, acknowledgment, idempotency key |
| GET /api/orders/{id} | Order restricted to its owning session |

Mutations need X-CSRF-Token. Errors return JSON with an error message and a
400/403/404/409/413/415 status. SQL is parameterized. Text is escaped. Checkout
reads current prices/stock and atomically writes order/items, decrements stock and
clears the cart. Its unique session/idempotency key protects repeat requests.
Foreign keys and quantity/price constraints protect data integrity.

## Verify

Run `python -m unittest discover -s tests -v` from the project folder. Tests use
isolated temporary databases. See docs/TEST_REPORT.md and BROWSER_CHECKLIST.md.
`python tools/inspect_orders.py` prints stored order items without contact details.

This localhost development server is for assessment. Public deployment would need
HTTPS, a production WSGI server, abuse controls and privacy/retention handling.
COOKIE_SECURE=1 enables Secure cookies for HTTPS. Sessions expire after seven days.
Clearing cookies starts a new cart and loses browser access to old confirmations.
Expired DB rows are not automatically purged. Cart items do not reserve stock.

## Portfolio and GitHub

GitHubLink.txt remains marked pending until an actual repository exists. Create a
repo in your account, upload source, verify examiner access and put its actual URL
in that file and on slide 1. Do not submit the pending file or invent a URL.
`python tools/set_repository.py https://github.com/OWNER/REPO` updates the link file.
The accompanying Git bundle preserves actual build commits, not academic submissions.

The portfolio archive contains the concept, short Phase 2 text, nine-slide PPTX,
two-page abstract, source ZIP and supporting records. Follow the required Phase 1,
Phase 2, Phase 3 submission order and save each submitted version separately.
Check your name/student details, personalize reflection with your actual learning,
and record genuine tutor feedback. See docs/SUBMISSION_GUIDE.md and RESOURCES.md.
