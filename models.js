const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const opts = () => ({ timestamps: true, toJSON: { virtuals: true, versionKey: false } });

const productSchema = new Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ['Hardware', 'Wearables', 'Áudio', 'Acessórios'] },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, min: 0, default: null },
  rating: { type: Number, default: 5, min: 0, max: 5 },
  reviewsCount: { type: Number, default: 0, min: 0 },
  badge: { type: String, trim: true, default: '' },
  stockCount: { type: Number, default: 0, min: 0 },
  image: { type: String, required: true },
  description: { type: String, default: '' },
  variants: { type: [String], default: ['Padrão'] },
  sizes: { type: [String], default: ['Único'] }
}, opts());

productSchema.virtual('inStock').get(function () { return this.stockCount > 0; });

const orderSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true },
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    cpf: String,
    zip: { type: String, required: true },
    address: String,
    number: String,
    city: String
  },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    variant: String,
    size: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true }
  }],
  subtotal: Number,
  discount: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total: Number,
  couponCode: { type: String, default: '' },
  paymentMethod: { type: String, required: true, enum: ['PIX', 'Cartão de Crédito', 'Boleto'] },
  status: { type: String, enum: ['Pendente', 'Processando', 'Enviado', 'Cancelado'], default: 'Processando' }
}, opts());

module.exports = { Product: model('Product', productSchema), Order: model('Order', orderSchema) };
