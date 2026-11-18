require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const api = require('./routes');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use('/api', api);
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
app.use((err, req, res, next) => {
  const status = err.status || (['ValidationError', 'CastError'].includes(err.name) ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Erro interno do servidor' : err.message });
});

const { PORT = 3000, MONGODB_URI } = process.env;
if (!MONGODB_URI) {
  console.error('Defina MONGODB_URI no arquivo .env');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB conectado');
    app.listen(PORT, () => console.log(`Loja: http://localhost:${PORT} | Admin: /admin.html`));
  })
  .catch((err) => {
    console.error('Falha ao conectar no MongoDB:', err.message);
    process.exit(1);
  });
