// Browser routes render semantic HTML. Fetch exchanges JSON with the same-origin API.
const main = document.querySelector('#main');
const badge = document.querySelector('#cart-count');
const currency = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const money = cents => currency.format(cents / 100);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let csrf = '', renderVersion = 0, toastTimer;

async function api(path, method = 'GET', data) {
  const response = await fetch(path, { method, credentials: 'same-origin',
    headers: { ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
  return payload;
}
function notify(message, failed = false) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.className = `toast visible${failed ? ' fail' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000);
}
function updateBadge(cart) {
  badge.textContent = cart.count;
  badge.setAttribute('aria-label', `${cart.count} books in bag`);
}
function setPage(html, version, title) {
  if (version !== renderVersion) return false;
  main.innerHTML = html;
  document.title = `${title} | Chapter & Co.`;
  return true;
}
function crumbs(name) { return `<div class="breadcrumb"><a href="#catalog">The collection</a> / ${escapeHTML(name)}</div>`; }
function emptyPage(title, message) { return `<div class="wrap empty"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(message)}</p><a href="#catalog" class="button">Explore the collection</a></div>`; }
function summary(cart, action = true) {
  return `<aside class="summary" aria-label="Order summary"><h2>Order summary</h2><div class="sum-row"><span>Books (${cart.count})</span><span>${money(cart.total_cents)}</span></div><div class="sum-row"><span>Demo delivery</span><span>Free</span></div><div class="sum-row sum-total"><span>Total</span><span>${money(cart.total_cents)}</span></div>${action ? '<a class="button" href="#checkout">Continue to checkout <span aria-hidden="true">→</span></a>' : ''}<p class="small">A simulated purchase. No payment will be taken.</p></aside>`;
}
function card(book) {
  return `<article class="book-card"><a class="book-visual" href="#product/${book.id}" aria-label="View ${escapeHTML(book.title)}"><img src="${escapeHTML(book.image)}" alt="${escapeHTML(book.title)} book cover" width="144" height="206" loading="lazy">${!book.stock ? '<span class="stock-label">Out of stock</span>' : ''}</a><p class="category">${escapeHTML(book.category)}</p><h3><a href="#product/${book.id}">${escapeHTML(book.title)}</a></h3><p class="author">${escapeHTML(book.author)}</p><div class="card-bottom"><span class="price">${money(book.price_cents)}</span><button class="quick-add" data-add="${book.id}" ${!book.stock ? 'disabled' : ''} aria-label="Add ${escapeHTML(book.title)} to bag">${book.stock ? 'Add to bag +' : 'Unavailable'}</button></div></article>`;
}
async function catalog(version) {
  const params = new URLSearchParams((location.hash.split('?')[1] || ''));
  const q = params.get('q') || '', category = params.get('category') || '', sort = params.get('sort') || 'selected';
  const result = await api(`/api/products?${new URLSearchParams({ q, category })}`);
  if (sort === 'low') result.products.sort((a,b) => a.price_cents-b.price_cents);
  if (sort === 'high') result.products.sort((a,b) => b.price_cents-a.price_cents);
  if (!setPage(`<div class="wrap"><section class="hero" aria-labelledby="hero-title"><div><div class="eyebrow">Independent in spirit. Curious by nature.</div><h1 id="hero-title">Find your<br>next chapter.</h1><p>Stories to get lost in. Ideas to carry with you.<br>A small collection, with a world inside.</p><a class="button" href="#collection">Browse the books <span aria-hidden="true">↘</span></a></div><div class="hero-art" aria-hidden="true"><img src="/assets/book-2.svg" alt=""><img src="/assets/book-1.svg" alt=""><img src="/assets/book-3.svg" alt=""></div></section><section class="collection" id="collection" aria-labelledby="collection-title"><div class="collection-top"><h2 id="collection-title">The collection</h2><p>${result.products.length} ${result.products.length === 1 ? 'book' : 'books'} to discover</p></div><form class="filters" id="filter-form"><div class="field search-field"><label for="search">Find a book</label><input id="search" name="q" placeholder="Search by title or author" value="${escapeHTML(q)}" maxlength="100" type="search"></div><div class="field"><label for="category">Browse by genre</label><select name="category" id="category"><option value="">All genres</option>${result.categories.map(c => `<option ${category === c ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('')}</select></div><div class="field"><label for="sort">Sort the collection</label><select name="sort" id="sort"><option value="selected" ${sort === 'selected' ? 'selected' : ''}>Our selection</option><option value="low" ${sort === 'low' ? 'selected' : ''}>Price: low to high</option><option value="high" ${sort === 'high' ? 'selected' : ''}>Price: high to low</option></select></div><button type="submit" class="button mobile-only">Find books</button></form>${result.products.length ? `<div class="grid">${result.products.map(card).join('')}</div>` : '<div class="empty"><h3>No books found</h3><p>Try another title, author or genre.</p><a class="button secondary" href="#catalog">Show all books</a></div>'}</section></div>`, version, 'The collection')) return;
  const form = document.querySelector('#filter-form');
  const applyFilters = () => { location.hash = `catalog?${new URLSearchParams(new FormData(form))}`; };
  form.addEventListener('submit', e => { e.preventDefault(); applyFilters(); });
  // Search applies on Enter or leaving the field, avoiding re-rendering on each key.
  form.querySelectorAll('input,select').forEach(field => field.addEventListener('change', applyFilters));
}
async function detail(id, version) {
  const book = await api(`/api/products/${id}`);
  setPage(`<div class="wrap">${crumbs(book.category)}<section class="detail"><div class="detail-art"><img src="${escapeHTML(book.image)}" alt="${escapeHTML(book.title)} book cover" width="258" height="370"></div><div class="detail-copy"><p class="eyebrow">${escapeHTML(book.category)} / Paperback</p><h1>${escapeHTML(book.title)}</h1><p class="author">By ${escapeHTML(book.author)}</p><span class="price">${money(book.price_cents)}</span><p class="description">${escapeHTML(book.description)}</p><p class="availability">${book.stock ? `${book.stock} copies available` : 'Currently out of stock'}</p><form id="add-form" class="buy-row"><div class="field"><label for="quantity">Quantity</label><input id="quantity" type="number" min="1" max="${Math.min(book.stock,99) || 1}" value="1" required ${!book.stock ? 'disabled' : ''}></div><button class="button" ${!book.stock ? 'disabled' : ''}>Add to bag <span aria-hidden="true">+</span></button></form><div class="meta">Free demo delivery. Guest checkout.<br>This fictional book is part of our student shop.</div></div></section></div>`, version, book.title);
  document.querySelector('#add-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await addBook(book.id, Number(document.querySelector('#quantity').value), e.submitter);
  });
}
async function addBook(id, quantity, button) {
  button.disabled = true;
  try { updateBadge(await api('/api/cart','POST',{ product_id:id, quantity })); notify('Added to your bag.'); }
  catch (error) { notify(error.message,true); }
  finally { button.disabled = false; }
}
async function cartPage(version) {
  const cart = await api('/api/cart');
  updateBadge(cart);
  if (!cart.items.length) return setPage(emptyPage('Your bag is waiting.', 'A good story is only a browse away.'), version, 'Your bag');
  setPage(`<div class="wrap"><div class="page-heading"><p class="eyebrow">A few good choices</p><h1>Your book bag</h1><p>${cart.count} ${cart.count === 1 ? 'book' : 'books'}, ready for a new home.</p></div><div class="two-col"><section aria-label="Books in your bag">${cart.items.map(item => `<article class="cart-row"><a href="#product/${item.id}"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)} cover"></a><div><h3><a href="#product/${item.id}">${escapeHTML(item.title)}</a></h3><p class="small">${escapeHTML(item.author)}</p><p class="small">${money(item.price_cents)} each</p><button class="remove" data-remove="${item.id}" aria-label="Remove ${escapeHTML(item.title)}">Remove</button></div><div class="field"><label for="qty-${item.id}">Quantity</label><input id="qty-${item.id}" data-quantity="${item.id}" type="number" min="1" max="${Math.min(item.stock,99) || 1}" value="${item.quantity}" aria-label="Quantity for ${escapeHTML(item.title)}"></div><div class="line-total">${money(item.subtotal_cents)}</div></article>`).join('')}<p><a class="small" href="#catalog">← Keep exploring</a></p></section>${summary(cart)}</div></div>`, version, 'Your bag');
  main.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => changeCart(`/api/cart/${button.dataset.remove}`, 'DELETE', undefined, button)));
  main.querySelectorAll('[data-quantity]').forEach(input => input.addEventListener('change', () => changeCart(`/api/cart/${input.dataset.quantity}`, 'PATCH', { quantity: Number(input.value) }, input)));
}
async function changeCart(path, method, body, control) {
  control.disabled = true;
  try { updateBadge(await api(path,method,body)); notify('Your bag has been updated.'); }
  catch (error) { notify(error.message,true); }
  finally { await render(false); }
}
async function checkout(version) {
  const cart = await api('/api/cart');
  if (!cart.items.length) return setPage(emptyPage('Your bag is empty.', 'Add a book before starting checkout.'), version, 'Checkout');
  const field = (name,label,type,max,min,autocomplete) => `<div class="field ${name === 'address' || name === 'email' || name === 'customer_name' ? 'full' : ''}"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" required minlength="${min}" maxlength="${max}" autocomplete="${autocomplete}"></div>`;
  if (!setPage(`<div class="wrap"><div class="page-heading"><p class="eyebrow">One last page</p><h1>Guest checkout</h1><p>A few details for your simulated order.</p></div><div class="two-col"><form id="checkout-form" class="checkout-form"><p class="notice full">This is a demo shop. Use fictional contact details. No payment or delivery takes place.</p>${field('customer_name','Full name','text',80,2,'name')}${field('email','Email address','email',254,5,'email')}${field('address','Street and house number','text',150,3,'street-address')}${field('postal_code','Postal code','text',16,2,'postal-code')}${field('city','Town or city','text',80,2,'address-level2')}<label class="check full"><input type="checkbox" name="acknowledge_demo" required><span>I understand that this is a simulated order and no money will be charged.</span></label><div id="form-error" class="error full" role="alert" hidden></div><button class="button full" type="submit">Place demo order <span aria-hidden="true">→</span></button><a href="#cart" class="small full">← Back to bag</a></form>${summary(cart,false)}</div></div>`, version, 'Checkout')) return;
  // Retain this key across retries until this form successfully places an order.
  const idempotencyKey = crypto.randomUUID();
  document.querySelector('#checkout-form').addEventListener('submit', async e => {
    e.preventDefault();
    const button = e.submitter, errorBox = document.querySelector('#form-error');
    if (button.disabled) return;
    button.disabled = true; button.textContent = 'Placing your order...'; errorBox.hidden = true;
    const data = Object.fromEntries(new FormData(e.target));
    data.acknowledge_demo = Boolean(data.acknowledge_demo);
    data.idempotency_key = idempotencyKey;
    try {
      const order = await api('/api/checkout','POST',data);
      updateBadge({ count: 0 }); location.hash = `order/${order.id}`;
    } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; button.disabled = false; button.textContent = 'Place demo order'; }
  });
}
async function confirmation(id, version) {
  const order = await api(`/api/orders/${encodeURIComponent(id)}`);
  setPage(`<div class="wrap"><section class="confirmation"><div class="confirm-heading"><div class="confirm-icon" aria-hidden="true">✓</div><p class="eyebrow">A new chapter awaits</p><h1>Your demo order is placed.</h1><p class="small">Order ${escapeHTML(order.id)}</p></div><p class="notice">Thank you for trying Chapter & Co. This is a simulated order. We have not charged you, and no books will be shipped.</p><div class="order-info"><div><h3>Demo recipient</h3><p class="small">${escapeHTML(order.customer_name)}<br>${escapeHTML(order.email)}</p></div><div><h3>Demo delivery address</h3><p class="small">${escapeHTML(order.address)}<br>${escapeHTML(order.postal_code)} ${escapeHTML(order.city)}</p></div></div><h2>Your books</h2>${order.items.map(item => `<div class="order-line"><span>${escapeHTML(item.title)} <span class="small">× ${item.quantity}</span></span><span>${money(item.quantity*item.unit_price_cents)}</span></div>`).join('')}<div class="sum-row sum-total"><span>Order total</span><span>${money(order.total_cents)}</span></div><p class="small">Recorded on ${new Date(order.created_at).toLocaleDateString('en-GB')}.</p><a class="button" href="#catalog">Continue exploring</a></section></div>`, version, 'Order confirmed');
}
async function render(scroll = true) {
  if (location.hash === '#collection') { document.querySelector('#collection')?.scrollIntoView(); return; }
  if (location.hash === '#main') { main.focus(); return; }
  const version = ++renderVersion;
  const route = (location.hash.slice(1) || 'catalog').split('?')[0];
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === route;
    link.classList.toggle('active',active);
    if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  try {
    if (route === 'catalog') await catalog(version);
    else if (/^product\/\d+$/.test(route)) await detail(route.split('/')[1],version);
    else if (route === 'cart') await cartPage(version);
    else if (route === 'checkout') await checkout(version);
    else if (route.startsWith('order/')) await confirmation(route.split('/')[1],version);
    else if (route === 'story') setPage('<div class="wrap"><article class="story"><p class="eyebrow">The story behind the shelves</p><h1>A small bookshop.<br>A world of possibilities.</h1><p>Chapter & Co. is a fictional independent bookstore, created around the simple pleasure of finding a book you did not know you needed.</p><p>Our collection brings together stories, design, nature and slow journeys. Each title and cover belongs to this student prototype, made to demonstrate browsing, a book bag and a simulated guest checkout.</p><p>Try the experience, use fictional details at checkout, and find your next chapter.</p><a class="button" href="#catalog">Explore the collection</a></article></div>',version,'Our story');
    else setPage(emptyPage('This page has turned.', 'We could not find that page. Return to the collection.'),version,'Page not found');
    if (scroll && version === renderVersion) { window.scrollTo(0,0); main.focus({ preventScroll:true }); }
  } catch (error) { setPage(emptyPage('A little interruption.',error.message),version,'Please try again'); }
}
main.addEventListener('click', async e => {
  const button = e.target.closest('[data-add]');
  if (button && !button.disabled) await addBook(Number(button.dataset.add),1,button);
});
window.addEventListener('hashchange', () => render());
try { csrf = (await api('/api/session')).csrf_token; updateBadge(await api('/api/cart')); await render(false); }
catch (error) { main.innerHTML = emptyPage('The bookshop could not open.',error.message); }
