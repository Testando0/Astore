// ============================================================
// REDZIN MARKET — WebSocket Server
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// ─── ENSURE UPLOADS FOLDER EXISTS ─────────────────────────────
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── PERSIST DATA ON DISK ─────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return { users: [], chats: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving data:', e.message);
  }
}

let serverData = loadData();

// ─── HTTP SERVER (serve static files + image upload) ─────────
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  // ── CORS for all responses ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── POST /upload — receive base64 image, save to disk, return public URL ──
  if (req.method === 'POST' && req.url === '/upload') {
    let body = '';
    let tooBig = false;
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        tooBig = true;
        res.writeHead(413); res.end('Image too large (max 10MB)');
      }
    });
    req.on('end', () => {
      if (tooBig) return;
      try {
        const { data, type } = JSON.parse(body);
        if (!data || !type) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing data or type' }));
          return;
        }
        // Strip data-URL prefix and decode
        const base64 = data.replace(/^data:image\/\w+;base64,/, '');
        const extMap = { 'jpeg': 'jpg', 'jpg': 'jpg', 'png': 'png', 'gif': 'gif', 'webp': 'webp' };
        const rawExt = (type.split('/')[1] || 'jpg').split('+')[0];
        const ext = extMap[rawExt] || 'jpg';
        const filename = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: '/uploads/' + filename }));
      } catch (e) {
        console.error('Upload error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upload failed' }));
      }
    });
    return;
  }

  // ── GET /uploads/* — serve saved images ──
  if (req.url.startsWith('/uploads/')) {
    const filename = path.basename(req.url.split('?')[0]);
    const filePath = path.join(UPLOADS_DIR, filename);
    // Prevent traversal
    if (!filePath.startsWith(UPLOADS_DIR)) { res.writeHead(403); res.end(); return; }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, fileData) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' });
      res.end(fileData);
    });
    return;
  }

  // ── Static files ──
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end(); return;
  }
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: serve index.html for any unknown route
      fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// ─── WEBSOCKET SERVER ─────────────────────────────────────────
const wss = new WebSocket.Server({ server });

// Map: userId → Set<WebSocket>
const userSockets = new Map();

function broadcast(msg, excludeWs) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function sendTo(userId, msg) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const data = JSON.stringify(msg);
  sockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

function sendToRoom(roomId, msg) {
  const room = serverData.chats[roomId];
  if (!room) return;
  room.participants.forEach(uid => sendTo(uid, msg));
}

wss.on('connection', (ws) => {
  let connectedUserId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      // ── Auth: register socket for this user ──
      case 'auth': {
        const { userId } = msg;
        connectedUserId = userId;
        if (!userSockets.has(userId)) userSockets.set(userId, new Set());
        userSockets.get(userId).add(ws);

        // Send any pending server-side user data (e.g. isSeller updated by admin)
        const user = serverData.users.find(u => u.id === userId);
        if (user) {
          ws.send(JSON.stringify({ type: 'user_update', user }));
        }

        // Send all chat rooms for this user
        ws.send(JSON.stringify({ type: 'chats_init', chats: serverData.chats }));
        break;
      }

      // ── Chat: open/create room ──
      case 'chat_open': {
        const { userId, otherUserId, productContext } = msg;
        const roomId = [userId, otherUserId].sort().join('__');
        if (!serverData.chats[roomId]) {
          const room = {
            participants: [userId, otherUserId],
            messages: [],
          };
          if (productContext) {
            room.messages.push({
              id: uid(),
              senderId: '__system__',
              text: '💬 Conversa iniciada sobre o produto: "' + productContext + '"',
              time: new Date().toISOString(),
              read: false,
            });
          }
          serverData.chats[roomId] = room;
          saveData(serverData);
        }
        ws.send(JSON.stringify({ type: 'chat_room', roomId, room: serverData.chats[roomId] }));
        break;
      }

      // ── Chat: send message ──
      case 'chat_message': {
        const { roomId, senderId, text } = msg;
        if (!serverData.chats[roomId]) break;
        const message = {
          id: uid(),
          senderId,
          text,
          time: new Date().toISOString(),
          read: false,
        };
        serverData.chats[roomId].messages.push(message);
        saveData(serverData);

        // Send to other participants only (sender has optimistic copy already)
        const roomForMsg = serverData.chats[roomId];
        roomForMsg.participants.forEach(pUid => {
          if (pUid !== senderId) {
            sendTo(pUid, { type: 'new_message', roomId, message });
          }
        });
        // Confirm to sender: replace optimistic with server version
        sendTo(senderId, { type: 'message_sent', roomId, message });
        break;
      }

      // ── Chat: mark messages read ──
      case 'chat_read': {
        const { roomId, userId } = msg;
        const room = serverData.chats[roomId];
        if (!room) break;
        room.messages.forEach(m => {
          if (m.senderId !== userId) m.read = true;
        });
        saveData(serverData);
        sendToRoom(roomId, { type: 'chat_read_ack', roomId });
        break;
      }

      // ── User: sync user data (called on register/login) ──
      case 'user_sync': {
        const { user } = msg;
        const idx = serverData.users.findIndex(u => u.id === user.id);
        if (idx >= 0) {
          const existing = serverData.users[idx];
          serverData.users[idx] = { ...user, isSeller: existing.isSeller, isAdmin: existing.isAdmin };
        } else {
          serverData.users.push(user);
        }
        saveData(serverData);
        const current = serverData.users.find(u => u.id === user.id);
        ws.send(JSON.stringify({ type: 'user_update', user: current }));
        break;
      }

      // ── Admin: promote/demote seller ──
      case 'promote_seller': {
        const { targetUserId, promote } = msg;
        const idx = serverData.users.findIndex(u => u.id === targetUserId);
        if (idx >= 0) {
          serverData.users[idx].isSeller = promote;
          saveData(serverData);
          const updatedUser = serverData.users[idx];
          sendTo(targetUserId, { type: 'user_update', user: updatedUser });
          ws.send(JSON.stringify({ type: 'promote_ack', userId: targetUserId, isSeller: promote, user: updatedUser }));
        } else {
          ws.send(JSON.stringify({ type: 'promote_ack', userId: targetUserId, isSeller: promote, user: null }));
        }
        break;
      }

      // ── Admin: get all users ──
      case 'get_users': {
        ws.send(JSON.stringify({ type: 'users_list', users: serverData.users }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (connectedUserId) {
      const sockets = userSockets.get(connectedUserId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) userSockets.delete(connectedUserId);
      }
    }
  });
});

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

server.listen(PORT, () => {
  console.log('REDZIN MARKET server running at http://localhost:' + PORT);
  console.log('Uploads folder:', UPLOADS_DIR);
});
