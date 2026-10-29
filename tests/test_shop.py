"""Integration tests call the real WSGI API against an isolated SQLite file."""
import io
import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from wsgiref.util import setup_testing_defaults
from app import create_app, SESSION_AGE
from db import connect

class Client:
    def __init__(self, app):
        self.app, self.cookie, self.csrf = app, '', ''
        status, payload, _ = self.request('/api/session')
        assert status == 200
        self.csrf = payload['csrf_token']

    def request(self, path, method='GET', data=None, csrf=True, raw=None, content_type='application/json'):
        env={}
        setup_testing_defaults(env)
        env['PATH_INFO'], _, env['QUERY_STRING'] = path.partition('?')
        env['REQUEST_METHOD'] = method
        env['HTTP_COOKIE'] = self.cookie
        if csrf: env['HTTP_X_CSRF_TOKEN'] = self.csrf
        body = raw if raw is not None else json.dumps(data).encode() if data is not None else b''
        env['wsgi.input'], env['CONTENT_LENGTH'], env['CONTENT_TYPE'] = io.BytesIO(body),str(len(body)),content_type
        result={}
        def start_response(status,headers):
            result['status']=int(status.split()[0]); result['headers']=dict(headers)
            if 'Set-Cookie' in result['headers']: self.cookie=result['headers']['Set-Cookie'].split(';')[0]
        out=b''.join(self.app(env,start_response))
        payload=json.loads(out) if 'application/json' in result['headers'].get('Content-Type','') else out
        return result['status'], payload, result['headers']

    def add(self,pid=1,quantity=1): return self.request('/api/cart','POST',{'product_id':pid,'quantity':quantity})
    def checkout(self,**updates):
        data={'customer_name':'Demo Reader','email':'reader@example.test','address':'12 Fiction Lane',
              'city':'Sample Town','postal_code':'12345','idempotency_key':'test-order-key-12345','acknowledge_demo':True}
        data.update(updates)
        return self.request('/api/checkout','POST',data)

class ShopTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db=Path(self.tmp.name)/'shop.sqlite3'
        self.app=create_app(self.db)
        self.client=Client(self.app)

    def test_catalogue_seed_and_categories(self):
        status,data,_=self.client.request('/api/products')
        self.assertEqual(status,200); self.assertEqual(len(data['products']),12)
        self.assertEqual(len(data['categories']),4)

    def test_search_author_and_category(self):
        self.assertEqual(len(self.client.request('/api/products?q=Mira&category=Fiction')[1]['products']),1)
        self.assertEqual(len(self.client.request('/api/products?q=Mira&category=Nature')[1]['products']),0)

    def test_sql_injection_and_literal_wildcard(self):
        for q in ('%27%20OR%201%3D1--','%25','%5F'):
            self.assertEqual(self.client.request('/api/products?q='+q)[1]['products'],[])

    def test_product_detail_and_missing_product(self):
        self.assertEqual(self.client.request('/api/products/1')[1]['title'],'The Quiet Atlas')
        self.assertEqual(self.client.request('/api/products/999')[0],404)
        self.assertEqual(self.client.request('/api/products/999999999999999999999')[0],400)

    def test_duplicate_add_merges_and_totals(self):
        self.client.add();status,data,_=self.client.add()
        self.assertEqual(status,200);self.assertEqual(len(data['items']),1)
        self.assertEqual(data['count'],2);self.assertEqual(data['total_cents'],3780)

    def test_quantity_update_remove(self):
        self.client.add()
        data=self.client.request('/api/cart/1','PATCH',{'quantity':3})[1]
        self.assertEqual(data['total_cents'],5670)
        self.assertEqual(self.client.request('/api/cart/1','DELETE')[1]['count'],0)

    def test_invalid_quantities_and_ids(self):
        for q in (0,-1,1.5,'2',True,100): self.assertEqual(self.client.add(quantity=q)[0],400)
        self.assertEqual(self.client.add(pid=True)[0],400)
        self.assertEqual(self.client.add(pid=999)[0],404)

    def test_out_of_stock_and_limit(self):
        self.assertEqual(self.client.add(12)[0],409)
        self.assertEqual(self.client.add(1,25)[0],409)
        self.assertEqual(self.client.request('/api/cart')[1]['count'],0)

    def test_sessions_are_isolated(self):
        self.client.add()
        other=Client(self.app)
        self.assertEqual(other.request('/api/cart')[1]['count'],0)

    def test_csrf_protects_every_mutation(self):
        self.client.add()
        for path,method,body in [('/api/cart','POST',{'product_id':1}),('/api/cart/1','PATCH',{'quantity':2}),('/api/cart/1','DELETE',None),('/api/checkout','POST',{})]:
            self.assertEqual(self.client.request(path,method,body,csrf=False)[0],403)

    def test_cookie_and_security_headers(self):
        c=Client(self.app)
        # Force a fresh session, then inspect the actual cookie attributes.
        c.cookie=''
        _,_,headers=c.request('/api/session')
        self.assertIn('HttpOnly',headers['Set-Cookie']);self.assertIn('SameSite=Lax',headers['Set-Cookie'])
        self.assertEqual(headers['Cache-Control'],'no-store')
        self.assertIn("script-src 'self'",headers['Content-Security-Policy'])

    def test_empty_checkout(self): self.assertEqual(self.client.checkout()[0],409)

    def test_invalid_checkout_keeps_cart(self):
        self.client.add()
        for changes in ({'email':'wrong'},{'customer_name':''},{'acknowledge_demo':False},{'postal_code':'<x>'}):
            self.assertEqual(self.client.checkout(**changes)[0],400)
        self.assertEqual(self.client.request('/api/cart')[1]['count'],1)

    def test_server_ignores_forged_price_and_total(self):
        self.client.add(1,2)
        status,order,_=self.client.checkout(total_cents=1,price_cents=1)
        self.assertEqual(status,201); self.assertEqual(order['total_cents'],3780)
        self.assertEqual(order['items'][0]['unit_price_cents'],1890)

    def test_success_stores_items_decrements_stock_and_clears_cart(self):
        self.client.add(1,2);self.client.add(2)
        status,order,_=self.client.checkout()
        self.assertEqual(status,201);self.assertEqual(order['total_cents'],6230)
        self.assertEqual(len(order['items']),2)
        self.assertEqual(self.client.request('/api/cart')[1]['count'],0)
        self.assertEqual(self.client.request('/api/products/1')[1]['stock'],22)
        db=connect(self.db)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM orders').fetchone()[0],1)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM order_items').fetchone()[0],2)
        db.close()

    def test_repeated_checkout_is_idempotent(self):
        self.client.add()
        first=self.client.checkout()[1]
        status,second,_=self.client.checkout()
        self.assertEqual(status,200);self.assertEqual(first['id'],second['id'])
        self.assertEqual(self.client.request('/api/products/1')[1]['stock'],23)

    def test_order_access_requires_owner_session(self):
        self.client.add();order=self.client.checkout()[1]
        self.assertEqual(self.client.request('/api/orders/'+order['id'])[0],200)
        self.assertEqual(Client(self.app).request('/api/orders/'+order['id'])[0],404)

    def test_data_persists_after_app_restart(self):
        self.client.add();order=self.client.checkout()[1]
        restarted=Client(create_app(self.db));restarted.cookie=self.client.cookie
        self.assertEqual(restarted.request('/api/orders/'+order['id'])[1]['total_cents'],1890)
        self.assertEqual(restarted.request('/api/products/1')[1]['stock'],23)

    def test_changed_price_uses_current_db_and_preserves_snapshot(self):
        self.client.add();db=connect(self.db);db.execute('UPDATE products SET price_cents=2000 WHERE id=1');db.close()
        order=self.client.checkout()[1];self.assertEqual(order['total_cents'],2000)
        db=connect(self.db);db.execute('UPDATE products SET price_cents=3000 WHERE id=1');db.close()
        self.assertEqual(self.client.request('/api/orders/'+order['id'])[1]['items'][0]['unit_price_cents'],2000)

    def test_stock_change_rolls_back_entire_checkout(self):
        self.client.add(1);self.client.add(2)
        db=connect(self.db);db.execute('UPDATE products SET stock=0 WHERE id=2');db.close()
        self.assertEqual(self.client.checkout()[0],409)
        self.assertEqual(self.client.request('/api/products/1')[1]['stock'],24)
        self.assertEqual(self.client.request('/api/cart')[1]['count'],2)
        db=connect(self.db);self.assertEqual(db.execute('SELECT COUNT(*) FROM orders').fetchone()[0],0);db.close()

    def test_concurrent_orders_cannot_oversell(self):
        db=connect(self.db);db.execute('UPDATE products SET stock=1 WHERE id=1');db.close()
        other=Client(self.app);self.client.add();other.add()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda c:c.checkout()[0],(self.client,other)))
        self.assertEqual(sorted(results),[201,409])
        self.assertEqual(self.client.request('/api/products/1')[1]['stock'],0)

    def test_expired_session_is_replaced(self):
        self.client.add();old_cookie=self.client.cookie
        db=connect(self.db);db.execute('UPDATE sessions SET created_at=created_at-?',(SESSION_AGE+1,));db.close()
        self.assertEqual(self.client.request('/api/cart')[1]['count'],0)
        self.assertNotEqual(self.client.cookie,old_cookie)

    def test_bad_json_content_type_and_methods(self):
        self.assertEqual(self.client.request('/api/cart','POST',raw=b'{oops')[0],400)
        self.assertEqual(self.client.request('/api/cart','POST',data={},content_type='text/plain')[0],415)
        self.assertEqual(self.client.request('/api/cart','POST',raw=b'[]')[0],400)
        self.assertEqual(self.client.request('/api/cart','POST',raw=b'x'*9000)[0],413)
        self.assertEqual(self.client.request('/api/products','PUT')[0],405)

    def test_static_files_and_traversal(self):
        self.assertEqual(self.client.request('/')[0],200)
        self.assertEqual(self.client.request('/styles.css')[0],200)
        self.assertEqual(self.client.request('/../app.py')[0],404)
        self.assertEqual(self.client.request('/missing.txt')[0],404)

if __name__=='__main__':unittest.main()
