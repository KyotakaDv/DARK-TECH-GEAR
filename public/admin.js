const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KEY = 'darkgear_admin_token';
const STATUSES = ['Pendente', 'Processando', 'Enviado', 'Cancelado'];
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=800';

let token = sessionStorage.getItem(KEY) || '';
let tab = 'products';
let products = [], orders = [];

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Erro na requisição');
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2800);
}

async function loadAll() {
  [products, orders] = await Promise.all([api('/products'), api('/admin/orders')]);
  render();
}

function showPanel(on) {
  $('#login').hidden = on;
  $('#panel').hidden = !on;
  $('#logout').hidden = !on;
}

function render() {
  const revenue = orders.filter((o) => o.status !== 'Cancelado').reduce((s, o) => s + o.total, 0);
  $('#stats').innerHTML = [
    ['Produtos', products.length],
    ['Sem estoque', products.filter((p) => p.stockCount <= 0).length],
    ['Pedidos', orders.length],
    ['Faturamento', fmt(revenue)]
  ].map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('');
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#newProduct').hidden = tab !== 'products';
  $('#table').innerHTML = tab === 'products' ? productsTable() : ordersTable();
}

function productsTable() {
  const head = '<thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Badge</th><th></th></tr></thead>';
  const rows = products.map((p) => `
    <tr>
      <td><div class="prod"><img src="${esc(p.image)}" alt=""><div><b>${esc(p.name)}</b><small>ID ${p.id}</small></div></div></td>
      <td>${esc(p.category)}</td>
      <td class="mono">${fmt(p.price)}</td>
      <td><span class="pill ${p.stockCount > 0 ? '' : 'bad'}">${p.stockCount} un</span></td>
      <td>${esc(p.badge || '—')}</td>
      <td class="right">
        <button class="btn ghost sm" data-edit="${p.id}">Editar</button>
        <button class="btn danger sm" data-del="${p.id}">Excluir</button>
      </td>
    </tr>`).join('');
  return head + `<tbody>${rows || '<tr><td colspan="6" class="empty">Nenhum produto cadastrado.</td></tr>'}</tbody>`;
}

function ordersTable() {
  const head = '<thead><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Pagamento</th><th>Status</th></tr></thead>';
  const rows = orders.map((o) => `
    <tr>
      <td class="mono"><b>${esc(o.orderNumber)}</b><small>${new Date(o.createdAt).toLocaleString('pt-BR')}</small></td>
      <td><b>${esc(o.customer.name)}</b><small>${esc(o.customer.email)}</small></td>
      <td class="small">${o.items.map((i) => `${i.quantity}× ${esc(i.name)}`).join('<br>')}</td>
      <td class="mono"><b>${fmt(o.total)}</b></td>
      <td>${esc(o.paymentMethod)}</td>
      <td><select data-status="${o.id}">${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
    </tr>`).join('');
  return head + `<tbody>${rows || '<tr><td colspan="6" class="empty">Nenhum pedido ainda.</td></tr>'}</tbody>`;
}

function openProduct(p) {
  const f = $('#prodForm');
  f.reset();
  $('#prodMsg').textContent = '';
  $('#prodTitle').textContent = p ? 'Editar produto' : 'Novo produto';
  const d = p
    ? { ...p, originalPrice: p.originalPrice ?? '', variants: p.variants.join(', '), sizes: p.sizes.join(', ') }
    : { category: 'Hardware', stockCount: 10, image: DEFAULT_IMG, variants: 'Padrão', sizes: 'Único' };
  ['name', 'category', 'price', 'originalPrice', 'stockCount', 'badge', 'image', 'variants', 'sizes', 'description']
    .forEach((k) => (f.elements[k].value = d[k] ?? ''));
  f.elements.pid.value = p ? p.id : '';
  $('#prodDlg').showModal();
}

async function deleteProduct(id) {
  const p = products.find((x) => x.id === id);
  if (!confirm(`Excluir "${p?.name}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await api(`/admin/products/${id}`, { method: 'DELETE' });
    toast('Produto excluído.');
  } catch (err) { toast(err.message); }
  await loadAll();
}

// ----- Eventos -----
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  token = $('#token').value.trim();
  try {
    await loadAll();
    sessionStorage.setItem(KEY, token);
    showPanel(true);
  } catch (err) {
    token = '';
    $('#loginMsg').textContent = err.status === 401 ? 'Token inválido.' : err.message;
  }
};
$('#logout').onclick = () => {
  sessionStorage.removeItem(KEY);
  token = '';
  showPanel(false);
};
$('.tabs').onclick = (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) {
    tab = b.dataset.tab;
    render();
  }
};
$('#newProduct').onclick = () => openProduct();
$('#table').onclick = (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (edit) openProduct(products.find((p) => p.id === edit.dataset.edit));
  if (del) deleteProduct(del.dataset.del);
};
$('#table').onchange = async (e) => {
  const sel = e.target.closest('[data-status]');
  if (!sel) return;
  try {
    await api(`/admin/orders/${sel.dataset.status}/status`, { method: 'PATCH', body: { status: sel.value } });
    toast('Status atualizado.');
  } catch (err) { toast(err.message); }
  await loadAll();
};
$('#prodForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('.primary');
  const body = Object.fromEntries(new FormData(f));
  const id = body.pid;
  delete body.pid;
  btn.disabled = true;
  try {
    await api(id ? `/admin/products/${id}` : '/admin/products', { method: id ? 'PUT' : 'POST', body });
    $('#prodDlg').close();
    toast(id ? 'Produto atualizado.' : 'Produto criado.');
    await loadAll();
  } catch (err) {
    $('#prodMsg').textContent = err.message;
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
if (token) {
  loadAll().then(() => showPanel(true)).catch(() => {
    token = '';
    sessionStorage.removeItem(KEY);
  });
}
