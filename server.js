import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.resolve(process.env.PUBLIC_DIR || '.');
const MP_TOKEN = String(process.env.MP_ACCESS_TOKEN || '').trim();
const BASE_URL = String(process.env.BASE_URL || '').replace(/\/$/, '');
const ORDERS_FILE = path.resolve(process.env.ORDERS_FILE || 'data/orders.json');

if (!BASE_URL) console.warn('BASE_URL não configurada. O checkout real não poderá criar preferências.');
fs.mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(PUBLIC));

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
  catch { return []; }
}
function writeOrders(value) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(value, null, 2));
}

app.post('/api/create-preference', async (req, res) => {
  try {
    if (!MP_TOKEN) return res.status(503).json({ error: 'Mercado Pago ainda não está configurado no servidor.' });
    if (!BASE_URL || !/^https:\/\//i.test(BASE_URL)) {
      return res.status(503).json({ error: 'BASE_URL precisa ser a URL HTTPS pública do site.' });
    }

    const b = req.body || {};
    const title = clean(b.title, 120);
    const description = clean(b.description, 300);
    const unitPrice = Number(b.unitPrice);
    const quantity = Math.max(1, Math.min(99, Number(b.quantity) || 1));
    const customer = clean(b.customer, 120);
    const phone = clean(b.phone, 40);
    const email = clean(b.email, 160);

    if (!title || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({ error: 'Produto ou preço inválido.' });
    }
    if (!customer || !phone) {
      return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });
    }

    const orderId = crypto.randomUUID();
    const digits = phone.replace(/\D/g, '');
    const payer = { name: customer };
    if (email) payer.email = email;
    if (digits.length >= 8) {
      payer.phone = {
        area_code: digits.slice(0, 2),
        number: digits.slice(2)
      };
    }

    const preference = {
      external_reference: orderId,
      items: [{
        id: clean(b.productId, 100) || orderId,
        title,
        description,
        quantity,
        unit_price: Number(unitPrice.toFixed(2)),
        currency_id: 'BRL'
      }],
      payer,
      back_urls: {
        success: `${BASE_URL}/pedido.html?status=success&order=${encodeURIComponent(orderId)}`,
        failure: `${BASE_URL}/pedido.html?status=failure&order=${encodeURIComponent(orderId)}`,
        pending: `${BASE_URL}/pedido.html?status=pending&order=${encodeURIComponent(orderId)}`
      },
      auto_return: 'approved',
      notification_url: `${BASE_URL}/api/webhook/mercadopago`,
      payment_methods: { installments: 12 }
    };

    // Não colocamos o Access Token no navegador. Ele fica somente no servidor.
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const data = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok) {
      console.error('Mercado Pago:', data);
      return res.status(502).json({ error: 'Mercado Pago recusou a preferência de pagamento.' });
    }

    const orders = readOrders();
    orders.push({
      id: orderId,
      preferenceId: data.id,
      status: 'pending',
      product: title,
      quantity,
      unitPrice: Number(unitPrice.toFixed(2)),
      total: Number((unitPrice * quantity).toFixed(2)),
      customer,
      phone,
      email,
      createdAt: new Date().toISOString()
    });
    writeOrders(orders);

    return res.json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      orderId
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao criar o pagamento.' });
  }
});

app.post('/api/webhook/mercadopago', async (req, res) => {
  // Respondemos rapidamente; o processamento pode continuar depois.
  res.sendStatus(200);
  try {
    const type = req.body?.type || req.query?.type;
    const paymentId = req.body?.data?.id || req.query?.['data.id'];
    if (type !== 'payment' || !paymentId || !MP_TOKEN) return;

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` }
    });
    if (!response.ok) return;

    const payment = await response.json();
    const reference = payment.external_reference;
    if (!reference) return;

    const orders = readOrders();
    const order = orders.find(item => item.id === reference);
    if (order) {
      order.status = payment.status || order.status;
      order.paymentId = String(paymentId);
      order.updatedAt = new Date().toISOString();
      writeOrders(orders);
    }
  } catch (error) {
    console.error('Webhook Mercado Pago:', error);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mercadoPagoConfigured: Boolean(MP_TOKEN) });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pesos e Medidas rodando na porta ${PORT}`);
});
