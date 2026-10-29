"""Small WSGI JSON API and static frontend. No third-party dependencies.

Every mutation validates a session CSRF token. SQLite BEGIN IMMEDIATE serializes
cart updates and checkout, avoiding lost updates and stock overselling.
"""
import argparse
import hashlib
import json
import logging
import mimetypes
import os
import re
import secrets
import time
import uuid
from http import HTTPStatus
from http.cookies import SimpleCookie, CookieError
from pathlib import Path
from socketserver import ThreadingMixIn
from urllib.parse import parse_qs
from wsgiref.simple_server import WSGIServer, make_server
from db import ROOT, connect, initialize

MAX_BODY = 8192
SESSION_AGE = 7 * 24 * 60 * 60

class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message

def require_int(value, name, minimum=1, maximum=99):
    # JSON booleans are Python integers, but are not valid quantities or IDs.
    if type(value) is not int or not minimum <= value <= maximum:
        raise APIError(400, f'{name} must be an integer from {minimum} to {maximum}.')
    return value

def read_json(env):
    if env.get('CONTENT_TYPE', '').split(';')[0].strip() != 'application/json':
        raise APIError(415, 'Send JSON with Content-Type: application/json.')
    try:
        length = int(env.get('CONTENT_LENGTH') or 0)
    except ValueError:
        raise APIError(400, 'Invalid request length.')
    if not 0 < length <= MAX_BODY:
        raise APIError(413 if length > MAX_BODY else 400, 'Invalid request body size.')
    try:
        data = json.loads(env['wsgi.input'].read(length))
    except (ValueError, UnicodeDecodeError):
        raise APIError(400, 'Invalid JSON.')
    if not isinstance(data, dict):
        raise APIError(400, 'The JSON body must be an object.')
    return data

def session_for(env, db):
    cookie = SimpleCookie()
    try:
        cookie.load(env.get('HTTP_COOKIE', ''))
    except CookieError:
        pass
    raw = cookie['chapter_session'].value if 'chapter_session' in cookie else ''
    digest = hashlib.sha256(raw.encode()).hexdigest()
    row = db.execute('SELECT * FROM sessions WHERE id=? AND created_at>?',
                     (digest, int(time.time()) - SESSION_AGE)).fetchone()
    if row:
        return dict(row), None
    raw = secrets.token_urlsafe(32)
    session = {'id': hashlib.sha256(raw.encode()).hexdigest(),
               'csrf': secrets.token_urlsafe(32), 'created_at': int(time.time())}
    db.execute('INSERT INTO sessions VALUES (?,?,?)', tuple(session.values()))
    secure = '; Secure' if os.environ.get('COOKIE_SECURE') == '1' else ''
    return session, f'chapter_session={raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_AGE}{secure}'

def cart_for(db, sid):
    rows = db.execute('''SELECT p.*, c.quantity FROM cart_items c
                        JOIN products p ON p.id=c.product_id
                        WHERE c.session_id=? ORDER BY p.id''', (sid,)).fetchall()
    items = [dict(r) | {'subtotal_cents': r['quantity'] * r['price_cents']} for r in rows]
    return {'items': items, 'count': sum(r['quantity'] for r in rows),
            'total_cents': sum(r['subtotal_cents'] for r in items), 'shipping_cents': 0}

def order_for(db, sid, oid):
    row = db.execute('SELECT * FROM orders WHERE id=? AND session_id=?', (oid, sid)).fetchone()
    if not row:
        raise APIError(404, 'Order not found for this guest session.')
    order = dict(row)
    order.pop('session_id')
    order.pop('idempotency_key')
    order['items'] = [dict(r) for r in db.execute('SELECT product_id,title,unit_price_cents,quantity FROM order_items WHERE order_id=? ORDER BY product_id', (oid,))]
    return order

def validate_customer(data):
    limits = {'customer_name': (2, 80), 'email': (5, 254), 'address': (3, 150),
              'city': (2, 80), 'postal_code': (2, 16), 'idempotency_key': (16, 80)}
    result = {}
    for name, (lo, hi) in limits.items():
        value = data.get(name)
        if not isinstance(value, str) or not lo <= len(value.strip()) <= hi or any(ord(c) < 32 for c in value):
            raise APIError(400, f'{name.replace("_", " ").capitalize()} is missing or invalid.')
        result[name] = value.strip()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', result['email']):
        raise APIError(400, 'Enter a valid email address.')
    if not re.fullmatch(r'[A-Za-z0-9 -]+', result['postal_code']):
        raise APIError(400, 'Enter a valid postal code.')
    if data.get('acknowledge_demo') is not True:
        raise APIError(400, 'Please acknowledge that this is a simulated order.')
    return result

def dispatch(env, db, session):
    method, path, sid = env['REQUEST_METHOD'], env['PATH_INFO'], session['id']
    if method not in ('GET', 'POST', 'PATCH', 'DELETE'):
        raise APIError(405, 'Method not allowed.')
    if method != 'GET':
        if not secrets.compare_digest(env.get('HTTP_X_CSRF_TOKEN', ''), session['csrf']):
            raise APIError(403, 'Session verification failed. Refresh the page and try again.')
    if path == '/api/session' and method == 'GET':
        return 200, {'csrf_token': session['csrf']}
    if path == '/api/products' and method == 'GET':
        params = parse_qs(env.get('QUERY_STRING', ''))
        q = params.get('q', [''])[0][:100]
        category = params.get('category', [''])[0][:50]
        # Escape LIKE wildcards: search text is literal, SQL stays parameterized.
        q = '%' + q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        rows = db.execute("SELECT * FROM products WHERE (title LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\') AND (?='' OR category=?) ORDER BY id", (q,q,category,category))
        return 200, {'products': [dict(r) for r in rows], 'categories': [r[0] for r in db.execute('SELECT DISTINCT category FROM products ORDER BY category')]}
    match = re.fullmatch(r'/api/products/(\d+)', path)
    if match and method == 'GET':
        pid = require_int(int(match[1]), 'Product ID', 1, 2147483647)
        row = db.execute('SELECT * FROM products WHERE id=?', (pid,)).fetchone()
        if not row:
            raise APIError(404, 'Book not found.')
        return 200, dict(row)
    if path == '/api/cart' and method == 'GET':
        return 200, cart_for(db, sid)
    if path == '/api/cart' and method == 'POST':
        data = read_json(env)
        pid = require_int(data.get('product_id'), 'Product ID', 1, 2147483647)
        quantity = require_int(data.get('quantity', 1), 'Quantity')
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT stock FROM products WHERE id=?', (pid,)).fetchone()
        if not row:
            raise APIError(404, 'Book not found.')
        existing = db.execute('SELECT quantity FROM cart_items WHERE session_id=? AND product_id=?', (sid,pid)).fetchone()
        total = quantity + (existing[0] if existing else 0)
        if total > min(row['stock'], 99):
            raise APIError(409, 'This quantity exceeds the available stock or cart limit.')
        db.execute('INSERT INTO cart_items VALUES (?,?,?) ON CONFLICT(session_id,product_id) DO UPDATE SET quantity=excluded.quantity', (sid,pid,total))
        db.commit()
        return 200, cart_for(db, sid)
    match = re.fullmatch(r'/api/cart/(\d+)', path)
    if match and method in ('PATCH', 'DELETE'):
        pid = require_int(int(match[1]), 'Product ID', 1, 2147483647)
        quantity = require_int(read_json(env).get('quantity'), 'Quantity') if method == 'PATCH' else None
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT p.stock FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.session_id=? AND c.product_id=?', (sid,pid)).fetchone()
        if not row:
            raise APIError(404, 'Cart item not found.')
        if method == 'DELETE':
            db.execute('DELETE FROM cart_items WHERE session_id=? AND product_id=?', (sid,pid))
        else:
            if quantity > row['stock']:
                raise APIError(409, 'This quantity exceeds available stock.')
            db.execute('UPDATE cart_items SET quantity=? WHERE session_id=? AND product_id=?', (quantity,sid,pid))
        db.commit()
        return 200, cart_for(db, sid)
    if path == '/api/checkout' and method == 'POST':
        data = validate_customer(read_json(env))
        db.execute('BEGIN IMMEDIATE')
        # A repeated request returns the committed order, even with an empty cart.
        existing = db.execute('SELECT id FROM orders WHERE session_id=? AND idempotency_key=?', (sid,data['idempotency_key'])).fetchone()
        if existing:
            db.commit()
            return 200, order_for(db,sid,existing[0])
        cart = cart_for(db, sid)
        if not cart['items']:
            raise APIError(409, 'Your cart is empty. Add a book before checking out.')
        for item in cart['items']:
            if item['quantity'] > item['stock']:
                raise APIError(409, f'{item["title"]} no longer has enough stock. Please update your cart.')
        oid = 'CC-' + uuid.uuid4().hex[:16].upper()
        db.execute('INSERT INTO orders (id,session_id,idempotency_key,customer_name,email,address,city,postal_code,total_cents) VALUES (?,?,?,?,?,?,?,?,?)',
                   (oid,sid,data['idempotency_key'],data['customer_name'],data['email'],data['address'],data['city'],data['postal_code'],cart['total_cents']))
        for item in cart['items']:
            db.execute('INSERT INTO order_items VALUES (?,?,?,?,?)', (oid,item['id'],item['title'],item['price_cents'],item['quantity']))
            db.execute('UPDATE products SET stock=stock-? WHERE id=?', (item['quantity'],item['id']))
        db.execute('DELETE FROM cart_items WHERE session_id=?', (sid,))
        db.commit()
        return 201, order_for(db, sid, oid)
    match = re.fullmatch(r'/api/orders/(CC-[A-F0-9]{16})', path)
    if match and method == 'GET':
        return 200, order_for(db, sid, match[1])
    raise APIError(404, 'Endpoint not found.')

def create_app(database=None):
    database = Path(database or os.environ.get('SHOP_DB', ROOT / 'data/shop.sqlite3'))
    initialize(database)
    static_root = (ROOT / 'static').resolve()

    def application(env, start_response):
        headers = [('X-Content-Type-Options','nosniff'), ('Referrer-Policy','same-origin'),
                   ('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")]
        path, method = env.get('PATH_INFO','/'), env.get('REQUEST_METHOD','GET')
        status = 200
        if path.startswith('/api/'):
            db = connect(database)
            try:
                session, cookie = session_for(env, db)
                if cookie:
                    headers.append(('Set-Cookie',cookie))
                status, payload = dispatch(env, db, session)
            except APIError as error:
                db.rollback()
                status, payload = error.status, {'error':error.message}
            except Exception:
                db.rollback()
                logging.exception('API failure')
                status, payload = 500, {'error':'The server could not complete this request.'}
            finally:
                db.close()
            body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            headers += [('Content-Type','application/json; charset=utf-8'),('Cache-Control','no-store')]
        else:
            target = (static_root / ('index.html' if path == '/' else path.lstrip('/'))).resolve()
            if method != 'GET':
                status, body = 405, b'Method not allowed'
            elif not target.is_relative_to(static_root) or not target.is_file():
                status, body = 404, b'Not found'
            else:
                body = target.read_bytes()
            mime = mimetypes.guess_type(str(target))[0] or 'text/plain'
            headers += [('Content-Type', mime + ('; charset=utf-8' if mime.startswith('text/') else '')),('Cache-Control','no-cache')]
        headers.append(('Content-Length',str(len(body))))
        start_response(f'{status} {HTTPStatus(status).phrase}', headers)
        return [body]
    return application

class ThreadedServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Chapter & Co. local prototype')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    with make_server(args.host, args.port, create_app(), server_class=ThreadedServer) as server:
        print(f'Chapter & Co.: http://{args.host}:{args.port} (local development server)', flush=True)
        server.serve_forever()
