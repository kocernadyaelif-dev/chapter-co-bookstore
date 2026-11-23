# Chapter & Co. - Phase 2 development and reflection

Repository: https://github.com/kocernadyaelif-dev/chapter-co-bookstore

## Scope and tutor feedback

The implementation follows the revised conception: twelve fictional books, catalogue/detail views,
title/author search, category filtering, price sorting, a persistent guest cart and simulated checkout.
Accounts, administration, real payments and delivery remain outside scope, as planned.

The guest path is catalogue -> detail -> session cart with AJAX badge -> guest checkout ->
server-calculated order -> confirmation. Cart data stays in SQLite and is identified by the guest cookie.

| Tutor requirement | Implementation | Evidence |
| --- | --- | --- |
| Catalogue and details | Database-backed product endpoints; hash routes in the browser | Browser scenarios; screenshots 01 and 02 |
| One cart row per session/product | Composite primary key; repeated additions increase quantity | Integration test `test_duplicate_add_merges_and_totals`; screenshot 03 |
| AJAX quantity badge | `writeCart()` sends JSON through Fetch; `updateBadge()` changes the DOM | Browser document marker remains unchanged during repeated additions |
| Guest checkout | Labelled customer fields and mandatory demo acknowledgment | Screenshot 04; validation integration tests |
| Prices only from server-side products | `cart_for()` joins products and computes integer-cent totals | Forged-price and changed-price integration tests |
| Stock checked/reduced at checkout | One transaction rechecks stock, saves order/items, reduces stock and clears cart | Rollback/concurrency integration tests; browser SQL checks |
| Stored confirmation | Session-restricted order retrieval with title/price/quantity snapshots | Screenshot 05; reload, ownership and persistence tests |
| Responsive UI | CSS Grid and media queries | 390 x 844 browser scenarios; screenshots 06-09 |

## Development journal - 23 November 2026

The public main branch already contained the main frontend, API and SQLite implementation when this
iteration began. Its 24 database-backed integration tests passed before this iteration. The existing
Git history starts with a complete prototype; no earlier staged development history is claimed here.

### Challenge: late responses changed the meaning of the visible add button

A deterministic browser test delayed the response for product 1, navigated to product 2, then released
the delayed response. Clicking the visible add button sent two POST requests: one for product 2 and
one for the previously viewed product 1. The response was prevented from rendering, but its event
handler was still attached to the newer form.

The detail route now checks the render version before attaching its handler. The regression test
verifies that only product 2 is posted and only that product appears in the cart.

### Challenge: navigation while cart writes were pending

Opening the bag immediately after Add, or entering checkout immediately after changing a quantity,
could request a cart before the write had finished. A late cart update could also redraw a newer view.
Cart writes now run in order through `writeCart()`. `readCart()` waits for pending writes, and ignores
a read if a newer write started meanwhile. Route-version guards prevent old responses or completed
cart edits from replacing a newly opened checkout form. Failed writes are handled without blocking
later valid edits. Tests delay requests to exercise these cases rather than relying on fast localhost
responses.

### Reproducible verification

The browser suite uses a temporary SQLite database and an OS-selected port. The server reports the
actual bound port, including when `--port 0` is used. Test cleanup closes the browser/server and
removes the temporary database. It does not connect to or modify a running personal demo.

Current results: 24 API/database integration tests passed; 9 browser scenarios passed. Browser checks
cover the complete journey, repeated additions, quantity edits, reload persistence, author search,
category filters, both price-sort directions, guest isolation, removal, stock/empty states, delayed
requests and mobile overflow. The checkout check also queries the test database directly to verify
the order, item quantity/unit price and cleared owner cart. See `browser-results.json` and
`browser-test-output.txt` for the recorded browser run.

No backend framework, database or authentication model was changed. The implementation remains
aligned with the conception; this iteration improves asynchronous correctness and verification.
These are implementation observations, not a substitute for the student's personal learning reflection.

## Current status and next steps

The planned guest journey is functional. The demonstrated example adds The Quiet Atlas twice,
producing one row with quantity 2 and EUR 37.80; checkout stores the order and clears the cart.
Use fictional customer details. The prototype does not process payments or ship books.

Next steps are tutor review of Phase 2, keyboard/screen-reader accessibility review and further
usability feedback. Accounts, administration and production hosting are future extensions rather than
unfinished requirements of this prototype. Public hosting would require HTTPS, a production WSGI
server and appropriate privacy/retention handling.

The Phase 2 presentation includes the repository link on its title slide, architecture/data diagrams,
real feature screenshots, stack/tools, the observed challenges and current status/next steps.
