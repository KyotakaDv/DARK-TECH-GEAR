const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const digits = (s) => String(s || '').replace(/\D/g, '');
const CATS = ['Todos', 'Hardware', 'Wearables', 'Áudio', 'Acessórios'];
const CART_KEY = 'darkgear_cart';

let products = [];
let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let category = 'Todos', coupon = '', cep = '', quote = null, cartMsg = '';

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2800);
}

// ----- Catálogo -----
function renderChips() {
  $('#categories').innerHTML = CATS.map((c) =>
    `<button class="chip ${c === category ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
}

async function loadProducts() {
  try {
    const qs = new URLSearchParams({ category, search: $('#search').value, maxPrice: $('#maxPrice').value, sort: $('#sort').value });
    products = await api('/products?' + qs);
  } catch (err) { return toast(err.message); }
  $('#empty').hidden = products.length > 0;
  $('#products').innerHTML = products.map((p) => {
    const out = p.stockCount <= 0;
    return `
      <article class="card">
        <div class="img" data-view="${p.id}">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
          ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
          ${out ? '<span class="badge out">Esgotado</span>' : ''}
        </div>
        <div class="body">
          <div class="meta"><span>${esc(p.category)}</span><span>★ ${p.rating} <small>(${p.reviewsCount})</small></span></div>
          <h3 data-view="${p.id}">${esc(p.name)}</h3>
          <p class="desc">${esc(p.description)}</p>
          <div class="buy">
            <div>${p.originalPrice ? `<s>${fmt(p.originalPrice)}</s>` : ''}<strong>${fmt(p.price)}</strong></div>
            <button class="btn primary sm" data-add="${p.id}" ${out ? 'disabled' : ''}>${out ? 'Indisponível' : 'Adicionar'}</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function openDetail(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  const opts = (arr) => arr.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  $('#detailBody').innerHTML = `
    <button class="close" data-close>✕</button>
    <div class="detail">
      <img src="${esc(p.image)}" alt="${esc(p.name)}">
      <div>
        <small class="cat">${esc(p.category)}</small>
        <h2>${esc(p.name)}</h2>
        <p class="meta">★ ${p.rating} (${p.reviewsCount} avaliações)</p>
        <p class="desc">${esc(p.description)}</p>
        <label>Variante<select id="dVar">${opts(p.variants)}</select></label>
        <label>Tamanho<select id="dSize">${opts(p.sizes)}</select></label>
        <div class="buy"><strong>${fmt(p.price)}</strong>
          <button class="btn primary" id="dAdd" ${p.stockCount <= 0 ? 'disabled' : ''}>Adicionar</button></div>
      </div>
    </div>`;
  $('#dAdd').onclick = () => {
    addToCart(p, $('#dVar').value, $('#dSize').value);
    $('#detailDlg').close();
  };
  $('#detailDlg').showModal();
}

// ----- Carrinho -----
const saveCart = () => localStorage.setItem(CART_KEY, JSON.stringify(cart));
const lineItems = () => cart.map((l) => ({ productId: l.productId, quantity: l.quantity, variant: l.variant, size: l.size }));

function addToCart(p, variant = p.variants[0], size = p.sizes[0]) {
  const key = `${p.id}|${variant}|${size}`;
  const line = cart.find((l) => l.key === key);
  if (line) line.quantity = Math.min(line.quantity + 1, 99);
  else cart.push({ key, productId: p.id, name: p.name, image: p.image, price: p.price, variant, size, quantity: 1 });
  toast(`"${p.name}" adicionado ao carrinho`);
  refreshCart();
}

// Recalcula totais no servidor (preço, cupom e frete ficam no backend)
async function refreshCart() {
  saveCart();
  $('#cartCount').textContent = cart.reduce((a, l) => a + l.quantity, 0);
  quote = null;
  cartMsg = '';
  if (cart.length) {
    try {
      quote = await api('/quote', { method: 'POST', body: { items: lineItems(), couponCode: coupon, cep } });
    } catch (err) { cartMsg = err.message; }
  }
  renderCart();
}

function renderCart() {
  $('#cartItems').innerHTML = cart.length ? cart.map((l) => `
    <div class="line">
      <img src="${esc(l.image)}" alt="">
      <div class="grow"><b>${esc(l.name)}</b><small>${esc(l.variant)} · ${esc(l.size)}</small><strong>${fmt(l.price)}</strong></div>
      <div class="qty">
        <button data-key="${esc(l.key)}" data-d="-1">−</button><span>${l.quantity}</span><button data-key="${esc(l.key)}" data-d="1">+</button>
        <button class="rm" data-key="${esc(l.key)}" data-d="0" title="Remover">✕</button>
      </div>
    </div>`).join('') : '<p class="empty">Seu carrinho está vazio.</p>';
  $('#totals').innerHTML = quote ? `
    <div><span>Subtotal</span><span>${fmt(quote.subtotal)}</span></div>
    ${quote.discount ? `<div class="ok"><span>Desconto</span><span>− ${fmt(quote.discount)}</span></div>` : ''}
    <div><span>Frete</span><span>${quote.shipping ? fmt(quote.shipping) : 'informe o CEP'}</span></div>
    <div class="total"><span>Total</span><span>${fmt(quote.total)}</span></div>` : '';
  $('#cartMsg').textContent = cartMsg;
  $('#goCheckout').disabled = !quote;
}

function openCheckout() {
  if (!quote) return;
  const f = $('#checkoutForm');
  f.hidden = false;
  $('#successBox').hidden = true;
  $('#checkoutMsg').textContent = '';
  f.elements.zip.value = cep;
  $('#checkoutTotal').textContent = fmt(quote.total);
  $('#cartDlg').close();
  $('#checkoutDlg').showModal();
}

// ----- Eventos -----
$('#categories').onclick = (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  category = b.dataset.cat;
  renderChips();
  loadProducts();
};
$('#products').onclick = (e) => {
  const add = e.target.closest('[data-add]');
  const view = e.target.closest('[data-view]');
  if (add) addToCart(products.find((p) => p.id === add.dataset.add));
  else if (view) openDetail(view.dataset.view);
};
$('#search').oninput = loadProducts;
$('#sort').onchange = loadProducts;
$('#maxPrice').oninput = (e) => {
  $('#priceLabel').textContent = fmt(e.target.value);
  loadProducts();
};

$('#cartBtn').onclick = () => {
  renderCart();
  $('#cartDlg').showModal();
};
$('#cartItems').onclick = (e) => {
  const b = e.target.closest('[data-key]');
  if (!b) return;
  const line = cart.find((l) => l.key === b.dataset.key);
  line.quantity = Number(b.dataset.d) ? line.quantity + Number(b.dataset.d) : 0;
  cart = cart.filter((l) => l.quantity > 0);
  refreshCart();
};
$('#applyCoupon').onclick = async () => {
  coupon = $('#coupon').value.trim();
  await refreshCart();
  if (coupon) toast(quote?.couponApplied ? 'Cupom aplicado!' : 'Cupom inválido. Tente "DARK10".');
};
$('#calcShip').onclick = async () => {
  cep = $('#cepCart').value.trim();
  if (digits(cep).length !== 8) return toast('Informe um CEP com 8 dígitos.');
  await refreshCart();
};
$('#goCheckout').onclick = openCheckout;

$('#checkoutForm').elements.zip.onchange = async (e) => {
  cep = e.target.value.trim();
  await refreshCart();
  if (quote) $('#checkoutTotal').textContent = fmt(quote.total);
};

$('#checkoutForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('[type=submit]');
  const v = Object.fromEntries(new FormData(f));
  btn.disabled = true;
  try {
    const { order } = await api('/orders', {
      method: 'POST',
      body: {
        customer: { name: v.name, email: v.email, cpf: v.cpf, zip: v.zip, address: v.address, number: v.number, city: v.city },
        items: lineItems(),
        couponCode: coupon,
        paymentMethod: v.paymentMethod
      }
    });
    cart = [];
    coupon = '';
    cep = '';
    $('#coupon').value = '';
    $('#cepCart').value = '';
    await refreshCart();
    f.hidden = true;
    $('#successBox').hidden = false;
    $('#successBox').innerHTML = `
      <h3>Pedido realizado!</h3>
      <p>Número do pedido: <b>${esc(order.orderNumber)}</b></p>
      <p class="muted">Guarde este número para acompanhar sua compra.</p>
      <button class="btn primary" data-close>Voltar à loja</button>`;
  } catch (err) {
    $('#checkoutMsg').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
};

document.addEventListener('click', (e) => {
  const close = e.target.closest('[data-close]');
  if (close) close.closest('dialog').close();
  else if (e.target.tagName === 'DIALOG') e.target.close();
});

// ----- Início -----
renderChips();
loadProducts();
refreshCart();
