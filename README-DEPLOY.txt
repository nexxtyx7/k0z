PESOS E MEDIDAS — PACOTE COMPLETO

ARQUIVOS
- index.html       loja pública
- checkout.html    checkout que chama o backend
- pedido.html      retorno após o Mercado Pago
- admin.html       painel local do dono
- server.js        backend Node/Express + Mercado Pago
- package.json     dependências
- .env.example     exemplo das variáveis secretas
- render.yaml      configuração do Web Service Render
- .gitignore       evita enviar segredos e node_modules
- data/orders.example.json  modelo de pedidos

IMPORTANTE
1. O admin.html ainda usa localStorage. Isso significa que os produtos editados ficam no navegador daquele aparelho. Não é um painel online multi-dispositivo.
2. O pagamento real usa o Mercado Pago no backend. O Access Token NUNCA deve ser colocado no HTML.
3. Comece com credenciais de teste do Mercado Pago.
4. Para produção, troque pelo Access Token de produção depois de testar.
5. O arquivo data/orders.json não é um banco de dados. Em Render, sem disco persistente/banco externo, ele pode ser perdido em reinícios/redeploys. O pagamento não deve depender desse arquivo para provar que uma transação foi paga; use as notificações/status do Mercado Pago.

RENDER
Tipo: Web Service (não Static Site)
Build Command: npm install
Start Command: npm start

ENVIRONMENT VARIABLES
MP_ACCESS_TOKEN = seu Access Token do Mercado Pago
BASE_URL = https://SEU-SERVICO.onrender.com

Depois do deploy, teste:
https://SEU-SERVICO.onrender.com/api/health

Deve aparecer JSON com ok:true. mercadoPagoConfigured ficará true quando o Access Token estiver configurado.

MERCADO PAGO
- Crie/abra sua aplicação no Mercado Pago.
- Para teste, use o Access Token de teste.
- Depois de configurar BASE_URL, o backend cria a preferência em /api/create-preference.
- O cliente é redirecionado ao ambiente do Mercado Pago, onde as formas de pagamento disponíveis aparecem.
- O webhook fica em /api/webhook/mercadopago.

SEGURANÇA
Não coloque .env no GitHub.
Não publique o Access Token.
Não use a senha demo do painel local como se fosse autenticação de produção.
