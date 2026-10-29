PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL,
 category TEXT NOT NULL, description TEXT NOT NULL,
 price_cents INTEGER NOT NULL CHECK(price_cents > 0),
 stock INTEGER NOT NULL CHECK(stock >= 0), image TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, csrf TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cart_items (
 session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 product_id INTEGER NOT NULL REFERENCES products(id),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 PRIMARY KEY(session_id, product_id)
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
 idempotency_key TEXT NOT NULL, customer_name TEXT NOT NULL,
 email TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL,
 postal_code TEXT NOT NULL, total_cents INTEGER NOT NULL CHECK(total_cents > 0),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 UNIQUE(session_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS order_items (
 order_id TEXT NOT NULL REFERENCES orders(id),
 product_id INTEGER NOT NULL REFERENCES products(id),
 title TEXT NOT NULL, unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents > 0),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 PRIMARY KEY(order_id, product_id)
);
CREATE INDEX IF NOT EXISTS orders_session_idx ON orders(session_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
