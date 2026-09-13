var http = require('http');
var fs = require('fs');
var path = require('path');
var WebSocket = require('ws');
var { Pool } = require('pg');
var { MercadoPagoConfig, Payment } = require('mercadopago');

// ============================================================
// VENDEDOR/ADMIN FIXO
// ============================================================
var ADMIN_USER = {
  id: 'admin_fixed_001',
  username: 'redzin',
  email: 'redzin@redzinmarket.com',
  phone: '',
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=RZ',
  pixKey: '',
  isSeller: 1,
  isAdmin: 1
};
// ============================================================

var PORT = process.env.PORT || 3000;
var PUBLIC_URL = process.env.REPLIT_URL || ('http://localhost:' + PORT);
var UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ============================================================
// POSTGRES
// ============================================================
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  var c = await pool.connect();
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT, phone TEXT, avatar TEXT, pixKey TEXT,
        isSeller INTEGER DEFAULT 0, isAdmin INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, sellerId TEXT NOT NULL, title TEXT NOT NULL,
        description TEXT, price REAL NOT NULL, originalPrice REAL,
        stock INTEGER DEFAULT 0, category TEXT,
        images TEXT DEFAULT '[]', sold INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS coupons (
        id TEXT PRIMARY KEY, sellerId TEXT NOT NULL, code TEXT NOT NULL,
        discount INTEGER NOT NULL, maxUses INTEGER NOT NULL,
        uses INTEGER DEFAULT 0, description TEXT,
        active INTEGER DEFAULT 1, createdAt TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, buyerId TEXT NOT NULL, sellerId TEXT NOT NULL,
        productId TEXT NOT NULL, productTitle TEXT, quantity INTEGER DEFAULT 1,
        total REAL NOT NULL, status TEXT DEFAULT 'pending_payment',
        address TEXT DEFAULT '{}', tracking TEXT DEFAULT '[]',
        couponCode TEXT, paymentId TEXT,
        createdAt TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, userId TEXT NOT NULL, type TEXT,
        message TEXT NOT NULL, orderId TEXT, read INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id TEXT PRIMARY KEY, participants TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY, roomId TEXT NOT NULL,
        senderId TEXT NOT NULL, text TEXT NOT NULL,
        read INTEGER DEFAULT 0, createdAt TIMESTAMP DEFAULT NOW()
      );
    `);
    var r = await c.query('SELECT id FROM users WHERE id = $1', [ADMIN_USER.id]);
    if (r.rows.length === 0) {
      await c.query(
        'INSERT INTO users (id,username,email,phone,avatar,pixKey,isSeller,isAdmin) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [ADMIN_USER.id, ADMIN_USER.username, ADMIN_USER.email, ADMIN_USER.phone,
         ADMIN_USER.avatar, ADMIN_USER.pixKey, 1, 1]
      );
      console.log('✅ Admin criado:', ADMIN_USER.username);
    }
    console.log('✅ Banco pronto.');
  } finally { c.release(); }
}

initDB().catch(function(e) { console.error('❌ DB:', e.message); process.exit(1); });

// ============================================================
// MERCADO PAGO
// ============================================================
var mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' });
var mpPayment = new Payment(mpClient);

// ============================================================
// HELPERS
// ============================================================
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function parseBody(req) {
  return new Promise(function(resolve) {
    var b = '';
    req.on('data', function(ch) { b += ch; });
    req.on('end', function() { try { resolve(JSON.parse(b)); } catch(e) { resolve(b); } });
  });
}
function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
var MIME = {
  '.html':'text/html','.js':'application/javascript','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.svg':'image/svg+xml'
};

// ============================================================
// HTTP SERVER
// ============================================================
var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  var u = req.url.split('?')[0];

  // ---------- AUTH ----------
  if (req.method === 'POST' && u === '/api/register') {
    parseBody(req).then(async function(b) {
      try {
        if (!b.username || b.username.trim().length < 3)
          return json(res, { error: 'Nome muito curto (mín. 3)' }, 400);
        var ex = await pool.query('SELECT id FROM users WHERE LOWER(username)=LOWER($1)', [b.username]);
        if (ex.rows.length) return json(res, { error: 'Usuário já existe' }, 400);
        await pool.query(
          'INSERT INTO users (id,username,email,phone,avatar,pixKey,isSeller,isAdmin) VALUES ($1,$2,$3,$4,$5,$6,0,0)',
          [b.id, b.username, b.email||null, b.phone||null, b.avatar||null, b.pixKey||null]
        );
        var r = await pool.query('SELECT * FROM users WHERE id=$1', [b.id]);
        json(res, { success: true, user: r.rows[0] });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (req.method === 'POST' && u === '/api/login') {
    parseBody(req).then(async function(b) {
      try {
        var r = await pool.query('SELECT * FROM users WHERE LOWER(username)=LOWER($1)', [b.username]);
        if (!r.rows.length) return json(res, { error: 'Usuário não encontrado' }, 404);
        json(res, { success: true, user: r.rows[0] });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (req.method === 'GET' && u === '/api/users') {
    pool.query('SELECT * FROM users ORDER BY createdAt DESC')
      .then(function(r) { json(res, { users: r.rows }); })
      .catch(function(e) { json(res, { error: e.message }, 500); });
    return;
  }

  if (req.method === 'POST' && u === '/api/update-user') {
    parseBody(req).then(async function(b) {
      try {
        await pool.query(
          'UPDATE users SET email=$1, phone=$2, avatar=$3, pixKey=$4 WHERE id=$5',
          [b.email, b.phone, b.avatar, b.pixKey, b.userId]
        );
        var r = await pool.query('SELECT * FROM users WHERE id=$1', [b.userId]);
        json(res, { success: true, user: r.rows[0] });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (req.method === 'POST' && u === '/api/promote') {
    parseBody(req).then(async function(b) {
      try {
        var admin = await pool.query('SELECT isAdmin FROM users WHERE id=$1', [b.requesterId]);
        if (!admin.rows.length || !admin.rows[0].isadmin)
          return json(res, { error: 'Sem permissão' }, 403);
        await pool.query('UPDATE users SET isSeller=$1 WHERE id=$2', [b.promote ? 1 : 0, b.targetUserId]);
        var r = await pool.query('SELECT * FROM users WHERE id=$1', [b.targetUserId]);
        json(res, { success: true, user: r.rows[0] });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  // ---------- PRODUCTS ----------
  if (req.method === 'GET' && u === '/api/products') {
    pool.query('SELECT * FROM products ORDER BY createdAt DESC')
      .then(function(r) {
        var ps = r.rows.map(function(p) { p.images = JSON.parse(p.images || '[]'); return p; });
        json(res, { products: ps });
      })
      .catch(function(e) { json(res, { error: e.message }, 500); });
    return;
  }

  if (req.method === 'POST' && u === '/api/product/create') {
    parseBody(req).then(async function(b) {
      try {
        await pool.query(
          'INSERT INTO products (id,sellerId,title,description,price,originalPrice,stock,category,images) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [b.id, b.sellerId, b.title, b.description, b.price, b.originalPrice||null, b.stock, b.category, JSON.stringify(b.images||[])]
        );
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (req.method === 'POST' && u === '/api/product/update') {
    parseBody(req).then(async function(b) {
      try {
        await pool.query(
          'UPDATE products SET title=$1, description=$2, price=$3, originalPrice=$4, stock=$5, category=$6, images=$7 WHERE id=$8 AND sellerId=$9',
          [b.title, b.description, b.price, b.originalPrice||null, b.stock, b.category, JSON.stringify(b.images||[]), b.id, b.sellerId]
        );
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (req.method === 'POST' && u === '/api/product/delete') {
    parseBody(req).then(async function(b) {
      try {
        await pool.query('DELETE FROM products WHERE id=$1 AND sellerId=$2', [b.id, b.sellerId]);
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  // ---------- COUPONS ----------
  if (req.method === 'GET' && u === '/api/coupons') {
    var sellerId = new URL(req.url, 'http://x').searchParams.get('sellerId');
    if (!sellerId) return json(res, { coupons: [] });
    pool.query('SELECT * FROM coupons WHERE sellerId=$1 ORDER BY createdAt DESC', [sellerId])
      .then(function(r) { json(res, { coupons: r.rows }); })
      .catch(function(e) { json(res, { error: e.message }, 500); });
    return;
  }

  if (req.method === 'POST' && u === '/api/coupon/validate') {
    parseBody(req).then(async function(b) {
      try {
        var r = await pool.query('SELECT * FROM coupons WHERE UPPER(code)=UPPER($1) AND sellerId=$2', [b.code, b.sellerId]);
        if (!r.rows.length) return json(res, { valid: false, error: 'Cupom inválido' });
        var c = r.rows[0];
        if (!c.active) return json(res, { valid: false, error: 'Cupom inativo' });
        if (c.uses >= c.maxuses) return json(res, { valid: false, error: 'Cupom esgotado' });
        json(res, { valid: true, coupon: c });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (req.method === 'POST' && u === '/api/coupon/create') {
    parseBody(req).then(async function(b) {
      try {
        await pool.query(
          'INSERT INTO coupons (id,sellerId,code,discount,maxUses,description,active) VALUES ($1,$2,UPPER($3),$4,$5,$6,1)',
          [b.id, b.sellerId, b.code, b.discount, b.maxUses, b.description||null]
        );
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (req.method === 'POST' && u === '/api/coupon/toggle') {
    parseBody(req).then(async function(b) {
      try {
        await pool.query('UPDATE coupons SET active=$1 WHERE id=$2', [b.active ? 1 : 0, b.id]);
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (req.method === 'POST' && u === '/api/coupon/delete') {
    parseBody(req).then(async function(b) {
      try {
        await pool.query('DELETE FROM coupons WHERE id=$1', [b.id]);
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  // ---------- ORDERS ----------
  if (req.method === 'GET' && u === '/api/orders') {
    var params = new URL(req.url, 'http://x').searchParams;
    var buyerId = params.get('buyerId');
    var sellerId2 = params.get('sellerId');
    var q, p;
    if (buyerId) { q = 'SELECT * FROM orders WHERE buyerId=$1 ORDER BY createdAt DESC'; p = [buyerId]; }
    else if (sellerId2) { q = 'SELECT * FROM orders WHERE sellerId=$1 ORDER BY createdAt DESC'; p = [sellerId2]; }
    else { q = 'SELECT * FROM orders ORDER BY createdAt DESC'; p = []; }
    pool.query(q, p).then(function(r) {
      var os = r.rows.map(function(o) {
        o.tracking = JSON.parse(o.tracking || '[]');
        o.address = JSON.parse(o.address || '{}');
        return o;
      });
      json(res, { orders: os });
    }).catch(function(e) { json(res, { error: e.message }, 500); });
    return;
  }

  // ---------- CHECKOUT / PAYMENT ----------
  if (req.method === 'POST' && u === '/api/checkout') {
    parseBody(req).then(async function(b) {
      try {
        var prodR = await pool.query('SELECT * FROM products WHERE id=$1', [b.productId]);
        if (!prodR.rows.length) return json(res, { error: 'Produto não encontrado' }, 404);
        var prod = prodR.rows[0];
        if (prod.stock < b.quantity) return json(res, { error: 'Estoque insuficiente' }, 400);

        var total = prod.price * b.quantity;

        // Aplica cupom
        if (b.couponCode) {
          var cR = await pool.query('SELECT * FROM coupons WHERE UPPER(code)=UPPER($1) AND sellerId=$2 AND active=1', [b.couponCode, prod.sellerid]);
          if (cR.rows.length && cR.rows[0].uses < cR.rows[0].maxuses) {
            total = total * (1 - cR.rows[0].discount / 100);
            await pool.query('UPDATE coupons SET uses = uses + 1 WHERE id=$1', [cR.rows[0].id]);
          } else {
            b.couponCode = null;
          }
        }

        total = Math.round(total * 100) / 100;
        var orderId = uid();

        await pool.query(
          'INSERT INTO orders (id,buyerId,sellerId,productId,productTitle,quantity,total,address,couponCode) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [orderId, b.buyerId, prod.sellerid, b.productId, prod.title, b.quantity, total, JSON.stringify(b.address), b.couponCode||null]
        );

        // Gera PIX via Mercado Pago
        var paymentData;
        try {
          paymentData = await mpPayment.create({
            body: {
              transaction_amount: total,
              description: 'Pedido ' + orderId.slice(0, 8) + ' - ' + prod.title,
              payment_method_id: 'pix',
              payer: {
                email: b.buyerEmail || 'comprador@redzin.com',
                first_name: b.buyerName || 'Comprador'
              },
              external_reference: orderId,
              notification_url: PUBLIC_URL + '/api/webhook/mercadopago'
            }
          });
        } catch(mpErr) {
          console.error('MP err:', mpErr);
          return json(res, { error: 'Falha ao gerar PIX: ' + (mpErr.message || 'verifique MP_ACCESS_TOKEN') }, 500);
        }

        await pool.query('UPDATE orders SET paymentId=$1 WHERE id=$2', [paymentData.id, orderId]);

        var qr = paymentData.point_of_interaction?.transaction_data?.qr_code;
        var qrB64 = paymentData.point_of_interaction?.transaction_data?.qr_code_base64;

        json(res, {
          success: true,
          orderId: orderId,
          total: total,
          paymentId: paymentData.id,
          qrCode: qr,
          qrCodeBase64: qrB64
        });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  // ---------- WEBHOOK MP ----------
  if (req.method === 'POST' && u === '/api/webhook/mercadopago') {
    parseBody(req).then(async function(b) {
      try {
        var topic = b.type || new URL(req.url, 'http://x').searchParams.get('topic');
        var paymentId = (b.data && b.data.id) || new URL(req.url, 'http://x').searchParams.get('id');
        if (topic === 'payment' && paymentId) {
          var pay = await mpPayment.get({ id: paymentId });
          if (pay.status === 'approved') {
            var orderId = pay.external_reference;
            var oR = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
            if (oR.rows.length) {
              var order = oR.rows[0];
              if (order.status !== 'paid') {
                await pool.query("UPDATE orders SET status='paid' WHERE id=$1", [orderId]);
                await pool.query('UPDATE products SET sold=sold+$1, stock=stock-$1 WHERE id=$2', [order.quantity, order.productid]);

                var buyerR = await pool.query('SELECT * FROM users WHERE id=$1', [order.buyerid]);
                var buyer = buyerR.rows[0] || { username: 'Cliente', phone: '-', email: '-' };
                var addr = JSON.parse(order.address || '{}');

                var msg = '💰 NOVA VENDA PAGA!\n' +
                  'Produto: ' + order.producttitle + '\n' +
                  'Quantidade: ' + order.quantity + '\n' +
                  'Total: R$ ' + Number(order.total).toFixed(2) + '\n' +
                  'Comprador: @' + buyer.username + '\n' +
                  'Telefone: ' + (buyer.phone || addr.phone || '-') + '\n' +
                  'Enviar para: ' + (addr.name || buyer.username) + '\n' +
                  (addr.street || '') + ', ' + (addr.num || '') + (addr.neigh ? ' - ' + addr.neigh : '') + '\n' +
                  (addr.city || '') + '/' + (addr.state || '') + ' - CEP ' + (addr.zip || '') + '\n' +
                  'Pedido #' + orderId.slice(0, 8) + '\n' +
                  'Prepare o produto e atualize o rastreamento.';

                var notifId = uid();
                await pool.query(
                  'INSERT INTO notifications (id,userId,type,message,orderId) VALUES ($1,$2,$3,$4,$5)',
                  [notifId, order.sellerid, 'sale', msg, orderId]
                );
                sendTo(order.sellerid, {
                  type: 'new_notification',
                  notification: { id: notifId, type: 'sale', message: msg, orderId: orderId, createdAt: new Date().toISOString() }
                });
                // Avisa comprador
                var bmsg = '✅ Pagamento confirmado! Seu pedido #' + orderId.slice(0, 8) + ' foi aprovado.';
                var bnotif = uid();
                await pool.query(
                  'INSERT INTO notifications (id,userId,type,message,orderId) VALUES ($1,$2,$3,$4,$5)',
                  [bnotif, order.buyerid, 'payment', bmsg, orderId]
                );
                sendTo(order.buyerid, {
                  type: 'new_notification',
                  notification: { id: bnotif, type: 'payment', message: bmsg, orderId: orderId, createdAt: new Date().toISOString() }
                });
              }
            }
          }
        }
        json(res, { ok: true });
      } catch(e) { console.error('Webhook:', e); json(res, { error: e.message }, 500); }
    });
    return;
  }

  // ---------- TRACKING ----------
  if (req.method === 'POST' && u === '/api/order/update-tracking') {
    parseBody(req).then(async function(b) {
      try {
        await pool.query('UPDATE orders SET status=$1, tracking=$2 WHERE id=$3 AND sellerId=$4',
          [b.status, JSON.stringify(b.tracking||[]), b.id, b.sellerId]);
        json(res, { success: true });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  // ---------- NOTIFS ----------
  if (req.method === 'GET' && u === '/api/notifications') {
    var uid2 = new URL(req.url, 'http://x').searchParams.get('userId');
    if (!uid2) return json(res, { notifs: [] });
    pool.query('SELECT * FROM notifications WHERE userId=$1 ORDER BY createdAt DESC LIMIT 50', [uid2])
      .then(async function(r) {
        json(res, { notifs: r.rows });
        await pool.query('UPDATE notifications SET read=1 WHERE userId=$1', [uid2]);
      })
      .catch(function(e) { json(res, { error: e.message }, 500); });
    return;
  }

  // ---------- UPLOAD ----------
  if (req.method === 'POST' && u === '/upload') {
    parseBody(req).then(function(b) {
      try {
        if (!b.data || !b.type) return json(res, { error: 'Missing' }, 400);
        var base64 = b.data.replace(/^data:image\/\w+;base64,/, '');
        var ext = (b.type.split('/')[1] || 'jpg').split('+')[0];
        var fn = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2,8) + '.' + ext;
        fs.writeFileSync(path.join(UPLOADS_DIR, fn), Buffer.from(base64, 'base64'));
        json(res, { url: '/uploads/' + fn });
      } catch(e) { json(res, { error: e.message }, 500); }
    });
    return;
  }

  if (u.indexOf('/uploads/') === 0) {
    var fn2 = path.basename(u);
    var fp = path.join(UPLOADS_DIR, fn2);
    if (fp.indexOf(UPLOADS_DIR) !== 0) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, function(err, data) {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'public,max-age=31536000' });
      res.end(data);
    });
    return;
  }

  // ---------- STATIC ----------
  var fp2 = path.join(__dirname, req.url === '/' ? 'index.html' : u);
  if (fp2.indexOf(__dirname) !== 0) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp2, function(err, data) {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), function(e2, d2) {
        if (e2) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp2)] || 'text/plain' });
    res.end(data);
  });
});

// ============================================================
// WEBSOCKET
// ============================================================
var wss = new WebSocket.Server({ server: server });
var userSockets = {};

function sendTo(userId, msg) {
  var list = userSockets[userId];
  if (!list) return;
  var data = JSON.stringify(msg);
  list.forEach(function(s) { if (s.readyState === WebSocket.OPEN) s.send(data); });
}

wss.on('connection', function(ws) {
  var myUserId = null;
  ws.on('message', async function(raw) {
    var m; try { m = JSON.parse(raw); } catch(e) { return; }
    if (m.type === 'auth' && m.userId) {
      myUserId = m.userId;
      if (!userSockets[myUserId]) userSockets[myUserId] = [];
      userSockets[myUserId].push(ws);
    }
    if (m.type === 'chat_open') {
      try {
        var roomId = [m.userId, m.otherUserId].sort().join('__');
        var rr = await pool.query('SELECT * FROM chat_rooms WHERE id=$1', [roomId]);
        if (!rr.rows.length) {
          await pool.query('INSERT INTO chat_rooms (id,participants) VALUES ($1,$2)', [roomId, JSON.stringify([m.userId, m.otherUserId])]);
          if (m.productContext) {
            await pool.query('INSERT INTO chat_messages (id,roomId,senderId,text) VALUES ($1,$2,$3,$4)',
              [uid(), roomId, '__system__', '📦 Conversa sobre: ' + m.productContext]);
          }
        }
        var msgs = await pool.query('SELECT * FROM chat_messages WHERE roomId=$1 ORDER BY createdAt ASC', [roomId]);
        ws.send(JSON.stringify({ type: 'chat_room', roomId: roomId, messages: msgs.rows }));
      } catch(e) { console.error('chat_open:', e); }
    }
    if (m.type === 'chat_message' && m.roomId && m.text && m.text.trim()) {
      try {
        var id = uid();
        await pool.query('INSERT INTO chat_messages (id,roomId,senderId,text) VALUES ($1,$2,$3,$4)',
          [id, m.roomId, m.senderId, m.text.trim()]);
        var r2 = await pool.query('SELECT * FROM chat_rooms WHERE id=$1', [m.roomId]);
        if (r2.rows.length) {
          var parts = JSON.parse(r2.rows[0].participants);
          var msg = { id: id, roomId: m.roomId, senderId: m.senderId, text: m.text.trim(), createdAt: new Date().toISOString() };
          parts.forEach(function(pid) { sendTo(pid, { type: 'new_message', roomId: m.roomId, message: msg }); });
        }
      } catch(e) { console.error('chat_message:', e); }
    }
  });
  ws.on('close', function() {
    if (myUserId && userSockets[myUserId]) {
      userSockets[myUserId] = userSockets[myUserId].filter(function(s) { return s !== ws; });
      if (!userSockets[myUserId].length) delete userSockets[myUserId];
    }
  });
});

server.listen(PORT, function() {
  console.log('🚀 Redzin Market rodando na porta ' + PORT);
  console.log('👑 Admin: ' + ADMIN_USER.username);
});
