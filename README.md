# DARKGEAR: Loja + Painel Admin

Node.js + Express + MongoDB (Mongoose). Front-end em HTML/CSS/JS puro, servido pelo próprio Express.

## Rodando
1. Instale Node.js 18+ e tenha um MongoDB (local ou MongoDB Atlas).
2. `cp .env.example .env` e preencha:
   - `MONGODB_URI`: sua string de conexão do banco (é aqui que você conecta)
   - `ADMIN_TOKEN`: senha do painel admin
3. `npm install`
4. `npm run seed` (cria os produtos de exemplo; `npm run seed -- --force` recria)
5. `npm start`

Loja: http://localhost:3000 · Admin: http://localhost:3000/admin.html

## Arquivos
- `server.js`: servidor, conexão com o MongoDB e arquivos estáticos
- `models.js`: schemas Product e Order
- `routes.js`: API (vitrine, orçamento, pedidos e admin) e regras de cupom e frete
- `seed.js`: produtos iniciais
- `public/`: loja (`index.html`, `shop.js`), admin (`admin.html`, `admin.js`) e `style.css`

## Notas
- Preço, desconto e frete são calculados no servidor.
- O pagamento é simulado. Integre um gateway (Mercado Pago, Pagar.me, Stripe) antes de vender de verdade.
- Antes de publicar: troque o `ADMIN_TOKEN`, use HTTPS e adicione rate limit.
