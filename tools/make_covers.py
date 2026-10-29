"""Generate original vector covers for the fictional demo catalogue."""
import html
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from db import connect, initialize, ROOT

palette = [('#c9d0b7','#374a40'),('#244c42','#ece9cf'),('#bd5835','#f8edda'),
           ('#d7c8a8','#6a432d'),('#dacaad','#464940'),('#657654','#f5ebd4'),
           ('#35465a','#e2d3b1'),('#dc9564','#3a4a3c'),('#9fb5ad','#254b4a'),
           ('#e1cc88','#465c3b'),('#84735e','#f3e7cf'),('#d8d8c8','#414b40')]
titles = [('THE QUIET','ATLAS'),('A FIELD GUIDE','TO WONDER'),('OBJECTS OF','EVERYDAY LIFE'),
          ('THE LONG','WAY HOME'),('MAKING','SPACE'),('BENEATH','THE CANOPY'),
          ('SMALL','HOURS'),('THE CREATIVE','PRACTICE'),('WALKING','THE COAST'),
          ('A GARDEN','IN SEASON'),('ELSEWHERE,','SLOWLY'),('LINES AND','LIGHT')]

def build():
    assets = ROOT/'static/assets'
    assets.mkdir(parents=True,exist_ok=True)
    initialize(ROOT/'data/shop.sqlite3')
    with connect(ROOT/'data/shop.sqlite3') as db: books=list(db.execute('SELECT * FROM products ORDER BY id'))
    db.close()
    for i,book in enumerate(books):
        bg,fg=palette[i]
        if i%4==0:
            art=f'<circle cx="175" cy="218" r="92" fill="{fg}" opacity=".9"/><path d="M50 276Q170 140 300 276" fill="{bg}"/><path d="M40 250Q150 235 310 310" stroke="{fg}" stroke-width="3" fill="none"/>'
        elif i%4==1:
            art=''.join(f'<path d="M{100+j*38} 300Q{25+j*38} 185 {112+j*38} 150Q{180+j*38} 230 {100+j*38} 300" fill="none" stroke="{fg}" stroke-width="2"/>' for j in range(4))
        elif i%4==2:
            art=f'<rect x="64" y="175" width="80" height="130" fill="{fg}"/><circle cx="211" cy="208" r="46" fill="none" stroke="{fg}" stroke-width="9"/><path d="M164 305L260 305L212 246Z" fill="{fg}"/>'
        else:
            art=''.join(f'<path d="M35 {205+j*17}Q140 {145+j*27} 305 {210+j*17}" stroke="{fg}" stroke-width="2" fill="none"/>' for j in range(6))
        svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="350" height="500" viewBox="0 0 350 500"><rect width="350" height="500" fill="{bg}"/><rect width="12" height="500" fill="#000" opacity=".1"/><rect x="26" y="25" width="300" height="450" fill="none" stroke="{fg}" opacity=".35"/><text x="175" y="57" font-family="Arial,sans-serif" font-size="9" letter-spacing="3" text-anchor="middle" fill="{fg}">CHAPTER &amp; CO. EDITIONS</text><text x="175" y="106" font-family="Georgia,serif" font-size="25" text-anchor="middle" fill="{fg}">{titles[i][0]}</text><text x="175" y="137" font-family="Georgia,serif" font-size="25" text-anchor="middle" fill="{fg}">{titles[i][1]}</text><g transform="translate(0,25)">{art}</g><text x="175" y="412" font-family="Arial,sans-serif" font-size="14" letter-spacing="3" text-anchor="middle" fill="{fg}">{html.escape(book['author'].upper())}</text><text x="175" y="450" font-family="Georgia,serif" font-size="11" text-anchor="middle" fill="{fg}">A book for curious minds</text></svg>'''
        (assets/f'book-{i+1}.svg').write_text(svg,encoding='utf-8')
    (assets/'mark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#384739"/><path d="M7 9Q11 7 16 10Q21 7 25 9V23Q21 21 16 24Q11 21 7 23Z" fill="none" stroke="#f3e9ce" stroke-width="1.4"/><path d="M16 10V24" stroke="#f3e9ce" stroke-width="1.4"/></svg>',encoding='utf-8')

if __name__ == '__main__': build()
