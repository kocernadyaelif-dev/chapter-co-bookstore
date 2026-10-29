"""SQLite persistence. One connection per request; money is stored in cents."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def connect(path):
    db = sqlite3.connect(str(path), timeout=10, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    return db

def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.executescript((ROOT / 'sql/schema.sql').read_text(encoding='utf-8'))
        db.executescript((ROOT / 'sql/seed.sql').read_text(encoding='utf-8'))
    db.close()
