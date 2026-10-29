"""Inspect stored orders without printing customer contact information."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from db import connect,ROOT
path=ROOT/'data/shop.sqlite3'
if not path.exists():
    print('Start the shop first.');sys.exit(1)
db=connect(path)
for order in db.execute('SELECT id,total_cents,created_at FROM orders ORDER BY created_at'):
    print(dict(order))
    for item in db.execute('SELECT title,quantity,unit_price_cents FROM order_items WHERE order_id=?',(order['id'],)):
        print(' ',dict(item))
db.close()
