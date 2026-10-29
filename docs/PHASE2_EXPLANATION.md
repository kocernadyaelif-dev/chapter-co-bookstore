# Phase 2 implementation explanation

Chapter & Co. implements the planned guest bookstore journey with twelve fictional
products in SQLite. Catalogue and detail views load records through a Python WSGI
JSON API. Vanilla JavaScript renders the views and uses Fetch to add books without
reloading, update the bag badge and edit cart quantities. An opaque HttpOnly guest
cookie identifies the cart, which also lives in SQLite.

Checkout validates customer fields and the simulation acknowledgment on the server,
reads current prices, checks stock and stores an order with item snapshots. One
transaction also reduces stock and clears the cart. A repeated request with the same
key returns the existing order. Twenty-four integration tests cover the complete flow,
invalid input, session ownership, forged prices, rollback and competing purchases.

The core scope remains intact. Search, genre filtering and price sorting improve
browsing. Login, administration and payments remain outside scope. The presentation
shows architecture, data design and the working interface. Assessment preparation
still requires the actual GitHub link, personal reflection and genuine tutor feedback.
