# Verification report

Executed 8 October 2026 against the delivered application source.

## Backend integration

Command: `python3 -m unittest discover -s tests -v`
Result: **24 tests passed**, using fresh temporary SQLite databases.

Coverage: catalogue/author/genre queries, literal wildcard search, missing and oversized
IDs, duplicate additions, quantity update/removal, invalid JSON quantities, stock limits,
guest isolation, CSRF on every mutation, cookie/security headers, empty checkout,
invalid customer fields, forged prices, committed order/items, stock reduction, cart
clearing, retry idempotency, restricted order access, restart persistence, changed-price
snapshots, rollback, competing final-copy purchases, expired sessions, malformed JSON,
body size/content type, unsupported methods and static path traversal.

The backend execution transcript is included as `backend-test-results.txt`.

## Browser verification

Tool: Playwright with Chromium 136.0.7103.25 headless.
Desktop: 1280x900. Mobile layout: viewport 390x844.
Result: **passed**, with no JavaScript page errors.

Verified twelve rendered books, author search, genre filtering, detail view, AJAX badge,
duplicate additions in one row, quantity update, cart reload persistence, successful
guest checkout, stored confirmation reload, empty checkout and disabled out-of-stock
purchase. Catalogue, cart and checkout had no horizontal overflow at mobile width.
The mobile check uses viewport/media-query layout, not a physical mobile device.

Screenshot captures in `screenshots/` show the real running app with fictional customer
data. The slide deck uses cropped feature captures. `browser-results.json` records the
checks. Full keyboard/accessibility review, additional browsers and real devices remain
future verification; the manual checklist is provided for the student's own run.

## Optional browser automation replay

Python is sufficient for the application and backend tests. To repeat browser automation,
also install Node.js and run:

```sh
npm install
npx playwright install chromium
npm run test:browser
```

The script starts/stops its own localhost server and uses a disposable database.
Set PYTHON_COMMAND if your Python command differs. Ensure port 8000 is free.
The delivered application itself has no npm dependency.
