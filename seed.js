require('dotenv').config();
const mongoose = require('mongoose');
const { Product } = require('./models');

const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=800`;
const SEED = [
  { name: 'CyberDeck X-1 Neural Interface', category: 'Hardware', price: 3499, originalPrice: 3999, rating: 4.9, reviewsCount: 42, badge: 'Promoção', stockCount: 8, image: img('1544716278-ca5e3f4abd8c'), description: 'Computador portátil em chassi de titânio, switches óptico-mecânicos e display OLED HUD.', variants: ['Dark Matte', 'Neon Cyan Edition'], sizes: ['Standard', 'Pro Specs'] },
  { name: 'AeroStealth Cyber Jacket v2', category: 'Wearables', price: 890, rating: 4.8, reviewsCount: 19, badge: 'Novo', stockCount: 15, image: img('1551028719-00167b16eac5'), description: 'Jaqueta impermeável com condutores térmicos e 12 bolsos magnéticos.', variants: ['Obsidian Black', 'Cyber Violet'], sizes: ['P', 'M', 'G', 'GG'] },
  { name: 'Pulse ANC Wireless Earbuds', category: 'Áudio', price: 649.9, originalPrice: 799, rating: 4.7, reviewsCount: 88, badge: 'Mais Vendido', stockCount: 22, image: img('1590658268037-6bf12165a8df'), description: 'Fones com cancelamento ativo de ruído (-45dB) e áudio espacial.', variants: ['Matt Black', 'Chrono Silver'], sizes: ['Único'] },
  { name: 'Spectra HUD Smart Glasses', category: 'Hardware', price: 1899, rating: 4.9, reviewsCount: 31, badge: 'Novo', stockCount: 5, image: img('1572635196237-14b3f281503f'), description: 'Óculos com projeção Micro-LED, Bluetooth 5.4, GPS e comandos por gestos.', variants: ['Midnight Gray', 'Vaporware Pink'], sizes: ['Standard'] },
  { name: 'NeoGrip Ergonomic Mechanical Pad', category: 'Acessórios', price: 380, originalPrice: 450, rating: 4.6, reviewsCount: 14, badge: 'Promoção', stockCount: 12, image: img('1618384887929-16ec33fab9ef'), description: 'Teclado tático com RGB por tecla e switches hotswap lubrificados.', variants: ['Full Stealth', 'Transparent Purple'], sizes: ['Único'] },
  { name: 'Titanium Modular Backpack 25L', category: 'Wearables', price: 720, rating: 4.8, reviewsCount: 27, badge: '', stockCount: 0, image: img('1553062407-98eeb64c6a62'), description: 'Mochila com proteção RFID, trava biométrica e carregador solar.', variants: ['Charcoal Black'], sizes: ['25 L'] }
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await Product.countDocuments();
  if (existing && !process.argv.includes('--force')) {
    console.log(`Já existem ${existing} produtos. Use "npm run seed -- --force" para apagar e recriar.`);
  } else {
    await Product.deleteMany({});
    await Product.insertMany(SEED);
    console.log(`${SEED.length} produtos inseridos.`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Erro no seed:', err.message);
  process.exit(1);
});
