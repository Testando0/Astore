var http = require('http');
var fs = require('fs');
var path = require('path');
var WebSocket = require('ws');
var Database = require('better-sqlite3');

// ============================================================
// VENDEDOR/ADMIN FIXO - CRAVADO NO CODIGO
// ============================================================
var ADMIN_USER = {
  id: 'admin_fixed_001',
  username: 'redzin',
  email: 'redzin@astore.com',
  phone: '',
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=RZ',
  pixKey: '',
  isSeller: 1,
  isAdmin: 1
};
// ============================================================

var PORT = process.env.PORT || 3000;
var UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

var db = new Database(path.join(__dirname, 'astore.db'));
db.pragma('journal_mode = WAL');

db.exec(
  'CREATE TABLE IF NOT EXISTS users (' +
  '  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT, phone TEXT,' +
  '  avatar TEXT, pixKey TEXT, isSeller INTEGER DEFAULT 0, isAdmin INTEGER DEFAULT 0,' +
  '  createdAt TEXT DEFAULT (datetime(\'now\'))' +
  ');' +
  'CREATE TABLE IF NOT EXISTS products (' +
  '  id TEXT PRIMARY KEY, sellerId TEXT NOT NULL, title TEXT NOT NULL, description TEXT,' +
  '  price REAL NOT NULL, originalPrice REAL, stock INTEGER DEFAULT 0, category TEXT,' +
  '  images TEXT, sold INTEGER DEFAULT 0, createdAt TEXT DEFAULT (datetime(\'now\'))' +
  ');' +
  'CREATE TABLE IF NOT EXISTS coupons (' +
  '  id TEXT PRIMARY KEY, sellerId TEXT NOT NULL, code TEXT NOT NULL, discount INTEGER NOT NULL,' +
  '  maxUses INTEGER NOT NULL, uses INTEGER DEFAULT 0, description TEXT,' +
  '  active INTEGER DEFAULT 1, createdAt TEXT DEFAULT (datetime(\'now\'))' +
  ');' +
  'CREATE TABLE IF NOT EXISTS orders (' +
  '  id TEXT PRIMARY KEY, buyerId TEXT NOT NULL, sellerId TEXT NOT NULL, productId TEXT NOT NULL,' +
  '  quantity INTEGER DEFAULT 1, total REAL NOT NULL, status TEXT DEFAULT \'pending_payment\',' +
  '  address TEXT, tracking TEXT DEFAULT \'[]\', couponCode TEXT,' +
  '  createdAt TEXT DEFAULT (datetime(\'now\'))' +
  ');' +
  'CREATE TABLE IF NOT EXISTS notifications (' +
  '  id TEXT PRIMARY KEY, userId TEXT NOT NULL, type TEXT, message TEXT NOT NULL,' +
  '  orderId TEXT, createdAt TEXT DEFAULT (datetime(\'now\')),' +
  '  read INTEGER DEFAULT 0' +
  ');' +
  'CREATE TABLE IF NOT EXISTS chat_rooms (' +
  '  id TEXT PRIMARY KEY, participants TEXT NOT NULL, createdAt TEXT DEFAULT (datetime(\'now\'))' +
  ');' +
  'CREATE TABLE IF NOT EXISTS chat_messages (' +
  '  id TEXT PRIMARY KEY, roomId TEXT NOT NULL, senderId TEXT NOT NULL, text TEXT NOT NULL,' +
  '  read INTEGER DEFAULT 0, createdAt TEXT DEFAULT (datetime(\'now\'))' +
  ');'
);

// Criar vendedor fixo
var checkAdmin = db.prepare('SELECT id FROM users WHERE id = ?');
if (!checkAdmin.get(ADMIN_USER.id)) {
  db.prepare('INSERT INTO users (id,username,email,phone,avatar,pixKey,isSeller,isAdmin) VALUES (?,?,?,?,?,?,?,?)')
    .run(ADMIN_USER.id, ADMIN_USER.username, ADMIN_USER.email, ADMIN_USER.phone, ADMIN_USER.avatar, ADMIN_USER.pixKey, ADMIN_USER.isSeller, ADMIN_USER.isAdmin);
  console.log('Vendedor fixo criado: ' + ADMIN_USER.username);
}

var sql = {
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  getAllUsers: db.prepare('SELECT * FROM users ORDER BY createdAt DESC'),
  createUser: db.prepare('INSERT INTO users (id,username,email,phone,avatar,pixKey,isSeller,isAdmin) VALUES (?,?,?,?,?,?,?,?)'),
  updateUser: db.prepare('UPDATE users SET email=?,phone=?,avatar=?,pixKey=? WHERE id=?'),
  promoteSeller: db.prepare('UPDATE users SET isSeller=? WHERE id=?'),
  getAllProducts: db.prepare('SELECT * FROM products ORDER BY createdAt DESC'),
  getProductById: db.prepare('SELECT * FROM products WHERE id = ?'),
  createProduct: db.prepare('INSERT INTO products (id,sellerId,title,description,price,originalPrice,stock,category,images) VALUES (?,?,?,?,?,?,?,?,?)'),
  updateProduct: db.prepare('UPDATE products SET title=?,description=?,price=?,originalPrice=?,stock=?,category=?,images=? WHERE id=?'),
  deleteProduct: db.prepare('DELETE FROM products WHERE id=?'),
  getCouponsBySeller: db.prepare('SELECT * FROM coupons WHERE sellerId=? ORDER BY createdAt DESC'),
  createCoupon: db.prepare('INSERT INTO coupons (id,sellerId,code,discount,maxUses,description,active) VALUES (?,?,?,?,?,?,1)'),
  toggleCoupon: db.prepare('UPDATE coupons SET active=? WHERE id=?'),
  deleteCoupon: db.prepare('DELETE FROM coupons WHERE id=?'),
  getOrdersByBuyer: db.prepare('SELECT * FROM orders WHERE buyerId=? ORDER BY createdAt DESC'),
  getOrdersBySeller: db.prepare('SELECT * FROM orders WHERE sellerId=? ORDER BY createdAt DESC'),
  getAllOrders: db.prepare('SELECT * FROM orders ORDER BY createdAt DESC'),
  createOrder: db.prepare('INSERT INTO orders (id,buyerId,sellerId,productId,quantity,total,address,couponCode) VALUES (?,?,?,?,?,?,?,?)'),
  updateOrderTracking: db.prepare('UPDATE orders SET status=?,tracking=? WHERE id=?'),
  incrementSold: db.prepare('UPDATE products SET sold=sold+?,stock=stock-? WHERE id=?'),
  getNotifsByUser: db.prepare('SELECT * FROM notifications WHERE userId=? ORDER BY createdAt DESC'),
  createNotif: db.prepare('INSERT INTO notifications (id,userId,type,message,orderId) VALUES (?,?,?,?,?)'),
  markNotifsRead: db.prepare('UPDATE notifications SET read=1 WHERE userId=?'),
  getChatRoom: db.prepare('SELECT * FROM chat_rooms WHERE id=?'),
  createChatRoom: db.prepare('INSERT INTO chat_rooms (id,participants) VALUES (?,?)'),
  getChatMessages: db.prepare('SELECT * FROM chat_messages WHERE roomId=? ORDER BY createdAt ASC'),
  addChatMessage: db.prepare('INSERT INTO chat_messages (id,roomId,senderId,text) VALUES (?,?,?,?)')
};

var MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.svg':'image/svg+xml'};

function parseBody(req) {
  return new Promise(function(resolve) {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() { try { resolve(JSON.parse(body)); } catch(e) { resolve(body); } });
  });
}

function json(res, data, status) {
  status = status || 200;
  res.writeHead(status, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
  res.end(JSON.stringify(data));
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ===== API ROUTES =====
  if (req.method === 'POST' && req.url === '/api/register') {
    parseBody(req).then(function(b) {
      var existing = sql.getUserByUsername.get(b.username);
      if (existing) return json(res, {error:'Usuário já existe'}, 400);
      sql.createUser.run(b.id, b.username, b.email||null, b.phone||null, b.avatar||null, b.pixKey||null, 0, 0);
      json(res, {success:true, user:sql.getUserById.get(b.id)});
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    parseBody(req).then(function(b) {
      var user = sql.getUserByUsername.get(b.username);
      if (!user) return json(res, {error:'Usuário não encontrado'}, 404);
      json(res, {success:true, user:user});
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/users') {
    json(res, {users:sql.getAllUsers.all()});
    return;
  }

  if (req.method === 'POST' && req.url === '/api/promote') {
    parseBody(req).then(function(b) {
      sql.promoteSeller.run(b.promote?1:0, b.targetUserId);
      json(res, {success:true, user:sql.getUserById.get(b.targetUserId)});
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/update-user') {
    parseBody(req).then(function(b) {
      sql.updateUser.run(b.email, b.phone, b.avatar, b.pixKey, b.userId);
      json(res, {success:true, user:sql.getUserById.get(b.userId)});
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/products') {
    var products = sql.getAllProducts.all().map(function(p) {
      p.images = JSON.parse(p.images || '[]');
      return p;
    });
    json(res, {products:products});
    return;
  }

  if (req.method === 'POST' && req.url === '/api/product/create') {
    parseBody(req).then(function(b) {
      sql.createProduct.run(b.id, b.sellerId, b.title, b.description, b.price, b.originalPrice||null, b.stock, b.category, JSON.stringify(b.images||[]));
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/product/update') {
    parseBody(req).then(function(b) {
      sql.updateProduct.run(b.title, b.description, b.price, b.originalPrice||null, b.stock, b.category, JSON.stringify(b.images||[]), b.id);
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/product/delete') {
    parseBody(req).then(function(b) {
      sql.deleteProduct.run(b.id);
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'GET' && req.url.indexOf('/api/coupons') === 0) {
    var url = new URL(req.url, 'http://' + req.headers.host);
    var sellerId = url.searchParams.get('sellerId');
    var coupons = sellerId ? sql.getCouponsBySeller.all(sellerId) : [];
    json(res, {coupons:coupons});
    return;
  }

  if (req.method === 'POST' && req.url === '/api/coupon/create') {
    parseBody(req).then(function(b) {
      sql.createCoupon.run(b.id, b.sellerId, b.code, b.discount, b.maxUses, b.description||null);
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/coupon/toggle') {
    parseBody(req).then(function(b) {
      sql.toggleCoupon.run(b.active?1:0, b.id);
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/coupon/delete') {
    parseBody(req).then(function(b) {
      sql.deleteCoupon.run(b.id);
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'GET' && req.url.indexOf('/api/orders') === 0) {
    var url2 = new URL(req.url, 'http://' + req.headers.host);
    var buyerId = url2.searchParams.get('buyerId');
    var sellerId2 = url2.searchParams.get('sellerId');
    var orders;
    if (buyerId) orders = sql.getOrdersByBuyer.all(buyerId);
    else if (sellerId2) orders = sql.getOrdersBySeller.all(sellerId2);
    else orders = sql.getAllOrders.all();
    orders = orders.map(function(o) {
      o.tracking = JSON.parse(o.tracking || '[]');
      o.address = JSON.parse(o.address || '{}');
      return o;
    });
    json(res, {orders:orders});
    return;
  }

  if (req.method === 'POST' && req.url === '/api/order/create') {
    parseBody(req).then(function(b) {
      sql.createOrder.run(b.id, b.buyerId, b.sellerId, b.productId, b.quantity, b.total, JSON.stringify(b.address), b.couponCode||null);
      sql.incrementSold.run(b.quantity, b.quantity, b.productId);
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/order/update-tracking') {
    parseBody(req).then(function(b) {
      sql.updateOrderTracking.run(b.status, JSON.stringify(b.tracking||[]), b.id);
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'GET' && req.url.indexOf('/api/notifications') === 0) {
    var url3 = new URL(req.url, 'http://' + req.headers.host);
    var userId = url3.searchParams.get('userId');
    if (!userId) { json(res, {notifs:[]}); return; }
    var notifs = sql.getNotifsByUser.all(userId);
    sql.markNotifsRead.run(userId);
    json(res, {notifs:notifs});
    return;
  }

  if (req.method === 'POST' && req.url === '/api/notifications/create') {
    parseBody(req).then(function(b) {
      sql.createNotif.run(b.id, b.userId, b.type, b.message, b.orderId||null);
      json(res, {success:true});
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/upload') {
    parseBody(req).then(function(b) {
      try {
        if (!b.data || !b.type) { json(res, {error:'Missing data'}, 400); return; }
        var base64 = b.data.replace(/^data:image\/\w+;base64,/, '');
        var ext = (b.type.split('/')[1] || 'jpg').split('+')[0];
        var filename = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2,8) + '.' + ext;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64, 'base64'));
        json(res, {url:'/uploads/' + filename});
      } catch(e) { json(res, {error:'Upload failed'}, 500); }
    });
    return;
  }

  if (req.url.indexOf('/uploads/') === 0) {
    var filename = path.basename(req.url.split('?')[0]);
    var filePath = path.join(UPLOADS_DIR, filename);
    if (filePath.indexOf(UPLOADS_DIR) !== 0) { res.writeHead(403); res.end(); return; }
    var ext = path.extname(filePath).toLowerCase();
    var contentType = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, function(err, fileData) {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {'Content-Type':contentType, 'Cache-Control':'public,max-age=31536000'});
      res.end(fileData);
    });
    return;
  }

  // Static files
  var filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  if (filePath.indexOf(__dirname) !== 0) { res.writeHead(403); res.end(); return; }
  var ext = path.extname(filePath);
  var contentType = MIME[ext] || 'text/plain';
  fs.readFile(filePath, function(err, data) {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), function(err2, data2) {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, {'Content-Type':'text/html'});
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, {'Content-Type':contentType});
    res.end(data);
  });
});

// WebSocket
var wss = new WebSocket.Server({server:server});
var userSockets = {};

function sendTo(userId, msg) {
  var sockets = userSockets[userId];
  if (!sockets) return;
  var data = JSON.stringify(msg);
  for (var i = 0; i < sockets.length; i++) {
    if (sockets[i].readyState === WebSocket.OPEN) sockets[i].send(data);
  }
}

wss.on('connection', function(ws) {
  var myUserId = null;

  ws.on('message', function(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch(e) { return; }

    if (msg.type === 'auth') {
      myUserId = msg.userId;
      if (!userSockets[myUserId]) userSockets[myUserId] = [];
      userSockets[myUserId].push(ws);
    }

    if (msg.type === 'chat_open') {
      var roomId = [msg.userId, msg.otherUserId].sort().join('__');
      var room = sql.getChatRoom.get(roomId);
      if (!room) {
        sql.createChatRoom.run(roomId, JSON.stringify([msg.userId, msg.otherUserId]));
        if (msg.productContext) sql.addChatMessage.run(uid(), roomId, '__system__', 'Conversa sobre: ' + msg.productContext);
        room = sql.getChatRoom.get(roomId);
      }
      var messages = sql.getChatMessages.all(roomId);
      ws.send(JSON.stringify({type:'chat_room', roomId:roomId, messages:messages}));
    }

    if (msg.type === 'chat_message') {
      var message = {id:uid(), senderId:msg.senderId, text:msg.text, createdAt:new Date().toISOString()};
      sql.addChatMessage.run(message.id, msg.roomId, msg.senderId, msg.text);
      var room2 = sql.getChatRoom.get(msg.roomId);
      if (room2) {
        var parts = JSON.parse(room2.participants);
        for (var i = 0; i < parts.length; i++) {
          sendTo(parts[i], {type:'new_message', roomId:msg.roomId, message:message});
        }
      }
    }
  });

  ws.on('close', function() {
    if (myUserId && userSockets[myUserId]) {
      userSockets[myUserId] = userSockets[myUserId].filter(function(s) { return s !== ws; });
      if (userSockets[myUserId].length === 0) delete userSockets[myUserId];
    }
  });
});

server.listen(PORT, function() {
  console.log('REDZIN MARKET rodando em http://localhost:' + PORT);
  console.log('Admin/Vendedor fixo: ' + ADMIN_USER.username);
});
