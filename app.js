// ============================================================
// REDZIN MARKET — Full E-Commerce App
// ============================================================

// ─── STORAGE: in-memory-first, localStorage as persistence ───
// All reads/writes go through _store (in-memory object).
// localStorage is synced as a best-effort persistence layer.
// sessionStorage is replaced entirely with _session (in-memory).
const _store = {};   // replaces localStorage
const _session = {}; // replaces sessionStorage

function stGet(k, def) {
  if (k in _store) {
    try { return JSON.parse(_store[k]) ?? def; } catch(e) { return def; }
  }
  // Try to hydrate from localStorage on first access
  try {
    const v = localStorage.getItem(k);
    if (v !== null) { _store[k] = v; return JSON.parse(v) ?? def; }
  } catch(e) {}
  return def;
}
function stSet(k, v) {
  const s = JSON.stringify(v);
  _store[k] = s;
  try { localStorage.setItem(k, s); } catch(e) {}
}
function ssGet(k, def = null) {
  if (k in _session) {
    try { return JSON.parse(_session[k]) ?? def; } catch(e) { return def; }
  }
  try {
    const v = sessionStorage.getItem(k);
    if (v !== null) { _session[k] = v; return JSON.parse(v) ?? def; }
  } catch(e) {}
  return def;
}
function ssSet(k, v) {
  _session[k] = JSON.stringify(v);
  try { sessionStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
}
function ssRemove(k) {
  delete _session[k];
  try { sessionStorage.removeItem(k); } catch(e) {}
}

// ─── DATABASE ────────────────────────────────────────────────
const DB = {
  get: (k, def = []) => stGet(k, def),
  set: (k, v) => stSet(k, v),
  getUsers: () => DB.get('rm_users', []),
  setUsers: v => DB.set('rm_users', v),
  getProducts: () => DB.get('rm_products', []),
  setProducts: v => DB.set('rm_products', v),
  getOrders: () => DB.get('rm_orders', []),
  setOrders: v => DB.set('rm_orders', v),
  getCart: () => DB.get('rm_cart', []),
  setCart: v => DB.set('rm_cart', v),
  getFavs: () => DB.get('rm_favs', []),
  setFavs: v => DB.set('rm_favs', v),
  getCoupons: () => DB.get('rm_coupons', []),
  setCoupons: v => DB.set('rm_coupons', v),
  getNotifs: () => DB.get('rm_notifs', []),
  setNotifs: v => DB.set('rm_notifs', v),
  getCurrent: () => DB.get('rm_current', null),
  setCurrent: v => DB.set('rm_current', v),
  getChats: () => DB.get('rm_chats', {}),
  setChats: v => DB.set('rm_chats', v),
  getChatRoom: (roomId) => {
    const chats = DB.getChats();
    return chats[roomId] || { messages: [], participants: [] };
  },
  setChatRoom: (roomId, room) => {
    const chats = DB.getChats();
    chats[roomId] = room;
    DB.setChats(chats);
    // Trigger in-page chat update immediately (same tab, same memory)
    window.dispatchEvent(new CustomEvent('rm_chats_updated', { detail: { roomId } }));
  },
};

// ─── CHAT STATE ───────────────────────────────────────────────
let chatState = {
  open: false,
  roomId: null,
  otherUserId: null,
  pollInterval: null,
  lastMsgCount: 0,
};

// ─── GLOBAL ORDER DATA (fixes inline JSON onclick bug) ────────
let _pendingOrderData = null;

// ─── STATE ───────────────────────────────────────────────────
let state = {
  route: 'home',
  params: {},
  user: null,
  searchQuery: '',
  selectedCategory: 'all',
};

// ─── INIT ────────────────────────────────────────────────────
function init() {
  let users = DB.getUsers();
  if (!users.find(u => u.username === 'Redzin')) {
    users.push({
      id: 'redzin',
      username: 'Redzin',
      password: '022141530',
      email: 'redzin@market.com',
      phone: '',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=Redzin&backgroundColor=ffffff&textColor=000000`,
      isSeller: true,
      isAdmin: true,
      createdAt: new Date().toISOString(),
      bio: 'Vendedor Oficial REDZIN MARKET',
      pixKey: 'redzin@market.com',
      pixKeyType: 'email',
    });
    DB.setUsers(users);
  }

  if (DB.getProducts().length === 0) seedProducts();

  // Load current user — always cross-reference with users array to get latest data (e.g. isSeller promotions)
  const savedCurrent = DB.getCurrent();
  if (savedCurrent) {
    const freshUser = DB.getUsers().find(u => u.id === savedCurrent.id);
    state.user = freshUser || savedCurrent;
    if (freshUser) DB.setCurrent(freshUser); // refresh rm_current with latest
  } else {
    state.user = null;
  }
  hashRoute();
  window.addEventListener('hashchange', hashRoute);
  renderNav();

  startChatPoll();

  // Listen to in-page chat updates (works even when localStorage is blocked)
  window.addEventListener('rm_chats_updated', () => {
    if (chatState.open && chatState.roomId) {
      renderChatMessages();
    }
    if (state.user) checkUnreadBadges();
  });
  // Also listen to cross-tab storage events (another browser tab)
  window.addEventListener('storage', (e) => {
    if (e.key && e.newValue !== null) {
      // Invalidate in-memory cache so next read picks up the fresh value from localStorage
      _store[e.key] = e.newValue;
    }
    if (e.key === 'rm_chats') {
      if (chatState.open && chatState.roomId) renderChatMessages();
      if (state.user) checkUnreadBadges();
    }
    if (e.key === 'rm_notifs' && state.user) {
      renderNav();
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('user-bubble-wrap');
    if (wrap && !wrap.contains(e.target)) {
      closeUserMenu();
    }
    // Close search bar on outside click
    const bar = document.getElementById('mobile-search-bar');
    const btn = document.getElementById('search-toggle-btn');
    if (bar && bar.classList.contains('visible') && !bar.contains(e.target) && !btn.contains(e.target)) {
      bar.classList.remove('visible');
    }
  });

  // Handle viewport resize (keyboard open/close on mobile)
  window.addEventListener('resize', handleViewportResize);
}

function handleViewportResize() {
  if (chatState.open) {
    const panel = document.getElementById('chat-panel');
    if (panel && window.innerWidth <= 640) {
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 52;
      panel.style.height = `${window.innerHeight - navH}px`;
    }
  }
}

function seedProducts() {
  const products = [
    { id: uid(), sellerId: 'redzin', title: 'Tênis Preto Minimalista', price: 289.90, originalPrice: 389.90, images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400'], category: 'moda', stock: 15, sold: 42, description: 'Tênis moderno em couro sintético preto.', createdAt: new Date().toISOString() },
    { id: uid(), sellerId: 'redzin', title: 'Relógio Minimalista Branco', price: 499.00, originalPrice: null, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'], category: 'acessorios', stock: 8, sold: 17, description: 'Relógio clean e elegante.', createdAt: new Date().toISOString() },
    { id: uid(), sellerId: 'redzin', title: 'Mochila Urbana Preta', price: 179.90, originalPrice: 220.00, images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400'], category: 'bolsas', stock: 20, sold: 93, description: 'Mochila resistente para o dia a dia.', createdAt: new Date().toISOString() },
    { id: uid(), sellerId: 'redzin', title: 'Óculos Escuros Retrô', price: 129.00, originalPrice: 180.00, images: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400'], category: 'acessorios', stock: 30, sold: 210, description: 'Armação clássica em acetato preto.', createdAt: new Date().toISOString() },
    { id: uid(), sellerId: 'redzin', title: 'Camiseta Oversized Branca', price: 89.90, originalPrice: null, images: ['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400'], category: 'moda', stock: 50, sold: 312, description: 'Algodão premium 100%.', createdAt: new Date().toISOString() },
    { id: uid(), sellerId: 'redzin', title: 'Headphone Sem Fio Premium', price: 799.00, originalPrice: 999.00, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'], category: 'eletronicos', stock: 5, sold: 28, description: 'Áudio imersivo, cancelamento de ruído.', createdAt: new Date().toISOString() },
    { id: uid(), sellerId: 'redzin', title: 'Carteira Slim de Couro', price: 119.00, originalPrice: null, images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=400'], category: 'acessorios', stock: 25, sold: 74, description: 'Couro legítimo, ultrafina.', createdAt: new Date().toISOString() },
    { id: uid(), sellerId: 'redzin', title: 'Boné Estruturado Preto', price: 69.90, originalPrice: 89.90, images: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400'], category: 'moda', stock: 40, sold: 156, description: 'Estilo streetwear premium.', createdAt: new Date().toISOString() },
  ];
  DB.setProducts(products);
}

// ─── UTILS ───────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmt(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function timeAgo(iso) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}
function chatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function modal(html) {
  const c = document.getElementById('modal-container');
  c.innerHTML = `<div class="modal-overlay" id="modal-overlay">${html}</div>`;
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
  document.body.style.overflow = '';
}

function navigate(route, params = {}) {
  state.route = route;
  state.params = params;
  const hash = params.id ? `#${route}/${params.id}` : `#${route}`;
  history.pushState(null, '', hash);
  render();
  window.scrollTo(0, 0);
  closeUserMenu();
}

function hashRoute() {
  const hash = location.hash.replace('#', '') || 'home';
  const parts = hash.split('/');
  state.route = parts[0];
  state.params = parts[1] ? { id: parts[1] } : {};
  render();
}

function toggleMobileSearch() {
  const bar = document.getElementById('mobile-search-bar');
  bar.classList.toggle('visible');
  if (bar.classList.contains('visible')) {
    document.getElementById('mobile-search-input')?.focus();
  }
}

function mobileSearch() {
  const q = document.getElementById('mobile-search-input')?.value || '';
  state.searchQuery = q.trim();
  state.route = 'home';
  const bar = document.getElementById('mobile-search-bar');
  bar.classList.remove('visible');
  render();
}

function handleProfileNav() {
  if (state.user) navigate('profile');
  else showLogin();
}

// ─── USER MENU DROPDOWN ───────────────────────────────────────
function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (!dropdown) return;
  const isOpen = dropdown.style.display !== 'none';
  if (isOpen) {
    closeUserMenu();
  } else {
    openUserMenu();
  }
}

function openUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.style.display = 'block';
    dropdown.style.animation = 'fadeScale 0.15s ease';
  }
}

function closeUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

// ─── CHAT BADGE / UNREAD ──────────────────────────────────────
function checkUnreadBadges() {
  if (!state.user) return;
  const chats = DB.getChats();
  let unread = 0;
  Object.entries(chats).forEach(([, room]) => {
    if (!room.participants?.includes(state.user.id)) return;
    (room.messages || []).forEach(m => {
      if (m.senderId !== state.user.id && !m.read) unread++;
    });
  });
  // Update dropdown badge
  const chatBadgeEl = document.getElementById('dd-chat-badge');
  if (chatBadgeEl) {
    chatBadgeEl.textContent = unread;
    chatBadgeEl.style.display = unread > 0 ? 'inline-flex' : 'none';
  }
}

// ─── CHAT SYSTEM ─────────────────────────────────────────────
function getChatRoomId(userId1, userId2) {
  return [userId1, userId2].sort().join('__');
}

function openChat(otherUserId, productContext = null) {
  if (!state.user) { showLogin(); return; }
  if (otherUserId === state.user.id) { toast('Não pode conversar consigo mesmo', 'info'); return; }

  const otherUser = DB.getUsers().find(u => u.id === otherUserId);
  if (!otherUser) return;

  const roomId = getChatRoomId(state.user.id, otherUserId);
  chatState.roomId = roomId;
  chatState.otherUserId = otherUserId;

  let room = DB.getChatRoom(roomId);
  if (!room.participants || room.participants.length === 0) {
    room.participants = [state.user.id, otherUserId];
    room.messages = [];
    if (productContext) {
      room.messages.push({
        id: uid(),
        senderId: '__system__',
        text: `💬 Conversa iniciada sobre o produto: "${productContext}"`,
        time: new Date().toISOString(),
        read: false,
      });
    }
    DB.setChatRoom(roomId, room);
  }

  document.getElementById('chat-panel-avatar').src = otherUser.avatar || '';
  document.getElementById('chat-panel-name').textContent = otherUser.username;
  document.getElementById('chat-panel-status').textContent = 'online';

  const panel = document.getElementById('chat-panel');
  const overlay = document.getElementById('chat-overlay');
  panel.classList.add('open');
  overlay.classList.add('visible');
  chatState.open = true;

  // Resize panel properly on mobile
  if (window.innerWidth <= 640) {
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 52;
    panel.style.height = `${window.innerHeight - navH}px`;
  }

  renderChatMessages();
  setTimeout(() => {
    const input = document.getElementById('chat-input');
    if (input) {
      input.focus();
      // Scroll to bottom of messages
      const msgs = document.getElementById('chat-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }
  }, 350);
}

function closeChatPanel() {
  const panel = document.getElementById('chat-panel');
  const overlay = document.getElementById('chat-overlay');
  panel.classList.remove('open');
  panel.style.height = '';
  overlay.classList.remove('visible');
  chatState.open = false;
  chatState.roomId = null;
}

function sendChatMessage() {
  if (!state.user || !chatState.roomId) return;
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const room = DB.getChatRoom(chatState.roomId);
  const msg = {
    id: uid(),
    senderId: state.user.id,
    text,
    time: new Date().toISOString(),
    read: false,
  };
  room.messages.push(msg);
  DB.setChatRoom(chatState.roomId, room);

  input.value = '';
  renderChatMessages();

  // Notify the other user
  const notifs = DB.getNotifs();
  notifs.push({
    id: uid(),
    userId: chatState.otherUserId,
    type: 'chat',
    message: `💬 ${state.user.username}: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`,
    chatRoomId: chatState.roomId,
    otherUserId: state.user.id,
    read: false,
    createdAt: new Date().toISOString(),
  });
  DB.setNotifs(notifs);
}

function renderChatMessages() {
  if (!chatState.roomId) return;
  const room = DB.getChatRoom(chatState.roomId);
  const msgs = room.messages || [];

  let updated = false;
  msgs.forEach(m => {
    if (m.senderId !== state.user?.id && !m.read) {
      m.read = true;
      updated = true;
    }
  });
  if (updated) {
    room.messages = msgs;
    DB.setChatRoom(chatState.roomId, room);
    checkUnreadBadges();
  }

  const container = document.getElementById('chat-messages');
  if (!container) return;

  container.innerHTML = msgs.length === 0
    ? `<div style="color:var(--text3);text-align:center;margin-top:32px;font-size:13px">Nenhuma mensagem ainda.<br>Diga olá! 👋</div>`
    : msgs.map(m => {
        if (m.senderId === '__system__') {
          return `<div class="chat-system-msg">${m.text}</div>`;
        }
        const isSent = m.senderId === state.user?.id;
        return `<div class="chat-msg ${isSent ? 'sent' : 'received'}">
          ${m.text}
          <span class="chat-msg-time">${chatTime(m.time)}</span>
        </div>`;
      }).join('');

  chatState.lastMsgCount = msgs.length;
  container.scrollTop = container.scrollHeight;
}

function startChatPoll() {
  chatState.pollInterval = setInterval(() => {
    if (chatState.open && chatState.roomId) {
      const room = DB.getChatRoom(chatState.roomId);
      const count = room.messages?.length || 0;
      if (count !== chatState.lastMsgCount) {
        renderChatMessages();
      }
    }
    if (state.user) checkUnreadBadges();
  }, 1500);
}

function getUnreadChatCount() {
  if (!state.user) return 0;
  const chats = DB.getChats();
  let unread = 0;
  Object.entries(chats).forEach(([, room]) => {
    if (!room.participants?.includes(state.user.id)) return;
    (room.messages || []).forEach(m => {
      if (m.senderId !== state.user.id && !m.read) unread++;
    });
  });
  return unread;
}

// ─── NAV RENDER ──────────────────────────────────────────────
function renderNav() {
  const u = state.user;
  const notifs = u ? DB.getNotifs().filter(n => n.userId === u.id && !n.read).length : 0;
  const cartCount = u ? DB.getCart().filter(c => c.userId === u.id).length : 0;
  const chatUnread = getUnreadChatCount();

  const bubble = document.getElementById('user-bubble');
  const dropdown = document.getElementById('user-dropdown');
  if (!bubble || !dropdown) return;

  if (!u) {
    bubble.innerHTML = `<span style="font-size:18px;line-height:1">👤</span>`;
    dropdown.innerHTML = `
      <div class="dropdown-item" onclick="closeUserMenu();showLogin()">🔑 Entrar</div>
      <div class="dropdown-item" onclick="closeUserMenu();showRegister()">✨ Criar conta</div>
    `;
  } else {
    bubble.innerHTML = `<img src="${u.avatar}" alt="${u.username}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${u.username}'">`;
    dropdown.innerHTML = `
      <div class="dropdown-header">
        <img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--border2);flex-shrink:0" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${u.username}'">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${u.username}</div>
          <div style="font-size:10px;color:${u.isAdmin ? 'var(--success)' : u.isSeller ? 'var(--success)' : 'var(--text3)'}">${u.isAdmin ? '⭐ Admin' : u.isSeller ? '✓ Vendedor' : 'Comprador'}</div>
        </div>
      </div>
      <div class="dropdown-divider"></div>
      <div class="dropdown-item" onclick="closeUserMenu();navigate('profile')">👤 Meu Perfil</div>
      <div class="dropdown-item" onclick="closeUserMenu();navigate('cart')">
        🛒 Carrinho
        ${cartCount > 0 ? `<span class="dropdown-badge">${cartCount}</span>` : ''}
      </div>
      <div class="dropdown-item" onclick="closeUserMenu();navigate('notifications')">
        🔔 Notificações
        ${notifs > 0 ? `<span class="dropdown-badge">${notifs}</span>` : ''}
      </div>
      <div class="dropdown-item" onclick="closeUserMenu();navigate('my-chats')">
        💬 Mensagens
        <span class="dropdown-badge" id="dd-chat-badge" style="display:${chatUnread > 0 ? 'inline-flex' : 'none'}">${chatUnread}</span>
      </div>
      <div class="dropdown-item" onclick="closeUserMenu();navigate('favorites')">❤ Favoritos</div>
      <div class="dropdown-item" onclick="closeUserMenu();navigate('orders')">📦 Meus Pedidos</div>
      ${u.isSeller ? `
        <div class="dropdown-divider"></div>
        <div class="dropdown-item" onclick="closeUserMenu();navigate('seller-dashboard')">🏪 Painel do Vendedor</div>
      ` : ''}
      ${u.isAdmin ? `
        <div class="dropdown-item" onclick="closeUserMenu();navigate('admin-users')">⚙ Gerenciar Usuários</div>
      ` : ''}
      <div class="dropdown-divider"></div>
      <div class="dropdown-item danger" onclick="closeUserMenu();doLogout()">🚪 Sair</div>
    `;
  }
}

// ─── MAIN RENDER ─────────────────────────────────────────────
function render() {
  renderNav();
  const main = document.getElementById('main');
  const routes = {
    home: renderHome,
    product: renderProduct,
    profile: renderProfile,
    'seller-profile': renderSellerProfile,
    cart: renderCart,
    favorites: renderFavorites,
    checkout: renderCheckout,
    payment: renderPayment,
    tracking: renderTracking,
    'seller-dashboard': renderSellerDashboard,
    'seller-products': renderSellerProducts,
    'add-product': renderAddProduct,
    'edit-product': renderEditProduct,
    'seller-coupons': renderSellerCoupons,
    'seller-pix': renderSellerPix,
    notifications: renderNotifications,
    'admin-users': renderAdminUsers,
    orders: renderOrders,
    'my-chats': renderMyChats,
  };

  const fn = routes[state.route];
  if (fn) main.innerHTML = fn();
  else main.innerHTML = renderHome();
  attachEvents();
}

// ─── HOME PAGE ───────────────────────────────────────────────
function renderHome() {
  const categories = ['all', 'moda', 'eletronicos', 'acessorios', 'bolsas', 'beleza', 'casa', 'esporte'];
  const catLabels = { all: 'Todos', moda: 'Moda', eletronicos: 'Eletrônicos', acessorios: 'Acessórios', bolsas: 'Bolsas', beleza: 'Beleza', casa: 'Casa', esporte: 'Esporte' };

  let prods = DB.getProducts();
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    prods = prods.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  if (state.selectedCategory && state.selectedCategory !== 'all') {
    prods = prods.filter(p => p.category === state.selectedCategory);
  }

  const favs = state.user ? DB.getFavs().filter(f => f.userId === state.user.id).map(f => f.productId) : [];
  const coupons = DB.getCoupons();

  const heroHtml = !state.searchQuery ? `
    <div class="hero">
      <h1>REDZIN<br><span>MARKET</span></h1>
      <p>A loja minimalista que você merece</p>
    </div>
  ` : `
    <div style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--bg2);">
      <p style="color:var(--text2);font-size:13px;">Resultados para: <strong style="color:var(--text)">"${state.searchQuery}"</strong> — ${prods.length} produto(s)
      <button onclick="state.searchQuery='';render()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;margin-left:8px">✕ Limpar</button></p>
    </div>
  `;

  const catsHtml = `
    <div class="categories-bar">
      ${categories.map(c => `<button class="cat-chip ${state.selectedCategory === c ? 'active' : ''}" onclick="setCategory('${c}')">${catLabels[c]}</button>`).join('')}
    </div>
  `;

  const productsHtml = prods.length === 0 ? `
    <div class="empty-state">
      <div class="icon">🛍️</div>
      <h3>Nenhum produto encontrado</h3>
      <p>Tente buscar por outro termo</p>
    </div>
  ` : `
    <div class="product-grid">
      ${prods.map(p => renderProductCard(p, favs, coupons)).join('')}
    </div>
  `;

  return `
    ${heroHtml}
    ${catsHtml}
    <div class="page-container">
      <div class="section-title">— PRODUTOS</div>
      ${productsHtml}
    </div>
  `;
}

function renderProductCard(p, favs, coupons) {
  const isFav = favs.includes(p.id);
  const applicable = coupons.filter(c => c.sellerId === p.sellerId && c.active);
  const bestDiscount = applicable.length > 0 ? Math.max(...applicable.map(c => c.discount)) : 0;
  const discountedPrice = bestDiscount > 0 ? p.price * (1 - bestDiscount / 100) : p.price;

  return `
    <div class="product-card" onclick="navigate('product', {id:'${p.id}'})">
      ${bestDiscount > 0 ? `<span class="discount-badge">-${bestDiscount}%</span>` : ''}
      <button class="product-card-fav ${isFav ? 'active' : ''}" onclick="event.stopPropagation();toggleFav('${p.id}')">${isFav ? '❤' : '♡'}</button>
      <img class="product-card-img" src="${p.images[0]}" alt="${p.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x300/111111/444444?text=IMG'">
      <div class="product-card-info">
        <div class="product-card-title">${p.title}</div>
        <div class="product-card-price">
          ${fmt(discountedPrice)}
          ${bestDiscount > 0 ? `<span class="original">${fmt(p.price)}</span>` : ''}
          ${p.originalPrice && !bestDiscount ? `<span class="original">${fmt(p.originalPrice)}</span>` : ''}
        </div>
        <div class="product-card-sold">${p.sold || 0} vendidos</div>
      </div>
    </div>
  `;
}

function setCategory(cat) {
  state.selectedCategory = cat;
  render();
}

// ─── PRODUCT DETAIL ──────────────────────────────────────────
function renderProduct() {
  const p = DB.getProducts().find(p => p.id === state.params.id);
  if (!p) return `<div class="page-container"><div class="empty-state"><div class="icon">😕</div><h3>Produto não encontrado</h3></div></div>`;

  const seller = DB.getUsers().find(u => u.id === p.sellerId) || {};
  const favs = state.user ? DB.getFavs().filter(f => f.userId === state.user.id).map(f => f.productId) : [];
  const isFav = favs.includes(p.id);
  const coupons = DB.getCoupons().filter(c => c.sellerId === p.sellerId && c.active);
  const bestDiscount = coupons.length > 0 ? Math.max(...coupons.map(c => c.discount)) : 0;
  const displayPrice = bestDiscount > 0 ? p.price * (1 - bestDiscount / 100) : p.price;

  const thumbs = p.images.length > 1 ? p.images.map((img, i) => `
    <img class="product-thumb ${i === 0 ? 'active' : ''}" src="${img}" alt="" onclick="switchImg(this, '${img}')" onerror="this.style.display='none'">
  `).join('') : '';

  const isOwnProduct = state.user && state.user.id === p.sellerId;

  return `
    <div class="page-container" style="padding-top:24px">
      <button class="btn btn-outline btn-sm" style="margin-bottom:20px" onclick="history.back()">← Voltar</button>
      <div class="product-detail">
        <div class="product-images">
          <img class="product-main-img" id="main-img" src="${p.images[0]}" alt="${p.title}" onerror="this.src='https://via.placeholder.com/500x500/111111/444444?text=IMG'">
          ${thumbs ? `<div class="product-thumbs">${thumbs}</div>` : ''}
        </div>
        <div class="product-info-panel">
          <h1>${p.title}</h1>
          <div class="product-meta">
            <span>⭐ 4.8</span>
            <span>${p.sold || 0} vendidos</span>
            <span>${p.stock > 0 ? `${p.stock} em estoque` : '<span style="color:var(--danger)">Sem estoque</span>'}</span>
          </div>
          <div class="product-price-big">
            ${fmt(displayPrice)}
            ${p.originalPrice && !bestDiscount ? `<span class="orig-price">${fmt(p.originalPrice)}</span>` : ''}
            ${bestDiscount > 0 ? `<span class="orig-price">${fmt(p.price)}</span>` : ''}
          </div>
          ${bestDiscount > 0 ? `<div style="margin-bottom:10px"><span class="chip" style="color:var(--success);border-color:rgba(68,255,136,0.3)">🏷 ${bestDiscount}% de desconto</span></div>` : ''}

          <div style="margin-bottom:14px;font-size:14px;color:var(--text2);line-height:1.6">${p.description}</div>

          <div class="quantity-control">
            <button class="qty-btn" onclick="changeQty(-1)">−</button>
            <input class="qty-input" id="qty-input" type="number" value="1" min="1" max="${p.stock}">
            <button class="qty-btn" onclick="changeQty(1)">+</button>
            <span style="font-size:12px;color:var(--text3)">Estoque: ${p.stock}</span>
          </div>

          <div class="coupon-input-row">
            <input class="form-control" id="coupon-input" placeholder="Código do cupom...">
            <button class="btn btn-outline" onclick="applyCoupon('${p.id}','${p.sellerId}')">Aplicar</button>
          </div>
          <div id="coupon-result"></div>

          <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap">
            <button class="btn btn-primary" style="flex:1" onclick="addToCart('${p.id}')" ${p.stock === 0 ? 'disabled' : ''}>
              🛒 Adicionar
            </button>
            <button class="btn btn-outline" onclick="toggleFav('${p.id}')">${isFav ? '❤' : '♡'}</button>
          </div>
          <button class="btn btn-outline btn-full" onclick="buyNow('${p.id}')" ${p.stock === 0 ? 'disabled' : ''} style="margin-bottom:8px">
            ⚡ Comprar Agora
          </button>

          ${!isOwnProduct ? `
          <button class="chat-seller-btn" onclick="openChat('${seller.id}', '${p.title.replace(/'/g, "\\'")}')">
            💬 Falar com o vendedor
          </button>` : ''}

          <div class="seller-card-mini" onclick="navigate('seller-profile',{id:'${seller.id}'})">
            <img class="seller-avatar-mini" src="${seller.avatar || ''}" alt="${seller.username}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${seller.username}'">
            <div>
              <div style="font-size:13px;font-weight:600">${seller.username || 'Vendedor'}</div>
              <div style="font-size:11px;color:var(--text3)">${seller.isAdmin ? '⭐ Vendedor Oficial' : 'Vendedor Verificado'}</div>
            </div>
            <div style="margin-left:auto;font-size:12px;color:var(--text3)">Ver loja →</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function switchImg(el, src) {
  document.getElementById('main-img').src = src;
  document.querySelectorAll('.product-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

function changeQty(delta) {
  const input = document.getElementById('qty-input');
  if (!input) return;
  const max = parseInt(input.max) || 99;
  let v = parseInt(input.value) + delta;
  v = Math.max(1, Math.min(max, v));
  input.value = v;
}

function applyCoupon(productId, sellerId) {
  const code = document.getElementById('coupon-input')?.value?.trim().toUpperCase();
  if (!code) return;
  const coupons = DB.getCoupons();
  const coupon = coupons.find(c => c.code === code && c.sellerId === sellerId && c.active);
  const result = document.getElementById('coupon-result');
  if (!coupon) { result.innerHTML = `<div class="payment-status failed" style="font-size:12px">Cupom inválido ou expirado</div>`; return; }
  if (coupon.uses >= coupon.maxUses) { result.innerHTML = `<div class="payment-status failed" style="font-size:12px">Cupom esgotado</div>`; return; }
  result.innerHTML = `<div class="payment-status confirmed" style="font-size:12px">✓ Cupom válido: ${coupon.discount}% de desconto!</div>`;
  toast(`Cupom ${code} aplicado!`, 'success');
  ssSet('applied_coupon', { code, discount: coupon.discount, sellerId, couponId: coupon.id });
}

// ─── MY CHATS PAGE ───────────────────────────────────────────
function renderMyChats() {
  if (!state.user) { showLogin(); return ''; }

  const chats = DB.getChats();
  const myRooms = Object.entries(chats).filter(([, room]) => room.participants?.includes(state.user.id));

  if (myRooms.length === 0) {
    return `
      <div class="page-container" style="padding-top:28px;max-width:700px;margin:0 auto">
        <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">💬 CONVERSAS</h2>
        <div class="empty-state">
          <div class="icon">💬</div>
          <h3>Nenhuma conversa ainda</h3>
          <p>Acesse um produto e clique em "Falar com o vendedor"</p>
        </div>
      </div>
    `;
  }

  const roomsHtml = myRooms.map(([roomId, room]) => {
    const otherId = room.participants.find(id => id !== state.user.id);
    const other = DB.getUsers().find(u => u.id === otherId);
    if (!other) return '';
    const msgs = room.messages || [];
    const lastMsg = msgs.filter(m => m.senderId !== '__system__').at(-1);
    const unread = msgs.filter(m => m.senderId !== state.user.id && m.senderId !== '__system__' && !m.read).length;

    return `
      <div class="chat-conv-item" onclick="openChat('${otherId}')">
        <img class="chat-conv-avatar" src="${other.avatar || ''}" alt="${other.username}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${other.username}'">
        <div class="chat-conv-info">
          <div class="chat-conv-name">${other.username} ${other.isSeller ? '<span style="font-size:10px;color:var(--success)">✓</span>' : ''}</div>
          <div class="chat-conv-last">${lastMsg ? (lastMsg.senderId === state.user.id ? 'Você: ' : '') + lastMsg.text : 'Inicie a conversa'}</div>
        </div>
        <div class="chat-conv-meta">
          ${lastMsg ? `<div class="chat-conv-time">${timeAgo(lastMsg.time)}</div>` : ''}
          ${unread > 0 ? `<div class="chat-conv-unread">${unread}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="page-container" style="padding-top:28px;max-width:700px;margin:0 auto">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">💬 CONVERSAS</h2>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);overflow:hidden">
        ${roomsHtml}
      </div>
    </div>
  `;
}

// ─── AUTH ─────────────────────────────────────────────────────
function showLogin() {
  modal(`
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">×</button>
      <h2>ENTRAR</h2>
      <div class="form-group">
        <label>Usuário</label>
        <input class="form-control" id="login-user" placeholder="Seu usuário" autocomplete="username">
      </div>
      <div class="form-group">
        <label>Senha</label>
        <input class="form-control" id="login-pass" type="password" placeholder="Sua senha" autocomplete="current-password">
      </div>
      <button class="btn btn-primary btn-full" onclick="doLogin()">Entrar</button>
      <div style="text-align:center;margin-top:14px">
        <span class="text-link" onclick="closeModal();showRegister()">Não tem conta? Cadastre-se</span>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('login-user')?.focus(), 300);
}

function showRegister() {
  modal(`
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">×</button>
      <h2>CADASTRAR</h2>
      <div class="form-group">
        <label>Usuário *</label>
        <input class="form-control" id="reg-user" placeholder="Escolha um usuário" autocomplete="username">
      </div>
      <div class="form-group">
        <label>E-mail *</label>
        <input class="form-control" id="reg-email" type="email" placeholder="seu@email.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label>Telefone</label>
        <input class="form-control" id="reg-phone" placeholder="(11) 99999-9999" type="tel">
      </div>
      <div class="form-group">
        <label>Senha *</label>
        <input class="form-control" id="reg-pass" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
      </div>
      <button class="btn btn-primary btn-full" onclick="doRegister()">Criar conta</button>
      <div style="text-align:center;margin-top:14px">
        <span class="text-link" onclick="closeModal();showLogin()">Já tem conta? Entrar</span>
      </div>
    </div>
  `);
}

function doLogin() {
  const user = document.getElementById('login-user')?.value?.trim();
  const pass = document.getElementById('login-pass')?.value;
  if (!user || !pass) { toast('Preencha todos os campos', 'error'); return; }
  // Always read fresh from users array (not from rm_current which may be stale)
  const u = DB.getUsers().find(u => u.username === user && u.password === pass);
  if (!u) { toast('Usuário ou senha incorretos', 'error'); return; }
  state.user = u;
  DB.setCurrent(u); // update rm_current with latest data
  closeModal();
  toast(`Bem-vindo, ${u.username}!`, 'success');
  render();
}

function doRegister() {
  const username = document.getElementById('reg-user')?.value?.trim();
  const email = document.getElementById('reg-email')?.value?.trim();
  const phone = document.getElementById('reg-phone')?.value?.trim();
  const password = document.getElementById('reg-pass')?.value;
  if (!username || !email || !password) { toast('Preencha os campos obrigatórios', 'error'); return; }
  if (password.length < 6) { toast('Senha deve ter ao menos 6 caracteres', 'error'); return; }
  const users = DB.getUsers();
  if (users.find(u => u.username === username)) { toast('Usuário já existe', 'error'); return; }
  if (users.find(u => u.email === email)) { toast('E-mail já cadastrado', 'error'); return; }
  const newUser = {
    id: uid(), username, email, phone, password,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundColor=111111&textColor=ffffff`,
    isSeller: false, isAdmin: false, createdAt: new Date().toISOString(), bio: '',
    pixKey: '', pixKeyType: 'email',
  };
  users.push(newUser);
  DB.setUsers(users);
  state.user = newUser;
  DB.setCurrent(newUser);
  closeModal();
  toast(`Conta criada! Bem-vindo, ${username}!`, 'success');
  render();
}

function doLogout() {
  state.user = null;
  DB.setCurrent(null);
  closeChatPanel();
  toast('Até logo!', 'info');
  navigate('home');
}

// ─── PROFILE ─────────────────────────────────────────────────
function renderProfile() {
  if (!state.user) { showLogin(); return '<div class="page-container"><div class="spinner"></div></div>'; }
  const u = state.user;
  const orders = DB.getOrders().filter(o => o.buyerId === u.id);
  const favs = DB.getFavs().filter(f => f.userId === u.id);
  const cart = DB.getCart().filter(c => c.userId === u.id);

  return `
    <div class="profile-header">
      <div class="profile-header-inner">
        <div class="profile-top">
          <div class="profile-avatar-wrap">
            <img class="profile-avatar" id="profile-avatar-img" src="${u.avatar}" alt="${u.username}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${u.username}'">
            <label class="profile-avatar-upload" title="Trocar foto">
              ✏
              <input type="file" accept="image/*" onchange="uploadAvatar(event)">
            </label>
          </div>
          <div class="profile-info">
            <h2>${u.username}</h2>
            ${u.isAdmin ? '<div class="seller-badge">⭐ Admin Oficial</div>' : u.isSeller ? '<div class="seller-badge">✓ Vendedor</div>' : ''}
            <div class="profile-stats">
              <div class="profile-stat"><strong>${orders.length}</strong>pedidos</div>
              <div class="profile-stat"><strong>${favs.length}</strong>favoritos</div>
              <div class="profile-stat"><strong>${cart.length}</strong>carrinho</div>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" style="margin-left:auto;align-self:flex-start" onclick="doLogout()">Sair</button>
        </div>
        <div class="profile-tabs">
          <div class="profile-tab active" onclick="switchProfileTab(this,'tab-info')">Dados</div>
          <div class="profile-tab" onclick="switchProfileTab(this,'tab-orders')">Pedidos</div>
          <div class="profile-tab" onclick="switchProfileTab(this,'tab-cart')">Carrinho</div>
          <div class="profile-tab" onclick="switchProfileTab(this,'tab-favs')">Favoritos</div>
          ${u.isAdmin ? `<div class="profile-tab" onclick="navigate('admin-users')">Admin</div>` : ''}
          ${u.isSeller ? `<div class="profile-tab" onclick="navigate('seller-dashboard')">Vendedor</div>` : ''}
        </div>
      </div>
    </div>
    <div class="page-container" style="max-width:1000px;margin:0 auto">
      <div id="tab-info">
        <div style="max-width:480px;margin-top:20px">
          <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:14px">EDITAR PERFIL</h3>
          <div class="form-group"><label>Bio</label><textarea class="form-control" id="edit-bio" placeholder="Fale sobre você...">${u.bio || ''}</textarea></div>
          <div class="form-group"><label>E-mail</label><input class="form-control" id="edit-email" value="${u.email || ''}" type="email"></div>
          <div class="form-group"><label>Telefone</label><input class="form-control" id="edit-phone" value="${u.phone || ''}" type="tel"></div>
          <button class="btn btn-primary" onclick="saveProfile()">Salvar alterações</button>

          ${u.isSeller ? `
          <div class="divider"></div>
          <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:14px">MINHA CHAVE PIX</h3>
          <div class="pix-setup-card">
            <div class="form-group">
              <label>Tipo de chave PIX</label>
              <select class="form-control" id="pix-type">
                <option value="email" ${u.pixKeyType === 'email' ? 'selected' : ''}>E-mail</option>
                <option value="cpf" ${u.pixKeyType === 'cpf' ? 'selected' : ''}>CPF</option>
                <option value="cnpj" ${u.pixKeyType === 'cnpj' ? 'selected' : ''}>CNPJ</option>
                <option value="telefone" ${u.pixKeyType === 'telefone' ? 'selected' : ''}>Telefone</option>
                <option value="aleatoria" ${u.pixKeyType === 'aleatoria' ? 'selected' : ''}>Chave Aleatória</option>
              </select>
            </div>
            <div class="form-group">
              <label>Chave PIX *</label>
              <input class="form-control" id="pix-key" value="${u.pixKey || ''}" placeholder="Ex: seu@email.com, 000.000.000-00...">
            </div>
            ${u.pixKey ? `
              <div style="background:rgba(68,255,136,0.07);border:1px solid rgba(68,255,136,0.2);border-radius:var(--radius);padding:12px;margin-bottom:14px;font-size:12px">
                <div style="color:var(--success);font-weight:600;margin-bottom:4px">✓ Chave PIX cadastrada</div>
                <div style="color:var(--text2);font-family:'Space Mono',monospace">${u.pixKey}</div>
                <div style="color:var(--text3);margin-top:2px">Tipo: ${u.pixKeyType}</div>
              </div>
            ` : `
              <div style="background:rgba(255,204,0,0.07);border:1px solid rgba(255,204,0,0.2);border-radius:var(--radius);padding:12px;margin-bottom:14px;font-size:12px;color:var(--warning)">
                ⚠ Nenhuma chave PIX cadastrada. Seus clientes não poderão pagar via PIX.
              </div>
            `}
            <button class="btn btn-primary" onclick="savePixKey()">💾 Salvar chave PIX</button>
          </div>
          ` : ''}
        </div>
      </div>
      <div id="tab-orders" style="display:none">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin:20px 0 14px">MEUS PEDIDOS</h3>
        ${orders.length === 0 ? `<div class="empty-state"><div class="icon">📦</div><h3>Nenhum pedido ainda</h3></div>` :
          [...orders].reverse().map(o => renderOrderCard(o)).join('')}
      </div>
      <div id="tab-cart" style="display:none">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin:20px 0 14px">MEU CARRINHO</h3>
        ${renderCartContent()}
      </div>
      <div id="tab-favs" style="display:none">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin:20px 0 14px">FAVORITOS</h3>
        ${renderFavsContent()}
      </div>
    </div>
  `;
}

function switchProfileTab(el, tabId) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
  const tab = document.getElementById(tabId);
  if (tab) tab.style.display = 'block';
}

function renderOrderCard(o) {
  const p = DB.getProducts().find(pr => pr.id === o.productId);
  const statusLabels = {
    pending_payment: { label: 'Aguardando', color: 'var(--warning)' },
    paid: { label: 'Pago', color: 'var(--success)' },
    processing: { label: 'Processando', color: 'var(--text2)' },
    shipped: { label: 'Enviado', color: '#4488ff' },
    delivered: { label: 'Entregue', color: 'var(--success)' },
    cancelled: { label: 'Cancelado', color: 'var(--danger)' },
  };
  const st = statusLabels[o.status] || { label: o.status, color: 'var(--text2)' };
  return `
    <div class="cart-item" style="cursor:pointer" onclick="navigate('tracking',{id:'${o.id}'})">
      <img class="cart-item-img" src="${p?.images[0] || ''}" alt="" onerror="this.src='https://via.placeholder.com/80x80/111/444?text=?'">
      <div class="cart-item-info">
        <div class="cart-item-title">${p?.title || 'Produto'}</div>
        <div style="font-size:11px;color:var(--text3)">${timeAgo(o.createdAt)} • Qtd: ${o.quantity}</div>
        <div class="cart-item-price" style="margin-top:4px">${fmt(o.total)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:${st.color}">${st.label}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">→ Rastrear</div>
      </div>
    </div>
  `;
}

function uploadAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const users = DB.getUsers();
    const idx = users.findIndex(u => u.id === state.user.id);
    if (idx >= 0) {
      users[idx].avatar = dataUrl;
      DB.setUsers(users);
      state.user = users[idx];
      DB.setCurrent(state.user);
      document.getElementById('profile-avatar-img').src = dataUrl;
      renderNav();
      toast('Foto atualizada!', 'success');
    }
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  const bio = document.getElementById('edit-bio')?.value || '';
  const email = document.getElementById('edit-email')?.value || '';
  const phone = document.getElementById('edit-phone')?.value || '';
  const users = DB.getUsers();
  const idx = users.findIndex(u => u.id === state.user.id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], bio, email, phone };
    DB.setUsers(users);
    state.user = users[idx];
    DB.setCurrent(state.user);
    toast('Perfil salvo!', 'success');
  }
}

// ─── SELLER PIX ──────────────────────────────────────────────
function savePixKey() {
  const pixKey = document.getElementById('pix-key')?.value?.trim();
  const pixKeyType = document.getElementById('pix-type')?.value;
  if (!pixKey) { toast('Informe a chave PIX', 'error'); return; }

  const users = DB.getUsers();
  const idx = users.findIndex(u => u.id === state.user.id);
  if (idx >= 0) {
    users[idx].pixKey = pixKey;
    users[idx].pixKeyType = pixKeyType;
    DB.setUsers(users);
    state.user = users[idx];
    DB.setCurrent(state.user);
    toast('Chave PIX salva!', 'success');
    render();
  }
}

function renderSellerPix() {
  if (!state.user?.isSeller) { navigate('home'); return ''; }
  const u = state.user;
  return `
    <div class="page-container" style="padding-top:24px;max-width:560px;margin:0 auto">
      <button class="btn btn-outline btn-sm" style="margin-bottom:20px" onclick="history.back()">← Voltar</button>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:6px">CHAVE PIX</h2>
      <p style="color:var(--text3);margin-bottom:24px;font-size:13px">Configure sua chave PIX para receber pagamentos</p>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:24px">
        <div class="form-group">
          <label>Tipo de Chave *</label>
          <select class="form-control" id="pix-type">
            <option value="email" ${u.pixKeyType === 'email' ? 'selected' : ''}>📧 E-mail</option>
            <option value="cpf" ${u.pixKeyType === 'cpf' ? 'selected' : ''}>🪪 CPF</option>
            <option value="cnpj" ${u.pixKeyType === 'cnpj' ? 'selected' : ''}>🏢 CNPJ</option>
            <option value="telefone" ${u.pixKeyType === 'telefone' ? 'selected' : ''}>📱 Telefone</option>
            <option value="aleatoria" ${u.pixKeyType === 'aleatoria' ? 'selected' : ''}>🔀 Chave Aleatória</option>
          </select>
        </div>
        <div class="form-group">
          <label>Chave PIX *</label>
          <input class="form-control" id="pix-key" value="${u.pixKey || ''}" placeholder="Ex: seu@email.com, 000.000.000-00...">
        </div>

        ${u.pixKey ? `
          <div style="background:rgba(68,255,136,0.07);border:1px solid rgba(68,255,136,0.2);border-radius:var(--radius);padding:14px;margin-bottom:16px">
            <div style="font-size:11px;font-weight:600;color:var(--success);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">✓ Chave PIX Cadastrada</div>
            <div style="font-family:'Space Mono',monospace;font-size:13px;word-break:break-all">${u.pixKey}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px">Tipo: ${u.pixKeyType}</div>
          </div>
        ` : `
          <div style="background:rgba(255,204,0,0.07);border:1px solid rgba(255,204,0,0.2);border-radius:var(--radius);padding:14px;margin-bottom:16px">
            <div style="font-size:12px;color:var(--warning)">⚠ Nenhuma chave PIX cadastrada. Configure agora para receber pagamentos dos seus clientes.</div>
          </div>
        `}

        <button class="btn btn-primary btn-full" onclick="savePixKey()">💾 Salvar Chave PIX</button>
      </div>

      <div style="margin-top:16px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2)">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;margin-bottom:10px;color:var(--text2)">COMO FUNCIONA</h3>
        <div style="font-size:12px;color:var(--text3);line-height:1.8">
          <p>• Quando um cliente finalizar uma compra, sua chave PIX será exibida para pagamento</p>
          <p>• O QR Code será gerado automaticamente com sua chave</p>
          <p>• Mantenha sua chave atualizada para não perder vendas</p>
        </div>
      </div>
    </div>
  `;
}

// ─── SELLER PROFILE (public) ──────────────────────────────────
function renderSellerProfile() {
  const seller = DB.getUsers().find(u => u.id === state.params.id);
  if (!seller) return `<div class="page-container"><div class="empty-state"><div class="icon">😕</div><h3>Vendedor não encontrado</h3></div></div>`;
  const products = DB.getProducts().filter(p => p.sellerId === seller.id);
  const favs = state.user ? DB.getFavs().filter(f => f.userId === state.user.id).map(f => f.productId) : [];
  const coupons = DB.getCoupons();
  const isOwnProfile = state.user?.id === seller.id;

  return `
    <div class="profile-header">
      <div class="profile-header-inner">
        <div class="profile-top">
          <img class="profile-avatar" src="${seller.avatar}" alt="${seller.username}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${seller.username}'">
          <div class="profile-info">
            <h2>${seller.username}</h2>
            ${seller.isAdmin ? '<div class="seller-badge">⭐ Vendedor Oficial</div>' : seller.isSeller ? '<div class="seller-badge">✓ Vendedor</div>' : ''}
            <div style="font-size:12px;color:var(--text2);margin-top:6px">${seller.bio || ''}</div>
            <div class="profile-stats">
              <div class="profile-stat"><strong>${products.length}</strong>produtos</div>
              <div class="profile-stat"><strong>${products.reduce((a,p) => a + (p.sold||0), 0)}</strong>vendidos</div>
            </div>
          </div>
          ${!isOwnProfile ? `
          <button class="btn btn-outline btn-sm" style="margin-left:auto;align-self:flex-start;gap:6px" onclick="openChat('${seller.id}')">
            💬 Conversar
          </button>` : ''}
        </div>
        <div class="profile-tabs">
          <div class="profile-tab active">Produtos</div>
        </div>
      </div>
    </div>
    <div class="page-container">
      ${products.length === 0 ?
        `<div class="empty-state"><div class="icon">📦</div><h3>Nenhum produto ainda</h3></div>` :
        `<div class="product-grid">${products.map(p => renderProductCard(p, favs, coupons)).join('')}</div>`
      }
    </div>
  `;
}

// ─── CART ────────────────────────────────────────────────────
function renderCart() {
  if (!state.user) { showLogin(); return ''; }
  const cartItems = DB.getCart().filter(c => c.userId === state.user.id);
  const products = DB.getProducts();
  let total = 0;

  const itemsHtml = cartItems.length === 0 ? `<div class="empty-state"><div class="icon">🛒</div><h3>Carrinho vazio</h3><p>Adicione produtos!</p></div>` :
    cartItems.map(item => {
      const p = products.find(pr => pr.id === item.productId);
      if (!p) return '';
      const subtotal = p.price * item.quantity;
      total += subtotal;
      return `
        <div class="cart-item">
          <img class="cart-item-img" src="${p.images[0]}" alt="${p.title}" onclick="navigate('product',{id:'${p.id}'})" style="cursor:pointer" onerror="this.src='https://via.placeholder.com/80x80/111/444?text=?'">
          <div class="cart-item-info">
            <div class="cart-item-title">${p.title}</div>
            <div style="font-size:11px;color:var(--text3)">${fmt(p.price)} un.</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
              <button class="qty-btn" onclick="updateCartQty('${item.productId}',-1)" style="width:32px;height:32px;font-size:16px">−</button>
              <span style="font-family:'Space Mono',monospace;font-size:14px">${item.quantity}</span>
              <button class="qty-btn" onclick="updateCartQty('${item.productId}',1)" style="width:32px;height:32px;font-size:16px">+</button>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="cart-item-price">${fmt(subtotal)}</div>
            <button class="btn btn-outline btn-sm" style="margin-top:6px;border-color:var(--danger);color:var(--danger)" onclick="removeFromCart('${item.productId}')">×</button>
          </div>
        </div>
      `;
    }).join('');

  return `
    <div class="page-container" style="padding-top:24px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">🛒 CARRINHO</h2>
      <div class="checkout-layout">
        <div>${itemsHtml}</div>
        ${cartItems.length > 0 ? `
        <div class="cart-summary">
          <h3>RESUMO</h3>
          <div class="summary-row"><span>Subtotal</span><span>${fmt(total)}</span></div>
          <div class="summary-row"><span>Frete</span><span>A calcular</span></div>
          <div class="summary-row total"><span>Total</span><span>${fmt(total)}</span></div>
          <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="checkoutCart()">Finalizar compra →</button>
        </div>` : ''}
      </div>
    </div>
  `;
}

function renderCartContent() {
  if (!state.user) return '';
  const cartItems = DB.getCart().filter(c => c.userId === state.user.id);
  if (cartItems.length === 0) return `<div class="empty-state" style="padding:40px"><div class="icon">🛒</div><h3>Carrinho vazio</h3></div>`;
  return cartItems.map(item => {
    const p = DB.getProducts().find(pr => pr.id === item.productId);
    if (!p) return '';
    return `
      <div class="cart-item" style="cursor:pointer" onclick="navigate('product',{id:'${p.id}'})">
        <img class="cart-item-img" src="${p.images[0]}" alt="${p.title}" onerror="this.src='https://via.placeholder.com/80x80/111/444?text=?'">
        <div class="cart-item-info">
          <div class="cart-item-title">${p.title}</div>
          <div class="cart-item-price">${fmt(p.price)} × ${item.quantity}</div>
        </div>
        <button class="btn btn-outline btn-sm" style="border-color:var(--danger);color:var(--danger)" onclick="event.stopPropagation();removeFromCart('${item.productId}');render()">×</button>
      </div>
    `;
  }).join('');
}

function renderFavsContent() {
  if (!state.user) return '';
  const favs = DB.getFavs().filter(f => f.userId === state.user.id);
  if (favs.length === 0) return `<div class="empty-state" style="padding:40px"><div class="icon">❤</div><h3>Nenhum favorito</h3></div>`;
  const favProds = favs.map(f => DB.getProducts().find(p => p.id === f.productId)).filter(Boolean);
  return `<div class="product-grid">${favProds.map(p => renderProductCard(p, favs.map(f => f.productId), DB.getCoupons())).join('')}</div>`;
}

function renderFavorites() {
  if (!state.user) { showLogin(); return ''; }
  const favs = DB.getFavs().filter(f => f.userId === state.user.id);
  const favProds = favs.map(f => DB.getProducts().find(p => p.id === f.productId)).filter(Boolean);
  return `
    <div class="page-container" style="padding-top:24px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">❤ FAVORITOS</h2>
      ${favProds.length === 0 ? `<div class="empty-state"><div class="icon">❤</div><h3>Nenhum favorito ainda</h3></div>` :
        `<div class="product-grid">${favProds.map(p => renderProductCard(p, favs.map(f => f.productId), DB.getCoupons())).join('')}</div>`}
    </div>
  `;
}

// ─── CART ACTIONS ─────────────────────────────────────────────
function addToCart(productId) {
  if (!state.user) { showLogin(); return; }
  const cart = DB.getCart();
  const qty = parseInt(document.getElementById('qty-input')?.value) || 1;
  const existing = cart.find(c => c.userId === state.user.id && c.productId === productId);
  if (existing) existing.quantity = Math.min(existing.quantity + qty, 99);
  else cart.push({ userId: state.user.id, productId, quantity: qty });
  DB.setCart(cart);
  toast('Adicionado ao carrinho!', 'success');
  renderNav();
}

function removeFromCart(productId) {
  DB.setCart(DB.getCart().filter(c => !(c.userId === state.user.id && c.productId === productId)));
  renderNav();
}

function updateCartQty(productId, delta) {
  const cart = DB.getCart();
  const item = cart.find(c => c.userId === state.user.id && c.productId === productId);
  if (item) {
    item.quantity = Math.max(1, item.quantity + delta);
    DB.setCart(cart);
    render();
  }
}

function toggleFav(productId) {
  if (!state.user) { showLogin(); return; }
  const favs = DB.getFavs();
  const idx = favs.findIndex(f => f.userId === state.user.id && f.productId === productId);
  if (idx >= 0) { favs.splice(idx, 1); toast('Removido dos favoritos', 'info'); }
  else { favs.push({ userId: state.user.id, productId }); toast('Adicionado aos favoritos!', 'success'); }
  DB.setFavs(favs);
  renderNav();
  render();
}

function checkoutCart() {
  const cartItems = DB.getCart().filter(c => c.userId === state.user.id);
  if (cartItems.length === 0) return;
  ssSet('checkout_cart', cartItems);
  navigate('checkout', { id: 'cart' });
}

function buyNow(productId) {
  if (!state.user) { showLogin(); return; }
  const qty = parseInt(document.getElementById('qty-input')?.value) || 1;
  ssSet('buy_now', { productId, quantity: qty });
  navigate('checkout', { id: productId });
}

// ─── CHECKOUT ─────────────────────────────────────────────────
function renderCheckout() {
  if (!state.user) { showLogin(); return ''; }
  const isCart = state.params.id === 'cart';
  const cartItems = isCart ? ssGet('checkout_cart', []) : null;
  const buyNowData = !isCart ? ssGet('buy_now', null) : null;

  let items = [];
  let total = 0;
  const products = DB.getProducts();
  const coupon = ssGet('applied_coupon', null);

  if (isCart && cartItems) {
    items = cartItems.map(c => {
      const p = products.find(pr => pr.id === c.productId);
      if (!p) return null;
      const sub = p.price * c.quantity;
      total += sub;
      return { product: p, quantity: c.quantity, subtotal: sub };
    }).filter(Boolean);
  } else if (buyNowData) {
    const p = products.find(pr => pr.id === buyNowData.productId);
    if (p) { const sub = p.price * buyNowData.quantity; total += sub; items = [{ product: p, quantity: buyNowData.quantity, subtotal: sub }]; }
  }

  const discountedTotal = coupon ? total * (1 - coupon.discount / 100) : total;

  // ⚡ FIX: Store order data globally to avoid JSON serialization in onclick attribute
  _pendingOrderData = {
    total: discountedTotal,
    originalTotal: total,
    items: items.map(i => ({ id: i.product.id, qty: i.quantity, price: i.product.price })),
  };

  return `
    <div class="page-container" style="padding-top:24px">
      <button class="btn btn-outline btn-sm" style="margin-bottom:20px" onclick="history.back()">← Voltar</button>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">CHECKOUT</h2>
      <div class="checkout-layout">
        <div>
          <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:16px">DADOS DE ENTREGA</h3>
          <div class="form-group"><label>Nome completo *</label><input class="form-control" id="co-name" value="${state.user.username}"></div>
          <div class="form-group"><label>E-mail *</label><input class="form-control" id="co-email" type="email" value="${state.user.email || ''}"></div>
          <div class="form-group"><label>Telefone *</label><input class="form-control" id="co-phone" value="${state.user.phone || ''}" type="tel"></div>
          <div class="divider"></div>
          <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:16px">ENDEREÇO</h3>
          <div class="two-col">
            <div class="form-group"><label>CEP *</label><input class="form-control" id="co-cep" placeholder="00000-000" oninput="fetchCEP(this.value)"></div>
            <div class="form-group"><label>Número *</label><input class="form-control" id="co-num"></div>
          </div>
          <div class="form-group"><label>Rua *</label><input class="form-control" id="co-street"></div>
          <div class="two-col">
            <div class="form-group"><label>Bairro</label><input class="form-control" id="co-neighborhood"></div>
            <div class="form-group"><label>Complemento</label><input class="form-control" id="co-complement"></div>
          </div>
          <div class="two-col">
            <div class="form-group"><label>Cidade *</label><input class="form-control" id="co-city"></div>
            <div class="form-group"><label>Estado *</label><input class="form-control" id="co-state"></div>
          </div>
        </div>
        <div>
          <div class="cart-summary">
            <h3>RESUMO</h3>
            ${items.map(i => `
              <div class="summary-row" style="align-items:center;gap:8px">
                <img src="${i.product.images[0]}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0" onerror="this.style.display='none'">
                <span style="flex:1;font-size:12px">${i.product.title} ×${i.quantity}</span>
                <span>${fmt(i.subtotal)}</span>
              </div>
            `).join('')}
            ${coupon ? `<div class="summary-row" style="color:var(--success)"><span>Cupom (${coupon.discount}%)</span><span>-${fmt(total - discountedTotal)}</span></div>` : ''}
            <div class="summary-row total"><span>Total</span><span>${fmt(discountedTotal)}</span></div>
            <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="placeOrder()">
              Confirmar e Pagar →
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function fetchCEP(cep) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const d = await r.json();
    if (d.erro) return;
    document.getElementById('co-street').value = d.logradouro || '';
    document.getElementById('co-neighborhood').value = d.bairro || '';
    document.getElementById('co-city').value = d.localidade || '';
    document.getElementById('co-state').value = d.uf || '';
  } catch {}
}

// ⚡ FIX: placeOrder reads from global _pendingOrderData instead of inline params
function placeOrder() {
  if (!state.user) return;
  if (!_pendingOrderData) { toast('Erro ao processar pedido. Tente novamente.', 'error'); return; }

  const { total, originalTotal, items: itemsData } = _pendingOrderData;

  const name = document.getElementById('co-name')?.value?.trim();
  const email = document.getElementById('co-email')?.value?.trim();
  const phone = document.getElementById('co-phone')?.value?.trim();
  const street = document.getElementById('co-street')?.value?.trim();
  const num = document.getElementById('co-num')?.value?.trim();
  const city = document.getElementById('co-city')?.value?.trim();
  const st = document.getElementById('co-state')?.value?.trim();

  if (!name || !email || !phone || !street || !num || !city || !st) {
    toast('Preencha todos os campos obrigatórios', 'error'); return;
  }

  const address = { name, email, phone, street, num, city, state: st,
    neighborhood: document.getElementById('co-neighborhood')?.value || '',
    complement: document.getElementById('co-complement')?.value || '' };

  const coupon = ssGet('applied_coupon', null);
  const products = DB.getProducts();
  const orders = DB.getOrders();
  let firstOrderId = null;

  const bySeller = {};
  itemsData.forEach(item => {
    const p = products.find(pr => pr.id === item.id);
    if (!p) return;
    if (!bySeller[p.sellerId]) bySeller[p.sellerId] = [];
    bySeller[p.sellerId].push({ ...item, sellerId: p.sellerId, productId: p.id });
  });

  Object.entries(bySeller).forEach(([sellerId, sellerItems]) => {
    const seller = DB.getUsers().find(u => u.id === sellerId);
    const orderTotal = sellerItems.reduce((a, i) => a + i.price * i.qty, 0) * (coupon && coupon.sellerId === sellerId ? (1 - coupon.discount / 100) : 1);
    const pixKey = seller?.pixKey || `${sellerId}@redzinmarket.com`;
    const order = {
      id: uid(), buyerId: state.user.id, sellerId, productId: sellerItems[0].productId,
      quantity: sellerItems[0].qty, items: sellerItems, address,
      total: parseFloat(orderTotal.toFixed(2)),
      coupon: coupon && coupon.sellerId === sellerId ? coupon : null,
      pixKey,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      tracking: [{ status: 'Pedido realizado', date: new Date().toISOString(), location: 'REDZIN MARKET' }],
    };
    if (!firstOrderId) firstOrderId = order.id;
    orders.push(order);

    const notifs = DB.getNotifs();
    const p = products.find(pr => pr.id === sellerItems[0].productId);
    notifs.push({
      id: uid(), userId: sellerId, type: 'order',
      message: `🛍 Novo pedido de ${state.user.username}: ${p?.title || 'Produto'} — ${fmt(orderTotal)}`,
      orderId: order.id, read: false, createdAt: new Date().toISOString(),
    });
    DB.setNotifs(notifs);
  });

  DB.setOrders(orders);
  ssRemove('applied_coupon');
  ssRemove('buy_now');
  ssRemove('checkout_cart');
  DB.setCart(DB.getCart().filter(c => c.userId !== state.user.id || !itemsData.find(i => i.id === c.productId)));

  _pendingOrderData = null;
  navigate('payment', { id: firstOrderId });
}

function getSellerPixKey(sellerId) {
  const seller = DB.getUsers().find(u => u.id === sellerId);
  return seller?.pixKey || `${sellerId}@redzinmarket.com`;
}

// ─── PAYMENT PAGE ──────────────────────────────────────────────
function renderPayment() {
  const order = DB.getOrders().find(o => o.id === state.params.id);
  if (!order) return `<div class="page-container"><div class="empty-state"><div class="icon">😕</div><h3>Pedido não encontrado</h3></div></div>`;
  const product = DB.getProducts().find(p => p.id === order.productId);
  const isPaid = order.status !== 'pending_payment';

  return `
    <div class="page-container" style="padding-top:24px">
      <div class="payment-box">
        ${isPaid ? `
          <div style="font-size:56px;margin-bottom:14px">✅</div>
          <h2>PAGAMENTO<br>CONFIRMADO</h2>
          <p style="color:var(--text2);margin:14px 0">Pedido confirmado! Vendedor notificado.</p>
          <button class="btn btn-primary" onclick="navigate('tracking',{id:'${order.id}'})">Rastrear pedido →</button>
        ` : `
          <h2>PAGUE VIA<br>PIX</h2>
          <p style="color:var(--text2);font-size:13px">${product?.title || 'Produto'} — ${fmt(order.total)}</p>
          <div id="qrcode"></div>
          <p style="font-size:11px;color:var(--text3);margin-bottom:6px">Ou copie a chave PIX:</p>
          <div class="pix-key-box">
            <span id="pix-key-text">${order.pixKey}</span>
            <button class="btn btn-outline btn-sm" onclick="copyPixKey('${order.pixKey}')">Copiar</button>
          </div>
          <div class="payment-status pending" id="payment-status">⏳ Aguardando confirmação...</div>
          <div class="countdown" id="payment-countdown">10:00</div>
          <div class="progress-bar"><div class="progress-fill" id="payment-progress" style="width:100%"></div></div>
          <p style="font-size:11px;color:var(--text3);margin-bottom:14px">Após pagar, confirme abaixo</p>
          <button class="btn btn-success btn-full" onclick="simulatePayment('${order.id}')">✓ Já realizei o pagamento</button>
          <button class="btn btn-outline btn-full" style="margin-top:8px" onclick="navigate('tracking',{id:'${order.id}'})">Rastrear pedido</button>
        `}
      </div>
    </div>
  `;
}

function attachEvents() {
  if (state.route === 'payment') {
    const order = DB.getOrders().find(o => o.id === state.params.id);
    if (order && order.status === 'pending_payment') {
      setTimeout(() => {
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer && typeof QRCode !== 'undefined') {
          new QRCode(qrContainer, {
            text: generatePixPayload(order.total, order.pixKey),
            width: 180, height: 180,
            colorDark: '#000000', colorLight: '#ffffff',
          });
        }
        startPaymentCountdown(order.id);
      }, 100);
    }
  }
}

function generatePixPayload(amount, key) {
  return `00020126580014BR.GOV.BCB.PIX0136${key}5204000053039865406${amount.toFixed(2)}5802BR5913REDZIN MARKET6009SAO PAULO62140510REDZINMKT6304ABCD`;
}

function startPaymentCountdown(orderId) {
  let seconds = 600;
  const interval = setInterval(() => {
    seconds--;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    const cd = document.getElementById('payment-countdown');
    const pb = document.getElementById('payment-progress');
    if (cd) cd.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    if (pb) pb.style.width = `${(seconds / 600) * 100}%`;
    if (seconds <= 0) clearInterval(interval);
    const order = DB.getOrders().find(o => o.id === orderId);
    if (order && order.status !== 'pending_payment') clearInterval(interval);
  }, 1000);
}

function copyPixKey(key) {
  navigator.clipboard.writeText(key).then(() => toast('Chave PIX copiada!', 'success')).catch(() => {
    const el = document.createElement('textarea');
    el.value = key; document.body.appendChild(el); el.select();
    document.execCommand('copy'); el.remove();
    toast('Chave PIX copiada!', 'success');
  });
}

function simulatePayment(orderId) {
  const btn = event.target;
  btn.textContent = 'Verificando...';
  btn.disabled = true;
  setTimeout(() => confirmPayment(orderId), 2000);
}

function confirmPayment(orderId) {
  const orders = DB.getOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx < 0) return;
  orders[idx].status = 'paid';
  orders[idx].paidAt = new Date().toISOString();
  orders[idx].tracking.push({ status: 'Pagamento confirmado', date: new Date().toISOString(), location: 'Sistema financeiro' });
  DB.setOrders(orders);

  const order = orders[idx];
  const notifs = DB.getNotifs();
  const product = DB.getProducts().find(p => p.id === order.productId);
  notifs.push({ id: uid(), userId: order.sellerId, type: 'sale', message: `🛍 Novo pedido! ${product?.title || 'Produto'} — ${fmt(order.total)} — de ${state.user?.username || 'comprador'}`, orderId: order.id, read: false, createdAt: new Date().toISOString() });
  DB.setNotifs(notifs);

  const products = DB.getProducts();
  const pi = products.findIndex(p => p.id === order.productId);
  if (pi >= 0) { products[pi].sold = (products[pi].sold || 0) + order.quantity; DB.setProducts(products); }

  const statusEl = document.getElementById('payment-status');
  if (statusEl) { statusEl.className = 'payment-status confirmed'; statusEl.textContent = '✓ Pagamento confirmado!'; }
  setTimeout(() => render(), 1500);
}

// ─── TRACKING ────────────────────────────────────────────────
function renderTracking() {
  const order = DB.getOrders().find(o => o.id === state.params.id);
  if (!order) return `<div class="page-container"><div class="empty-state"><div class="icon">😕</div><h3>Pedido não encontrado</h3></div></div>`;

  const product = DB.getProducts().find(p => p.id === order.productId);
  const isSeller = state.user && state.user.id === order.sellerId;
  const buyer = DB.getUsers().find(u => u.id === order.buyerId);

  const statusLabels = {
    pending_payment: { label: '⏳ Aguardando Pagamento', color: 'var(--warning)' },
    paid: { label: '✓ Pago', color: 'var(--success)' },
    processing: { label: '⚙ Processando', color: 'var(--text2)' },
    shipped: { label: '🚚 Enviado', color: '#4488ff' },
    delivered: { label: '✅ Entregue', color: 'var(--success)' },
  };
  const st = statusLabels[order.status] || { label: order.status, color: 'var(--text2)' };

  const trackingSteps = (order.tracking || []).map(t => `
    <div class="tracking-step done">
      <div class="tracking-step-dot"></div>
      <div class="tracking-step-title">${t.status}</div>
      <div class="tracking-step-date">${t.location} • ${new Date(t.date).toLocaleString('pt-BR')}</div>
    </div>
  `).join('');

  const chatBtn = isSeller && buyer ? `
    <button class="chat-seller-btn" style="margin-top:16px" onclick="openChat('${buyer.id}')">
      💬 Falar com o comprador (${buyer.username})
    </button>
  ` : !isSeller ? `
    <button class="chat-seller-btn" style="margin-top:16px" onclick="openChat('${order.sellerId}')">
      💬 Falar com o vendedor
    </button>
  ` : '';

  const sellerPanel = isSeller ? `
    <div class="divider"></div>
    <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:14px">ATUALIZAR RASTREAMENTO</h3>
    <div class="form-group"><label>Status</label>
      <select class="form-control" id="track-status">
        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>⚙ Processando</option>
        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>🚚 Enviado</option>
        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>✅ Entregue</option>
      </select>
    </div>
    <div class="form-group"><label>Localização</label><input class="form-control" id="track-location" placeholder="Ex: Centro de Triagem SP"></div>
    <div class="form-group"><label>Descrição</label><input class="form-control" id="track-desc" placeholder="Ex: Produto saiu para entrega"></div>
    <button class="btn btn-primary" onclick="updateTracking('${order.id}')">Atualizar</button>
    ${chatBtn}
  ` : chatBtn;

  return `
    <div class="page-container" style="padding-top:24px;max-width:700px;margin:0 auto">
      <button class="btn btn-outline btn-sm" style="margin-bottom:20px" onclick="history.back()">← Voltar</button>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap">
        <img src="${product?.images[0]}" style="width:54px;height:54px;object-fit:cover;border-radius:8px;border:1px solid var(--border)" onerror="this.style.display='none'">
        <div>
          <h2 style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px">${product?.title || 'Produto'}</h2>
          <div style="color:${st.color};font-size:13px;font-weight:600;margin-top:3px">${st.label}</div>
        </div>
        <div style="margin-left:auto;font-family:'Space Mono',monospace;font-size:18px;font-weight:700">${fmt(order.total)}</div>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:20px;margin-bottom:16px">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;margin-bottom:14px">ENDEREÇO</h3>
        <p style="font-size:13px;color:var(--text2)">${order.address.name} • ${order.address.phone}</p>
        <p style="font-size:13px;color:var(--text2)">${order.address.street}, ${order.address.num}</p>
        <p style="font-size:13px;color:var(--text2)">${order.address.city} — ${order.address.state}</p>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:20px">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;margin-bottom:16px">RASTREAMENTO</h3>
        <div class="tracking-steps">${trackingSteps || '<p style="color:var(--text3)">Sem atualizações</p>'}</div>
        ${sellerPanel}
      </div>
    </div>
  `;
}

function updateTracking(orderId) {
  const status = document.getElementById('track-status')?.value;
  const location = document.getElementById('track-location')?.value?.trim() || 'Não especificado';
  const desc = document.getElementById('track-desc')?.value?.trim() || status;

  const orders = DB.getOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx < 0) return;
  orders[idx].status = status;
  orders[idx].tracking.push({ status: desc, date: new Date().toISOString(), location });
  DB.setOrders(orders);

  const order = orders[idx];
  const notifs = DB.getNotifs();
  const product = DB.getProducts().find(p => p.id === order.productId);
  notifs.push({ id: uid(), userId: order.buyerId, type: 'tracking', message: `📦 Pedido "${product?.title}": ${desc} — ${location}`, orderId: order.id, read: false, createdAt: new Date().toISOString() });
  DB.setNotifs(notifs);

  toast('Rastreamento atualizado!', 'success');
  render();
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function renderNotifications() {
  if (!state.user) { showLogin(); return ''; }
  const notifs = DB.getNotifs().filter(n => n.userId === state.user.id).reverse();
  const allNotifs = DB.getNotifs();
  allNotifs.forEach(n => { if (n.userId === state.user.id) n.read = true; });
  DB.setNotifs(allNotifs);

  return `
    <div class="page-container" style="padding-top:24px;max-width:700px;margin:0 auto">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">🔔 NOTIFICAÇÕES</h2>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);overflow:hidden">
        ${notifs.length === 0 ? `<div class="empty-state"><div class="icon">🔔</div><h3>Nenhuma notificação</h3></div>` :
          notifs.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}" onclick="${n.orderId ? `navigate('tracking',{id:'${n.orderId}'})` : n.chatRoomId ? `openChat('${n.otherUserId}')` : ''}">
              <div class="notif-dot ${n.read ? 'read' : ''}"></div>
              <div>
                <div class="notif-text">${n.message}</div>
                <div class="notif-time">${timeAgo(n.createdAt)}</div>
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;
}

// ─── ORDERS PAGE ──────────────────────────────────────────────
function renderOrders() {
  if (!state.user) { showLogin(); return ''; }
  const orders = DB.getOrders().filter(o => o.buyerId === state.user.id).reverse();
  return `
    <div class="page-container" style="padding-top:24px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">📦 MEUS PEDIDOS</h2>
      ${orders.length === 0 ? `<div class="empty-state"><div class="icon">📦</div><h3>Nenhum pedido ainda</h3></div>` :
        orders.map(o => renderOrderCard(o)).join('')}
    </div>
  `;
}

// ─── SELLER DASHBOARD ─────────────────────────────────────────
function renderSellerDashboard() {
  if (!state.user?.isSeller) { toast('Acesso negado', 'error'); navigate('home'); return ''; }
  const orders = DB.getOrders().filter(o => o.sellerId === state.user.id);
  const products = DB.getProducts().filter(p => p.sellerId === state.user.id);
  const totalRevenue = orders.filter(o => o.status !== 'pending_payment').reduce((a, o) => a + o.total, 0);
  const notifs = DB.getNotifs().filter(n => n.userId === state.user.id && !n.read).length;
  const chatUnread = getUnreadChatCount();
  const u = state.user;
  const hasPixKey = !!(u.pixKey);

  return `
    <div class="page-container" style="padding-top:24px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:6px">PAINEL DO VENDEDOR</h2>
      <p style="color:var(--text3);margin-bottom:24px">Olá, ${state.user.username}!</p>

      ${!hasPixKey ? `
      <div style="background:rgba(255,204,0,0.07);border:1px solid rgba(255,204,0,0.3);border-radius:var(--radius2);padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-size:24px">⚠️</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--warning)">Chave PIX não cadastrada</div>
          <div style="font-size:12px;color:var(--text3)">Configure sua chave PIX para receber pagamentos dos clientes.</div>
        </div>
        <button class="btn btn-outline btn-sm" style="border-color:var(--warning);color:var(--warning)" onclick="navigate('seller-pix')">Configurar PIX →</button>
      </div>
      ` : ''}

      <div class="dash-grid">
        <div class="dash-card">
          <div class="num">${products.length}</div>
          <div class="label">Produtos</div>
        </div>
        <div class="dash-card">
          <div class="num">${orders.length}</div>
          <div class="label">Pedidos</div>
        </div>
        <div class="dash-card">
          <div class="num" style="font-size:24px">${fmt(totalRevenue)}</div>
          <div class="label">Receita</div>
        </div>
        <div class="dash-card">
          <div class="num">${notifs}</div>
          <div class="label">Notificações</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:28px" class="dash-btns-grid">
        <button class="btn btn-primary" onclick="navigate('add-product')">+ Anunciar</button>
        <button class="btn btn-outline" onclick="navigate('seller-products')">Meus Produtos</button>
        <button class="btn btn-outline" onclick="navigate('seller-coupons')">Cupons</button>
        <button class="btn btn-outline" onclick="navigate('seller-pix')">💳 Chave PIX ${hasPixKey ? '✓' : '⚠'}</button>
        <button class="btn btn-outline" onclick="navigate('my-chats')">💬 Chats ${chatUnread > 0 ? `(${chatUnread})` : ''}</button>
        <button class="btn btn-outline" onclick="navigate('notifications')">🔔 ${notifs > 0 ? `(${notifs})` : 'Notifs'}</button>
      </div>

      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:14px">PEDIDOS RECENTES</h3>
      ${orders.length === 0 ? `<div class="empty-state"><div class="icon">📦</div><h3>Nenhum pedido ainda</h3></div>` :
        [...orders].reverse().slice(0, 5).map(o => {
          const product = DB.getProducts().find(p => p.id === o.productId);
          const buyer = DB.getUsers().find(u => u.id === o.buyerId);
          return `
            <div class="cart-item" style="cursor:pointer" onclick="navigate('tracking',{id:'${o.id}'})">
              <img class="cart-item-img" src="${product?.images[0]}" onerror="this.src='https://via.placeholder.com/80x80/111/444?text=?'">
              <div class="cart-item-info">
                <div class="cart-item-title">${product?.title || 'Produto'}</div>
                <div style="font-size:11px;color:var(--text3)">${buyer?.username || 'Comprador'} • ${timeAgo(o.createdAt)}</div>
                <div class="cart-item-price">${fmt(o.total)}</div>
              </div>
              <div style="font-size:12px;color:var(--text2)">${o.status}</div>
            </div>
          `;
        }).join('')
      }
    </div>
  `;
}

// ─── SELLER PRODUCTS ─────────────────────────────────────────
function renderSellerProducts() {
  if (!state.user?.isSeller) { navigate('home'); return ''; }
  const products = DB.getProducts().filter(p => p.sellerId === state.user.id);

  return `
    <div class="page-container" style="padding-top:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px">MEUS PRODUTOS</h2>
        <button class="btn btn-primary btn-sm" onclick="navigate('add-product')">+ Novo</button>
      </div>
      ${products.length === 0 ? `<div class="empty-state"><div class="icon">📦</div><h3>Nenhum produto ainda</h3><button class="btn btn-primary" onclick="navigate('add-product')" style="margin-top:14px">Anunciar produto</button></div>` :
        `<div style="display:grid;gap:10px">
          ${products.map(p => `
            <div style="display:flex;gap:14px;padding:14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);align-items:center">
              <img src="${p.images[0]}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0" onerror="this.src='https://via.placeholder.com/64x64/111/444?text=?'">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.title}</div>
                <div style="font-size:12px;color:var(--text3)">${fmt(p.price)} • ${p.stock} estoque • ${p.sold||0} vendidos</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="btn btn-outline btn-sm" onclick="navigate('edit-product',{id:'${p.id}'})">Editar</button>
                <button class="btn btn-sm" style="background:none;border:1px solid var(--danger);color:var(--danger);padding:8px 10px" onclick="deleteProduct('${p.id}')">×</button>
              </div>
            </div>
          `).join('')}
        </div>`
      }
    </div>
  `;
}

function deleteProduct(id) {
  if (!confirm('Excluir este produto?')) return;
  DB.setProducts(DB.getProducts().filter(p => p.id !== id));
  toast('Produto excluído', 'info');
  render();
}

// ─── ADD/EDIT PRODUCT ──────────────────────────────────────────
function renderAddProduct() {
  if (!state.user?.isSeller) { navigate('home'); return ''; }
  return `
    <div class="page-container" style="padding-top:24px;max-width:680px;margin:0 auto">
      <button class="btn btn-outline btn-sm" style="margin-bottom:20px" onclick="history.back()">← Voltar</button>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">ANUNCIAR PRODUTO</h2>
      <div class="form-group"><label>Título *</label><input class="form-control" id="prod-title" placeholder="Nome do produto"></div>
      <div class="form-group"><label>Descrição *</label><textarea class="form-control" id="prod-desc" placeholder="Descreva o produto..." style="min-height:100px"></textarea></div>
      <div class="two-col">
        <div class="form-group"><label>Preço (R$) *</label><input class="form-control" id="prod-price" type="number" step="0.01" inputmode="decimal"></div>
        <div class="form-group"><label>Preço original</label><input class="form-control" id="prod-orig" type="number" step="0.01" inputmode="decimal"></div>
      </div>
      <div class="two-col">
        <div class="form-group"><label>Estoque *</label><input class="form-control" id="prod-stock" type="number" inputmode="numeric"></div>
        <div class="form-group"><label>Categoria *</label>
          <select class="form-control" id="prod-cat">
            ${['moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'].map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Imagens (URLs)</label>
        <textarea class="form-control" id="prod-images" placeholder="https://exemplo.com/imagem.jpg&#10;Uma URL por linha" style="min-height:70px"></textarea>
      </div>
      <div class="form-group">
        <label>Upload de imagens</label>
        <label class="btn btn-outline" for="prod-img-upload" style="cursor:pointer;display:inline-flex">📎 Selecionar</label>
        <input type="file" id="prod-img-upload" accept="image/*" multiple onchange="handleImageUpload(event)">
        <div class="img-preview-grid" id="img-previews"></div>
      </div>
      <button class="btn btn-primary btn-full" onclick="saveProduct()">Publicar produto</button>
    </div>
  `;
}

let uploadedImages = [];

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const previewContainer = document.getElementById('img-previews');
  uploadedImages = [];
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      uploadedImages.push(e.target.result);
      const img = document.createElement('img');
      img.className = 'img-preview'; img.src = e.target.result;
      previewContainer.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

function saveProduct(editId = null) {
  const title = document.getElementById('prod-title')?.value?.trim();
  const desc = document.getElementById('prod-desc')?.value?.trim();
  const price = parseFloat(document.getElementById('prod-price')?.value);
  const origPrice = parseFloat(document.getElementById('prod-orig')?.value) || null;
  const stock = parseInt(document.getElementById('prod-stock')?.value) || 0;
  const category = document.getElementById('prod-cat')?.value;
  const imageUrls = (document.getElementById('prod-images')?.value || '').split('\n').filter(u => u.trim());
  const allImages = [...uploadedImages, ...imageUrls].filter(Boolean);

  if (!title || !desc || !price || !category) { toast('Preencha os campos obrigatórios', 'error'); return; }

  const products = DB.getProducts();
  if (editId) {
    const idx = products.findIndex(p => p.id === editId);
    if (idx >= 0) {
      products[idx] = { ...products[idx], title, description: desc, price, originalPrice: origPrice, stock, category, images: allImages.length > 0 ? allImages : products[idx].images };
      DB.setProducts(products);
      toast('Produto atualizado!', 'success');
    }
  } else {
    products.push({ id: uid(), sellerId: state.user.id, title, description: desc, price, originalPrice: origPrice, stock, category, images: allImages.length > 0 ? allImages : [`https://via.placeholder.com/400x400/111111/444444?text=${encodeURIComponent(title)}`], sold: 0, createdAt: new Date().toISOString() });
    DB.setProducts(products);
    toast('Produto publicado!', 'success');
  }
  uploadedImages = [];
  navigate('seller-products');
}

function renderEditProduct() {
  if (!state.user?.isSeller) { navigate('home'); return ''; }
  const p = DB.getProducts().find(p => p.id === state.params.id);
  if (!p) return `<div class="page-container"><div class="empty-state"><h3>Produto não encontrado</h3></div></div>`;

  return `
    <div class="page-container" style="padding-top:24px;max-width:680px;margin:0 auto">
      <button class="btn btn-outline btn-sm" style="margin-bottom:20px" onclick="history.back()">← Voltar</button>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">EDITAR PRODUTO</h2>
      <div class="form-group"><label>Título *</label><input class="form-control" id="prod-title" value="${p.title}"></div>
      <div class="form-group"><label>Descrição *</label><textarea class="form-control" id="prod-desc" style="min-height:100px">${p.description}</textarea></div>
      <div class="two-col">
        <div class="form-group"><label>Preço *</label><input class="form-control" id="prod-price" type="number" step="0.01" value="${p.price}" inputmode="decimal"></div>
        <div class="form-group"><label>Original</label><input class="form-control" id="prod-orig" type="number" step="0.01" value="${p.originalPrice || ''}" inputmode="decimal"></div>
      </div>
      <div class="two-col">
        <div class="form-group"><label>Estoque *</label><input class="form-control" id="prod-stock" type="number" value="${p.stock}" inputmode="numeric"></div>
        <div class="form-group"><label>Categoria *</label>
          <select class="form-control" id="prod-cat">
            ${['moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'].map(c => `<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Imagens (URLs)</label>
        <textarea class="form-control" id="prod-images" style="min-height:70px">${p.images.filter(i => i.startsWith('http')).join('\n')}</textarea>
      </div>
      <div class="form-group">
        <label>Upload</label>
        <label class="btn btn-outline" for="prod-img-upload" style="cursor:pointer;display:inline-flex">📎 Selecionar</label>
        <input type="file" id="prod-img-upload" accept="image/*" multiple onchange="handleImageUpload(event)">
        <div class="img-preview-grid" id="img-previews">
          ${p.images.map(img => `<img class="img-preview" src="${img}" onerror="this.style.display='none'">`).join('')}
        </div>
      </div>
      <button class="btn btn-primary btn-full" onclick="saveProduct('${p.id}')">Salvar alterações</button>
    </div>
  `;
}

// ─── SELLER COUPONS ───────────────────────────────────────────
function renderSellerCoupons() {
  if (!state.user?.isSeller) { navigate('home'); return ''; }
  const coupons = DB.getCoupons().filter(c => c.sellerId === state.user.id);

  return `
    <div class="page-container" style="padding-top:24px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:20px">CUPONS</h2>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:20px;margin-bottom:24px;max-width:480px">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:16px">CRIAR CUPOM</h3>
        <div class="form-group"><label>Código *</label><input class="form-control" id="coupon-code" placeholder="DESCONTO10" style="text-transform:uppercase"></div>
        <div class="two-col">
          <div class="form-group"><label>Desconto (%) *</label><input class="form-control" id="coupon-discount" type="number" min="1" max="100" inputmode="numeric"></div>
          <div class="form-group"><label>Usos máximos *</label><input class="form-control" id="coupon-uses" type="number" min="1" inputmode="numeric"></div>
        </div>
        <div class="form-group"><label>Descrição</label><input class="form-control" id="coupon-desc" placeholder="Ex: 10% na primeira compra"></div>
        <button class="btn btn-primary btn-full" onclick="createCoupon()">Criar cupom</button>
      </div>

      ${coupons.length === 0 ? `<div class="empty-state"><div class="icon">🏷</div><h3>Nenhum cupom criado</h3></div>` :
        coupons.map(c => `
          <div class="coupon-card">
            <div>
              <div class="coupon-code">${c.code}</div>
              <div class="coupon-info">${c.description || ''} • ${c.uses}/${c.maxUses} usos</div>
            </div>
            <div class="coupon-discount">${c.discount}%</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              <span class="chip" style="${c.active ? 'color:var(--success);border-color:rgba(68,255,136,0.3)' : 'color:var(--danger);border-color:rgba(255,68,68,0.3)'}">${c.active ? 'Ativo' : 'Inativo'}</span>
              <button class="btn btn-outline btn-sm" onclick="toggleCoupon('${c.id}')">${c.active ? 'Desativar' : 'Ativar'}</button>
              <button class="btn btn-sm" style="background:none;border:1px solid var(--danger);color:var(--danger)" onclick="deleteCoupon('${c.id}')">Excluir</button>
            </div>
          </div>
        `).join('')
      }
    </div>
  `;
}

function createCoupon() {
  const code = document.getElementById('coupon-code')?.value?.trim().toUpperCase();
  const discount = parseInt(document.getElementById('coupon-discount')?.value);
  const maxUses = parseInt(document.getElementById('coupon-uses')?.value);
  const description = document.getElementById('coupon-desc')?.value?.trim();
  if (!code || !discount || !maxUses) { toast('Preencha todos os campos', 'error'); return; }
  if (discount < 1 || discount > 100) { toast('Desconto deve ser entre 1% e 100%', 'error'); return; }
  const coupons = DB.getCoupons();
  if (coupons.find(c => c.code === code && c.sellerId === state.user.id)) { toast('Código já existe', 'error'); return; }
  coupons.push({ id: uid(), sellerId: state.user.id, code, discount, maxUses, uses: 0, description, active: true, createdAt: new Date().toISOString() });
  DB.setCoupons(coupons);
  toast(`Cupom ${code} criado!`, 'success');
  render();
}

function toggleCoupon(id) {
  const coupons = DB.getCoupons();
  const idx = coupons.findIndex(c => c.id === id);
  if (idx >= 0) { coupons[idx].active = !coupons[idx].active; DB.setCoupons(coupons); render(); }
}

function deleteCoupon(id) {
  if (!confirm('Excluir este cupom?')) return;
  DB.setCoupons(DB.getCoupons().filter(c => c.id !== id));
  toast('Cupom excluído', 'info');
  render();
}

// ─── ADMIN: USER MANAGEMENT ───────────────────────────────────
function renderAdminUsers() {
  if (!state.user?.isAdmin) { toast('Acesso restrito', 'error'); navigate('home'); return ''; }
  const users = DB.getUsers().filter(u => !u.isAdmin);

  return `
    <div class="page-container" style="padding-top:24px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;margin-bottom:6px">USUÁRIOS</h2>
      <p style="color:var(--text3);margin-bottom:20px">Promova usuários a vendedores</p>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);overflow:hidden">
        ${users.length === 0 ? `<div class="empty-state"><div class="icon">👥</div><h3>Nenhum usuário</h3></div>` :
          users.map(u => `
            <div class="user-row">
              <img class="user-row-avatar" src="${u.avatar}" alt="${u.username}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${u.username}'">
              <div class="user-row-name">
                <div style="font-weight:600">${u.username}</div>
                <div style="font-size:11px;color:var(--text3)">${u.email || ''}</div>
              </div>
              <span class="role-badge ${u.isSeller ? 'seller' : ''}">${u.isSeller ? 'Vendedor' : 'Comprador'}</span>
              ${u.isSeller ?
                `<button class="btn btn-outline btn-sm" style="border-color:var(--danger);color:var(--danger)" onclick="demoteSeller('${u.id}')">Remover</button>` :
                `<button class="btn btn-outline btn-sm" style="border-color:var(--success);color:var(--success)" onclick="promoteSeller('${u.id}')">Promover</button>`
              }
            </div>
          `).join('')
        }
      </div>
    </div>
  `;
}

function promoteSeller(userId) {
  const users = DB.getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) return;
  users[idx].isSeller = true;
  DB.setUsers(users);
  // If this is the currently logged-in user, update their session too
  if (state.user && state.user.id === userId) {
    state.user = { ...state.user, isSeller: true };
    DB.setCurrent(state.user);
  }
  const notifs = DB.getNotifs();
  notifs.push({ id: uid(), userId, type: 'promotion', message: '🎉 Parabéns! Você foi promovido a vendedor no REDZIN MARKET!', read: false, createdAt: new Date().toISOString() });
  DB.setNotifs(notifs);
  toast(`${users[idx].username} agora é vendedor!`, 'success');
  render();
}

function demoteSeller(userId) {
  if (!confirm('Remover status de vendedor?')) return;
  const users = DB.getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) return;
  users[idx].isSeller = false;
  DB.setUsers(users);
  // If this is the currently logged-in user, update their session too
  if (state.user && state.user.id === userId) {
    state.user = { ...state.user, isSeller: false };
    DB.setCurrent(state.user);
  }
  toast('Status removido', 'info');
  render();
}

// ─── BOOT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
