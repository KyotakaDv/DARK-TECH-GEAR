const express = require('express');
const crypto = require('crypto');
const { Product, Order } = require('./models');

const router = express.Router();

// Regras de negócio (ajuste aqui)
const COUPONS = { DARK10: 0.1 };   // código -> % de desconto
const SHIPPING_FLAT = 25;          // frete fixo com CEP válido (R$)
const PAYMENTS = { pix: 'PIX', credit: 'Cartão de Crédito', boleto: 'Boleto' };
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=800';

const round = (n) => Math.round(n * 100) / 100;
const digits = (s) => String(s || '').replace(/\D/g, '');
const fail = (status, message) => Object.assign(new Error(message), { status });
const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const list = (v, fallback) => {
  const items = (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean);
  return items.length ? items : fallback;
};

// Painel admin: exige o header x-admin-token igual ao ADMIN_TOKEN (sem token definido, nada passa)
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN || '';
  const given = req.get('x-admin-token') || '';
  const ok = expected.length > 0 && given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'Não autorizado' });
  next();
}

// Calcula tudo no servidor: o cliente nunca define preço, desconto ou frete
async function priceOrder(items, couponCode, cep) {
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Carrinho vazio');
  const products = await Product.find({ _id: { $in: items.map((i) => i?.productId) } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = items.map((i) => {
    const p = byId.get(String(i?.productId));
    const quantity = Number(i?.quantity);
    if (!p) throw fail(400, 'Há um produto inválido no carrinho');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw fail(400, 'Quantidade inválida');
    if (p.stockCount < quantity) throw fail(400, `Estoque insuficiente para "${p.name}"`);
    return {
      product: p,
      quantity,
      variant: p.variants.includes(i.variant) ? i.variant : p.variants[0],
      size: p.sizes.includes(i.size) ? i.size : p.sizes[0]
    };
  });

  const subtotal = round(lines.reduce((s, l) => s + l.product.price * l.quantity, 0));
  const code = String(couponCode || '').trim().toUpperCase();
  const rate = COUPONS[code] || 0;
  const discount = round(subtotal * rate);
  const shipping = digits(cep).length === 8 ? SHIPPING_FLAT : 0;
  return {
    lines, subtotal, discount, shipping,
    total: round(subtotal - discount + shipping),
    couponCode: rate ? code : '',
    couponApplied: rate > 0
  };
}

// ----- Vitrine e checkout (públicos) -----
router.get('/products', async (req, res) => {
  const { category, search, maxPrice, sort } = req.query;
  const filter = {};
  if (category && category !== 'Todos') filter.category = String(category);
  if (search) filter.$or = [{ name: rx(search) }, { description: rx(search) }];
  if (maxPrice) filter.price = { $lte: Number(maxPrice) };
  const sorts = { 'price-asc': { price: 1 }, 'price-desc': { price: -1 }, rating: { rating: -1 } };
  res.json(await Product.find(filter).sort(sorts[sort] || { createdAt: -1 }));
});

router.post('/quote', async (req, res) => {
  const b = req.body || {};
  const { lines, ...totals } = await priceOrder(b.items, b.couponCode, b.cep);
  res.json(totals);
});

router.post('/orders', async (req, res) => {
  const b = req.body || {};
  const c = b.customer || {};
  const name = String(c.name || '').trim();
  const email = String(c.email || '').trim().toLowerCase();
  const zip = digits(c.zip);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || zip.length !== 8) {
    throw fail(400, 'Preencha nome, e-mail válido e CEP com 8 dígitos');
  }
  const paymentMethod = PAYMENTS[b.paymentMethod];
  if (!paymentMethod) throw fail(400, 'Forma de pagamento inválida');

  const q = await priceOrder(b.items, b.couponCode, zip);
  const reserved = [];
  try {
    // Baixa de estoque atômica: só desconta se ainda houver quantidade suficiente
    for (const l of q.lines) {
      const r = await Product.updateOne(
        { _id: l.product._id, stockCount: { $gte: l.quantity } },
        { $inc: { stockCount: -l.quantity } }
      );
      if (r.modifiedCount !== 1) throw fail(409, `Estoque insuficiente para "${l.product.name}"`);
      reserved.push(l);
    }
    const order = await Order.create({
      orderNumber: 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      customer: { name, email, cpf: c.cpf, zip, address: c.address, number: c.number, city: c.city },
      items: q.lines.map((l) => ({
        product: l.product._id, name: l.product.name, variant: l.variant, size: l.size,
        quantity: l.quantity, unitPrice: l.product.price
      })),
      subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, total: q.total,
      couponCode: q.couponCode, paymentMethod
    });
    res.status(201).json({ success: true, order });
  } catch (err) {
    // Devolve o estoque já baixado se algo falhar no meio do caminho
    await Promise.all(reserved.map((l) => Product.updateOne({ _id: l.product._id }, { $inc: { stockCount: l.quantity } })));
    throw err;
  }
});

// ----- Painel admin (protegido por token) -----
const productData = (b) => ({
  name: String(b.name || '').trim(),
  category: b.category,
  price: Number(b.price),
  originalPrice: b.originalPrice ? Number(b.originalPrice) : null,
  badge: String(b.badge || '').trim(),
  image: b.image || DEFAULT_IMG,
  description: String(b.description || '').trim(),
  stockCount: Number(b.stockCount) || 0,
  variants: list(b.variants, ['Padrão']),
  sizes: list(b.sizes, ['Único'])
});

router.get('/admin/orders', requireAdmin, async (req, res) => {
  res.json(await Order.find().sort({ createdAt: -1 }).limit(300));
});

router.post('/admin/products', requireAdmin, async (req, res) => {
  res.status(201).json(await Product.create(productData(req.body || {})));
});

router.put('/admin/products/:id', requireAdmin, async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, productData(req.body || {}), { new: true, runValidators: true });
  if (!p) throw fail(404, 'Produto não encontrado');
  res.json(p);
});

router.delete('/admin/products/:id', requireAdmin, async (req, res) => {
  const p = await Product.findByIdAndDelete(req.params.id);
  if (!p) throw fail(404, 'Produto não encontrado');
  res.json({ success: true });
});

router.patch('/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw fail(404, 'Pedido não encontrado');
  const status = (req.body || {}).status;
  if (!Order.schema.path('status').enumValues.includes(status)) throw fail(400, 'Status inválido');
  if (order.status === 'Cancelado' && status !== 'Cancelado') throw fail(400, 'Pedido cancelado não pode ser reativado');
  if (status === 'Cancelado' && order.status !== 'Cancelado') {
    // Ao cancelar, devolve os itens ao estoque
    await Promise.all(order.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stockCount: i.quantity } })));
  }
  order.status = status;
  await order.save();
  res.json(order);
});

module.exports = router;
