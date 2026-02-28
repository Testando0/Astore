// ============================================================
// REDZIN MARKET — Full E-Commerce App
// ============================================================

// ─── DATABASE (localStorage) ─────────────────────────────────
const DB = {
  get: (k, def = []) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
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
};

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
  // Seed admin user Redzin
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
    });
    DB.setUsers(users);
  }

  // Seed sample products
  if (DB.getProducts().length === 0) {
    seedProducts();
  }

  state.user = DB.getCurrent();
  hashRoute();
  window.addEventListener('hashchange', hashRoute);
  renderNav();
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

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function timeAgo(iso) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
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
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function navigate(route, params = {}) {
  state.route = route;
  state.params = params;
  const hash = params.id ? `#${route}/${params.id}` : `#${route}`;
  history.pushState(null, '', hash);
  render();
  window.scrollTo(0, 0);
}

function hashRoute() {
  const hash = location.hash.replace('#', '') || 'home';
  const parts = hash.split('/');
  state.route = parts[0];
  state.params = parts[1] ? { id: parts[1] } : {};
  render();
}

function searchProducts() {
  const q = document.getElementById('search-input')?.value || '';
  state.searchQuery = q.trim();
  state.route = 'home';
  render();
}

// ─── NAV RENDER ──────────────────────────────────────────────
function renderNav() {
  const u = state.user;
  const notifs = u ? DB.getNotifs().filter(n => n.userId === u.id && !n.read).length : 0;
  const cartCount = u ? DB.getCart().filter(c => c.userId === u.id).length : 0;
  const el = document.getElementById('nav-actions');

  if (!u) {
    el.innerHTML = `
      <button class="nav-btn" onclick="showLogin()">Entrar</button>
      <button class="nav-btn primary" onclick="showRegister()">Cadastrar</button>
    `;
  } else {
    el.innerHTML = `
      ${u.isSeller ? `<button class="nav-btn" onclick="navigate('seller-dashboard')">Vender</button>` : ''}
      <button class="nav-icon-btn" onclick="navigate('favorites')" title="Favoritos">❤
        ${DB.getFavs().filter(f => f.userId === u.id).length > 0 ? `<span class="badge">${DB.getFavs().filter(f => f.userId === u.id).length}</span>` : ''}
      </button>
      <button class="nav-icon-btn" onclick="navigate('cart')" title="Carrinho">🛒
        ${cartCount > 0 ? `<span class="badge">${cartCount}</span>` : ''}
      </button>
      <button class="nav-icon-btn" onclick="navigate('notifications')" title="Notificações">🔔
        ${notifs > 0 ? `<span class="badge">${notifs}</span>` : ''}
      </button>
      <img class="avatar-nav" src="${u.avatar}" alt="${u.username}" onclick="navigate('profile')">
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
    notifications: renderNotifications,
    'admin-users': renderAdminUsers,
    orders: renderOrders,
  };

  const fn = routes[state.route];
  if (fn) {
    main.innerHTML = fn();
  } else {
    main.innerHTML = renderHome();
  }
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
    <div style="padding:20px 24px;border-bottom:1px solid var(--border);background:var(--bg2);">
      <p style="color:var(--text2);font-size:14px;">Resultados para: <strong style="color:var(--text)">"${state.searchQuery}"</strong> — ${prods.length} produto(s)</p>
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
  // Find best discount for this product
  const applicable = coupons.filter(c => c.sellerId === p.sellerId && c.active);
  const bestDiscount = applicable.length > 0 ? Math.max(...applicable.map(c => c.discount)) : 0;
  const discountedPrice = bestDiscount > 0 ? p.price * (1 - bestDiscount / 100) : p.price;
  const showDiscount = bestDiscount > 0;
  const seller = DB.getUsers().find(u => u.id === p.sellerId);

  return `
    <div class="product-card" onclick="navigate('product', {id:'${p.id}'})">
      ${showDiscount ? `<span class="discount-badge">-${bestDiscount}%</span>` : ''}
      <button class="product-card-fav ${isFav ? 'active' : ''}" onclick="event.stopPropagation();toggleFav('${p.id}')">${isFav ? '❤' : '♡'}</button>
      <img class="product-card-img" src="${p.images[0]}" alt="${p.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x300/111111/444444?text=IMG'">
      <div class="product-card-info">
        <div class="product-card-title">${p.title}</div>
        <div class="product-card-price">
          ${fmt(discountedPrice)}
          ${showDiscount ? `<span class="original">${fmt(p.price)}</span>` : ''}
          ${p.originalPrice && !showDiscount ? `<span class="original">${fmt(p.originalPrice)}</span>` : ''}
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
  const finalPrice = bestDiscount > 0 ? p.price * (1 - bestDiscount / 100) : (p.originalPrice ? p.originalPrice : p.price);
  const displayPrice = p.originalPrice && !bestDiscount ? p.price : (bestDiscount > 0 ? p.price * (1 - bestDiscount / 100) : p.price);

  const thumbs = p.images.length > 1 ? p.images.map((img, i) => `
    <img class="product-thumb ${i === 0 ? 'active' : ''}" src="${img}" alt="" onclick="switchImg(this, '${img}')" onerror="this.src='https://via.placeholder.com/64x64/111111/444444?text=IMG'">
  `).join('') : '';

  return `
    <div class="page-container" style="padding-top:32px">
      <button class="btn btn-outline btn-sm" style="margin-bottom:24px" onclick="history.back()">← Voltar</button>
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
          ${bestDiscount > 0 ? `<div style="margin-bottom:12px"><span class="chip" style="color:var(--success);border-color:rgba(68,255,136,0.3)">🏷 Desconto ${bestDiscount}% aplicado</span></div>` : ''}

          <div style="margin-bottom:16px;font-size:14px;color:var(--text2);line-height:1.6">${p.description}</div>

          <div class="quantity-control">
            <button class="qty-btn" onclick="changeQty(-1)">−</button>
            <input class="qty-input" id="qty-input" type="number" value="1" min="1" max="${p.stock}">
            <button class="qty-btn" onclick="changeQty(1)">+</button>
            <span style="font-size:13px;color:var(--text3)">Disponível: ${p.stock}</span>
          </div>

          <div class="coupon-input-row">
            <input class="form-control" id="coupon-input" placeholder="Código do cupom..." style="font-family:'Space Mono',monospace;font-size:13px">
            <button class="btn btn-outline" onclick="applyCoupon('${p.id}','${p.sellerId}')">Aplicar</button>
          </div>
          <div id="coupon-result"></div>

          <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
            <button class="btn btn-primary" style="flex:1" onclick="addToCart('${p.id}')" ${p.stock === 0 ? 'disabled' : ''}>
              🛒 Adicionar ao Carrinho
            </button>
            <button class="btn btn-outline" onclick="toggleFav('${p.id}')">${isFav ? '❤ Favorito' : '♡ Favoritar'}</button>
          </div>
          <button class="btn btn-outline btn-full" onclick="buyNow('${p.id}')" ${p.stock === 0 ? 'disabled' : ''}>
            ⚡ Comprar Agora
          </button>

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
  if (!coupon) {
    result.innerHTML = `<div class="payment-status failed" style="font-size:12px">Cupom inválido ou expirado</div>`;
    return;
  }
  if (coupon.uses >= coupon.maxUses) {
    result.innerHTML = `<div class="payment-status failed" style="font-size:12px">Cupom esgotado</div>`;
    return;
  }
  result.innerHTML = `<div class="payment-status confirmed" style="font-size:12px">✓ Cupom válido: ${coupon.discount}% de desconto aplicado!</div>`;
  toast(`Cupom ${code} aplicado! ${coupon.discount}% off`, 'success');
  // Store applied coupon
  sessionStorage.setItem('applied_coupon', JSON.stringify({ code, discount: coupon.discount, sellerId, couponId: coupon.id }));
}

// ─── AUTH ─────────────────────────────────────────────────────
function showLogin() {
  modal(`
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">×</button>
      <h2>ENTRAR</h2>
      <div class="form-group">
        <label>Usuário</label>
        <input class="form-control" id="login-user" placeholder="Seu usuário">
      </div>
      <div class="form-group">
        <label>Senha</label>
        <input class="form-control" id="login-pass" type="password" placeholder="Sua senha">
      </div>
      <button class="btn btn-primary btn-full" onclick="doLogin()">Entrar</button>
      <div style="text-align:center;margin-top:16px">
        <span class="text-link" onclick="closeModal();showRegister()">Não tem conta? Cadastre-se</span>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('login-user')?.focus(), 100);
}

function showRegister() {
  modal(`
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">×</button>
      <h2>CADASTRAR</h2>
      <div class="form-group">
        <label>Usuário *</label>
        <input class="form-control" id="reg-user" placeholder="Escolha um usuário">
      </div>
      <div class="form-group">
        <label>E-mail *</label>
        <input class="form-control" id="reg-email" type="email" placeholder="seu@email.com">
      </div>
      <div class="form-group">
        <label>Telefone</label>
        <input class="form-control" id="reg-phone" placeholder="(11) 99999-9999">
      </div>
      <div class="form-group">
        <label>Senha *</label>
        <input class="form-control" id="reg-pass" type="password" placeholder="Mínimo 6 caracteres">
      </div>
      <button class="btn btn-primary btn-full" onclick="doRegister()">Criar conta</button>
      <div style="text-align:center;margin-top:16px">
        <span class="text-link" onclick="closeModal();showLogin()">Já tem conta? Entrar</span>
      </div>
    </div>
  `);
}

function doLogin() {
  const user = document.getElementById('login-user')?.value?.trim();
  const pass = document.getElementById('login-pass')?.value;
  if (!user || !pass) { toast('Preencha todos os campos', 'error'); return; }
  const users = DB.getUsers();
  const u = users.find(u => u.username === user && u.password === pass);
  if (!u) { toast('Usuário ou senha incorretos', 'error'); return; }
  state.user = u;
  DB.setCurrent(u);
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
    id: uid(),
    username,
    email,
    phone,
    password,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundColor=111111&textColor=ffffff`,
    isSeller: false,
    isAdmin: false,
    createdAt: new Date().toISOString(),
    bio: '',
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
              <div class="profile-stat"><strong>${cart.length}</strong>no carrinho</div>
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
        <div style="max-width:480px;margin-top:24px">
          <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:16px">EDITAR PERFIL</h3>
          <div class="form-group"><label>Bio</label><textarea class="form-control" id="edit-bio" placeholder="Fale sobre você...">${u.bio || ''}</textarea></div>
          <div class="form-group"><label>E-mail</label><input class="form-control" id="edit-email" value="${u.email || ''}"></div>
          <div class="form-group"><label>Telefone</label><input class="form-control" id="edit-phone" value="${u.phone || ''}"></div>
          <button class="btn btn-primary" onclick="saveProfile()">Salvar alterações</button>
          ${!u.isSeller && !u.isAdmin ? `
            <div class="divider"></div>
            <p style="font-size:13px;color:var(--text3)">Para se tornar vendedor, solicite ao administrador.</p>
          ` : ''}
        </div>
      </div>
      <div id="tab-orders" style="display:none">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin:24px 0 16px">MEUS PEDIDOS</h3>
        ${orders.length === 0 ? `<div class="empty-state"><div class="icon">📦</div><h3>Nenhum pedido ainda</h3><p>Faça sua primeira compra!</p></div>` :
          orders.reverse().map(o => renderOrderCard(o)).join('')}
      </div>
      <div id="tab-cart" style="display:none">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin:24px 0 16px">MEU CARRINHO</h3>
        ${renderCartContent()}
      </div>
      <div id="tab-favs" style="display:none">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin:24px 0 16px">FAVORITOS</h3>
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
    pending_payment: { label: 'Aguardando Pagamento', color: 'var(--warning)' },
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
        <div style="font-size:12px;color:var(--text3)">${timeAgo(o.createdAt)} • Qtd: ${o.quantity}</div>
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

// ─── SELLER PROFILE (public) ──────────────────────────────────
function renderSellerProfile() {
  const seller = DB.getUsers().find(u => u.id === state.params.id);
  if (!seller) return `<div class="page-container"><div class="empty-state"><div class="icon">😕</div><h3>Vendedor não encontrado</h3></div></div>`;
  const products = DB.getProducts().filter(p => p.sellerId === seller.id);
  const favs = state.user ? DB.getFavs().filter(f => f.userId === state.user.id).map(f => f.productId) : [];
  const coupons = DB.getCoupons();

  return `
    <div class="profile-header">
      <div class="profile-header-inner">
        <div class="profile-top">
          <div class="profile-avatar-wrap">
            <img class="profile-avatar" src="${seller.avatar}" alt="${seller.username}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${seller.username}'">
          </div>
          <div class="profile-info">
            <h2>${seller.username}</h2>
            ${seller.isAdmin ? '<div class="seller-badge">⭐ Vendedor Oficial</div>' : seller.isSeller ? '<div class="seller-badge">✓ Vendedor</div>' : ''}
            <div style="font-size:13px;color:var(--text2);margin-top:8px">${seller.bio || ''}</div>
            <div class="profile-stats">
              <div class="profile-stat"><strong>${products.length}</strong>produtos</div>
              <div class="profile-stat"><strong>${products.reduce((a,p) => a + (p.sold||0), 0)}</strong>vendidos</div>
            </div>
          </div>
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

  const itemsHtml = cartItems.length === 0 ? `<div class="empty-state"><div class="icon">🛒</div><h3>Carrinho vazio</h3><p>Adicione produtos para continuar</p></div>` :
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
            <div style="font-size:12px;color:var(--text3)">Unitário: ${fmt(p.price)}</div>
            <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
              <button class="qty-btn" onclick="updateCartQty('${item.productId}',-1)" style="width:28px;height:28px;font-size:14px">−</button>
              <span style="font-family:'Space Mono',monospace;font-size:14px">${item.quantity}</span>
              <button class="qty-btn" onclick="updateCartQty('${item.productId}',1)" style="width:28px;height:28px;font-size:14px">+</button>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="cart-item-price">${fmt(subtotal)}</div>
            <button class="btn btn-outline btn-sm" style="margin-top:8px;border-color:var(--danger);color:var(--danger)" onclick="removeFromCart('${item.productId}')">Remover</button>
          </div>
        </div>
      `;
    }).join('');

  return `
    <div class="page-container" style="padding-top:32px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:24px">MEU CARRINHO</h2>
      <div class="two-col">
        <div>${itemsHtml}</div>
        ${cartItems.length > 0 ? `
        <div class="cart-summary">
          <h3>RESUMO</h3>
          <div class="summary-row"><span>Subtotal</span><span>${fmt(total)}</span></div>
          <div class="summary-row"><span>Frete</span><span>A calcular</span></div>
          <div class="summary-row total"><span>Total</span><span>${fmt(total)}</span></div>
          <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="checkoutCart()">Finalizar compra →</button>
        </div>` : ''}
      </div>
    </div>
  `;
}

function renderCartContent() {
  const cartItems = DB.getCart().filter(c => c.userId === state.user.id);
  const products = DB.getProducts();
  if (cartItems.length === 0) return `<div class="empty-state" style="padding:40px"><div class="icon">🛒</div><h3>Carrinho vazio</h3></div>`;
  return cartItems.map(item => {
    const p = products.find(pr => pr.id === item.productId);
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
  const favs = DB.getFavs().filter(f => f.userId === state.user.id);
  const products = DB.getProducts();
  if (favs.length === 0) return `<div class="empty-state" style="padding:40px"><div class="icon">❤</div><h3>Nenhum favorito</h3></div>`;
  const favProds = favs.map(f => products.find(p => p.id === f.productId)).filter(Boolean);
  const coupons = DB.getCoupons();
  return `<div class="product-grid">${favProds.map(p => renderProductCard(p, favs.map(f => f.productId), coupons)).join('')}</div>`;
}

// ─── FAVORITES PAGE ──────────────────────────────────────────
function renderFavorites() {
  if (!state.user) { showLogin(); return ''; }
  const favs = DB.getFavs().filter(f => f.userId === state.user.id);
  const products = DB.getProducts();
  const coupons = DB.getCoupons();
  const favProds = favs.map(f => products.find(p => p.id === f.productId)).filter(Boolean);

  return `
    <div class="page-container" style="padding-top:32px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:24px">❤ FAVORITOS</h2>
      ${favProds.length === 0 ? `<div class="empty-state"><div class="icon">❤</div><h3>Nenhum favorito ainda</h3></div>` :
        `<div class="product-grid">${favProds.map(p => renderProductCard(p, favs.map(f => f.productId), coupons)).join('')}</div>`}
    </div>
  `;
}

// ─── CART ACTIONS ─────────────────────────────────────────────
function addToCart(productId) {
  if (!state.user) { showLogin(); return; }
  const cart = DB.getCart();
  const qty = parseInt(document.getElementById('qty-input')?.value) || 1;
  const existing = cart.find(c => c.userId === state.user.id && c.productId === productId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, 99);
  } else {
    cart.push({ userId: state.user.id, productId, quantity: qty });
  }
  DB.setCart(cart);
  toast('Adicionado ao carrinho!', 'success');
  renderNav();
}

function removeFromCart(productId) {
  const cart = DB.getCart().filter(c => !(c.userId === state.user.id && c.productId === productId));
  DB.setCart(cart);
  renderNav();
}

function updateCartQty(productId, delta) {
  const cart = DB.getCart();
  const item = cart.find(c => c.userId === state.user.id && c.productId === productId);
  if (item) {
    item.quantity = Math.max(1, item.quantity + delta);
    if (item.quantity === 0) {
      const idx = cart.indexOf(item);
      cart.splice(idx, 1);
    }
    DB.setCart(cart);
    render();
  }
}

function toggleFav(productId) {
  if (!state.user) { showLogin(); return; }
  const favs = DB.getFavs();
  const idx = favs.findIndex(f => f.userId === state.user.id && f.productId === productId);
  if (idx >= 0) {
    favs.splice(idx, 1);
    toast('Removido dos favoritos', 'info');
  } else {
    favs.push({ userId: state.user.id, productId });
    toast('Adicionado aos favoritos!', 'success');
  }
  DB.setFavs(favs);
  renderNav();
  render();
}

function checkoutCart() {
  const cartItems = DB.getCart().filter(c => c.userId === state.user.id);
  if (cartItems.length === 0) return;
  // Use first product for now (multi-product checkout)
  sessionStorage.setItem('checkout_cart', JSON.stringify(cartItems));
  navigate('checkout', { id: 'cart' });
}

function buyNow(productId) {
  if (!state.user) { showLogin(); return; }
  const qty = parseInt(document.getElementById('qty-input')?.value) || 1;
  sessionStorage.setItem('buy_now', JSON.stringify({ productId, quantity: qty }));
  navigate('checkout', { id: productId });
}

// ─── CHECKOUT ─────────────────────────────────────────────────
function renderCheckout() {
  if (!state.user) { showLogin(); return ''; }
  const isCart = state.params.id === 'cart';
  const cartItems = isCart ? JSON.parse(sessionStorage.getItem('checkout_cart') || '[]') : null;
  const buyNow = !isCart ? JSON.parse(sessionStorage.getItem('buy_now') || 'null') : null;

  let items = [];
  let total = 0;
  const products = DB.getProducts();
  const coupon = JSON.parse(sessionStorage.getItem('applied_coupon') || 'null');

  if (isCart && cartItems) {
    items = cartItems.map(c => {
      const p = products.find(pr => pr.id === c.productId);
      if (!p) return null;
      const sub = p.price * c.quantity;
      total += sub;
      return { product: p, quantity: c.quantity, subtotal: sub };
    }).filter(Boolean);
  } else if (buyNow) {
    const p = products.find(pr => pr.id === buyNow.productId);
    if (p) {
      const sub = p.price * buyNow.quantity;
      total += sub;
      items = [{ product: p, quantity: buyNow.quantity, subtotal: sub }];
    }
  }

  let discountedTotal = total;
  if (coupon) {
    discountedTotal = total * (1 - coupon.discount / 100);
  }

  return `
    <div class="page-container" style="padding-top:32px">
      <button class="btn btn-outline btn-sm" style="margin-bottom:24px" onclick="history.back()">← Voltar</button>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:24px">CHECKOUT</h2>
      <div class="checkout-layout">
        <div>
          <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:20px">DADOS DE ENTREGA</h3>
          <div class="form-group"><label>Nome completo *</label><input class="form-control" id="co-name" value="${state.user.username}" placeholder="Seu nome completo"></div>
          <div class="form-group"><label>E-mail *</label><input class="form-control" id="co-email" type="email" value="${state.user.email || ''}" placeholder="seu@email.com"></div>
          <div class="form-group"><label>Telefone *</label><input class="form-control" id="co-phone" value="${state.user.phone || ''}" placeholder="(11) 99999-9999"></div>
          <div class="divider"></div>
          <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:20px">ENDEREÇO</h3>
          <div class="two-col">
            <div class="form-group"><label>CEP *</label><input class="form-control" id="co-cep" placeholder="00000-000" oninput="fetchCEP(this.value)"></div>
            <div class="form-group"><label>Número *</label><input class="form-control" id="co-num" placeholder="123"></div>
          </div>
          <div class="form-group"><label>Rua *</label><input class="form-control" id="co-street" placeholder="Nome da rua"></div>
          <div class="two-col">
            <div class="form-group"><label>Bairro</label><input class="form-control" id="co-neighborhood" placeholder="Bairro"></div>
            <div class="form-group"><label>Complemento</label><input class="form-control" id="co-complement" placeholder="Apto, sala..."></div>
          </div>
          <div class="two-col">
            <div class="form-group"><label>Cidade *</label><input class="form-control" id="co-city" placeholder="Cidade"></div>
            <div class="form-group"><label>Estado *</label><input class="form-control" id="co-state" placeholder="SP"></div>
          </div>
        </div>
        <div>
          <div class="cart-summary">
            <h3>RESUMO DO PEDIDO</h3>
            ${items.map(i => `
              <div class="summary-row" style="align-items:center;gap:8px">
                <img src="${i.product.images[0]}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0" onerror="this.style.display='none'">
                <span style="flex:1;font-size:13px">${i.product.title} ×${i.quantity}</span>
                <span>${fmt(i.subtotal)}</span>
              </div>
            `).join('')}
            ${coupon ? `<div class="summary-row" style="color:var(--success)"><span>Cupom (${coupon.discount}%)</span><span>-${fmt(total - discountedTotal)}</span></div>` : ''}
            <div class="summary-row total"><span>Total</span><span>${fmt(discountedTotal)}</span></div>
            <button class="btn btn-primary btn-full" style="margin-top:20px" onclick="placeOrder(${discountedTotal}, ${total}, ${JSON.stringify(items.map(i => ({id: i.product.id, qty: i.quantity, price: i.product.price})))})" >
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

function placeOrder(total, originalTotal, itemsData) {
  if (!state.user) return;
  const name = document.getElementById('co-name')?.value?.trim();
  const email = document.getElementById('co-email')?.value?.trim();
  const phone = document.getElementById('co-phone')?.value?.trim();
  const street = document.getElementById('co-street')?.value?.trim();
  const num = document.getElementById('co-num')?.value?.trim();
  const city = document.getElementById('co-city')?.value?.trim();
  const st = document.getElementById('co-state')?.value?.trim();

  if (!name || !email || !phone || !street || !num || !city || !st) {
    toast('Preencha todos os campos obrigatórios', 'error');
    return;
  }

  const address = { name, email, phone, street, num, city, state: st, neighborhood: document.getElementById('co-neighborhood')?.value || '', complement: document.getElementById('co-complement')?.value || '' };
  const coupon = JSON.parse(sessionStorage.getItem('applied_coupon') || 'null');
  const products = DB.getProducts();

  // Create one order per item (per seller)
  const orders = DB.getOrders();
  let firstOrderId = null;

  // Group by seller
  const bySeller = {};
  itemsData.forEach(item => {
    const p = products.find(pr => pr.id === item.id);
    if (!p) return;
    if (!bySeller[p.sellerId]) bySeller[p.sellerId] = [];
    bySeller[p.sellerId].push({ ...item, sellerId: p.sellerId, productId: p.id });
  });

  Object.entries(bySeller).forEach(([sellerId, sellerItems]) => {
    const orderTotal = sellerItems.reduce((a, i) => a + i.price * i.qty, 0) * (coupon && coupon.sellerId === sellerId ? (1 - coupon.discount / 100) : 1);
    const order = {
      id: uid(),
      buyerId: state.user.id,
      sellerId,
      productId: sellerItems[0].productId,
      quantity: sellerItems[0].qty,
      items: sellerItems,
      address,
      total: parseFloat(orderTotal.toFixed(2)),
      coupon: coupon && coupon.sellerId === sellerId ? coupon : null,
      status: 'pending_payment',
      tracking: [{ status: 'Pedido criado', date: new Date().toISOString(), location: 'Sistema' }],
      pixKey: generatePixKey(),
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    if (!firstOrderId) firstOrderId = order.id;

    // Use coupon
    if (coupon && coupon.sellerId === sellerId) {
      const coupons = DB.getCoupons();
      const idx = coupons.findIndex(c => c.id === coupon.couponId);
      if (idx >= 0) { coupons[idx].uses++; DB.setCoupons(coupons); }
    }
  });

  DB.setOrders(orders);
  sessionStorage.removeItem('applied_coupon');
  sessionStorage.removeItem('buy_now');
  sessionStorage.removeItem('checkout_cart');

  // Clear cart
  const cart = DB.getCart().filter(c => c.userId !== state.user.id || !itemsData.find(i => i.id === c.productId));
  DB.setCart(cart);

  navigate('payment', { id: firstOrderId });
}

function generatePixKey() {
  return `redzin.market@pix.${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

// ─── PAYMENT PAGE ──────────────────────────────────────────────
function renderPayment() {
  const order = DB.getOrders().find(o => o.id === state.params.id);
  if (!order) return `<div class="page-container"><div class="empty-state"><div class="icon">😕</div><h3>Pedido não encontrado</h3></div></div>`;
  const product = DB.getProducts().find(p => p.id === order.productId);

  const isPaid = order.status !== 'pending_payment';

  return `
    <div class="page-container" style="padding-top:32px">
      <div class="payment-box">
        ${isPaid ? `
          <div style="font-size:64px;margin-bottom:16px">✅</div>
          <h2>PAGAMENTO<br>CONFIRMADO</h2>
          <p style="color:var(--text2);margin:16px 0">Seu pedido foi confirmado e o vendedor foi notificado.</p>
          <button class="btn btn-primary" onclick="navigate('tracking',{id:'${order.id}'})">Rastrear pedido →</button>
        ` : `
          <h2>PAGUE VIA<br>PIX</h2>
          <p style="color:var(--text2);font-size:14px">Pedido: ${product?.title || 'Produto'} — ${fmt(order.total)}</p>
          <div id="qrcode"></div>
          <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Ou copie a chave PIX:</p>
          <div class="pix-key-box">
            <span id="pix-key-text">${order.pixKey}</span>
            <button class="btn btn-outline btn-sm" onclick="copyPixKey('${order.pixKey}')">Copiar</button>
          </div>
          <div class="payment-status pending" id="payment-status">
            ⏳ Aguardando confirmação do pagamento...
          </div>
          <div class="countdown" id="payment-countdown">10:00</div>
          <div class="progress-bar"><div class="progress-fill" id="payment-progress" style="width:100%"></div></div>
          <p style="font-size:12px;color:var(--text3);margin-bottom:16px">Após pagar, a confirmação é automática</p>
          <button class="btn btn-success btn-full" onclick="simulatePayment('${order.id}')">
            ✓ Já realizei o pagamento
          </button>
          <button class="btn btn-outline btn-full" style="margin-top:8px" onclick="navigate('tracking',{id:'${order.id}'})">
            Rastrear pedido
          </button>
        `}
      </div>
    </div>
  `;
}

function attachEvents() {
  // Generate QR code on payment page
  if (state.route === 'payment') {
    const order = DB.getOrders().find(o => o.id === state.params.id);
    if (order && order.status === 'pending_payment') {
      setTimeout(() => {
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer && typeof QRCode !== 'undefined') {
          const pixPayload = generatePixPayload(order.total, order.pixKey);
          new QRCode(qrContainer, {
            text: pixPayload,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
          });
        }
        startPaymentCountdown(order.id);
      }, 100);
    }
  }
}

function generatePixPayload(amount, key) {
  // EMV-based PIX payload (simplified for simulation)
  const merchantName = 'REDZIN MARKET';
  const amountStr = amount.toFixed(2);
  const keyStr = key;
  return `00020126580014BR.GOV.BCB.PIX0136${keyStr}5204000053039865406${amountStr}5802BR5913${merchantName}6009SAO PAULO62140510REDZINMKT6304ABCD`;
}

function startPaymentCountdown(orderId) {
  let seconds = 600; // 10 minutes
  const interval = setInterval(() => {
    seconds--;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    const cd = document.getElementById('payment-countdown');
    const pb = document.getElementById('payment-progress');
    if (cd) cd.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    if (pb) pb.style.width = `${(seconds / 600) * 100}%`;
    if (seconds <= 0) {
      clearInterval(interval);
      // Expire
    }
    // Check if order status changed
    const order = DB.getOrders().find(o => o.id === orderId);
    if (order && order.status !== 'pending_payment') {
      clearInterval(interval);
    }
  }, 1000);
}

function copyPixKey(key) {
  navigator.clipboard.writeText(key).then(() => toast('Chave PIX copiada!', 'success')).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = key;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    toast('Chave PIX copiada!', 'success');
  });
}

function simulatePayment(orderId) {
  // Show loading
  const btn = event.target;
  btn.textContent = 'Verificando pagamento...';
  btn.disabled = true;

  // Simulate payment verification (2 seconds)
  setTimeout(() => {
    confirmPayment(orderId);
  }, 2000);
}

function confirmPayment(orderId) {
  const orders = DB.getOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx < 0) return;

  orders[idx].status = 'paid';
  orders[idx].paidAt = new Date().toISOString();
  orders[idx].tracking.push({ status: 'Pagamento confirmado', date: new Date().toISOString(), location: 'Sistema financeiro' });

  DB.setOrders(orders);

  // Notify seller
  const order = orders[idx];
  const notifs = DB.getNotifs();
  const product = DB.getProducts().find(p => p.id === order.productId);
  notifs.push({
    id: uid(),
    userId: order.sellerId,
    type: 'sale',
    message: `🛍 Novo pedido! ${product?.title || 'Produto'} — ${fmt(order.total)} — de ${state.user?.username || 'comprador'}`,
    orderId: order.id,
    read: false,
    createdAt: new Date().toISOString(),
  });
  DB.setNotifs(notifs);

  // Update product sold count
  const products = DB.getProducts();
  const pi = products.findIndex(p => p.id === order.productId);
  if (pi >= 0) { products[pi].sold = (products[pi].sold || 0) + order.quantity; DB.setProducts(products); }

  // Update payment status UI
  const statusEl = document.getElementById('payment-status');
  if (statusEl) {
    statusEl.className = 'payment-status confirmed';
    statusEl.textContent = '✓ Pagamento confirmado! Notificação enviada ao vendedor.';
  }

  setTimeout(() => {
    render();
  }, 1500);
}

// ─── TRACKING ────────────────────────────────────────────────
function renderTracking() {
  const order = DB.getOrders().find(o => o.id === state.params.id);
  if (!order) return `<div class="page-container"><div class="empty-state"><div class="icon">😕</div><h3>Pedido não encontrado</h3></div></div>`;

  const product = DB.getProducts().find(p => p.id === order.productId);
  const isSeller = state.user && state.user.id === order.sellerId;

  const statusLabels = {
    pending_payment: { label: '⏳ Aguardando Pagamento', color: 'var(--warning)' },
    paid: { label: '✓ Pago', color: 'var(--success)' },
    processing: { label: '⚙ Processando', color: 'var(--text2)' },
    shipped: { label: '🚚 Enviado', color: '#4488ff' },
    delivered: { label: '✅ Entregue', color: 'var(--success)' },
  };
  const st = statusLabels[order.status] || { label: order.status, color: 'var(--text2)' };

  const trackingSteps = (order.tracking || []).map((t, i) => `
    <div class="tracking-step done">
      <div class="tracking-step-dot"></div>
      <div class="tracking-step-title">${t.status}</div>
      <div class="tracking-step-date">${t.location} • ${new Date(t.date).toLocaleString('pt-BR')}</div>
    </div>
  `).join('');

  const sellerPanel = isSeller ? `
    <div class="divider"></div>
    <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:16px">ATUALIZAR RASTREAMENTO</h3>
    <div class="form-group"><label>Status do pedido</label>
      <select class="form-control" id="track-status">
        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>⚙ Processando</option>
        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>🚚 Enviado</option>
        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>✅ Entregue</option>
      </select>
    </div>
    <div class="form-group"><label>Localização atual</label><input class="form-control" id="track-location" placeholder="Ex: Centro de Triagem SP"></div>
    <div class="form-group"><label>Descrição</label><input class="form-control" id="track-desc" placeholder="Ex: Produto saiu para entrega"></div>
    <button class="btn btn-primary" onclick="updateTracking('${order.id}')">Atualizar rastreamento</button>
  ` : '';

  return `
    <div class="page-container" style="padding-top:32px;max-width:700px;margin:0 auto">
      <button class="btn btn-outline btn-sm" style="margin-bottom:24px" onclick="history.back()">← Voltar</button>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
        <img src="${product?.images[0]}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid var(--border)" onerror="this.style.display='none'">
        <div>
          <h2 style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:2px">${product?.title || 'Produto'}</h2>
          <div style="color:${st.color};font-size:14px;font-weight:600;margin-top:4px">${st.label}</div>
        </div>
        <div style="margin-left:auto;font-family:'Space Mono',monospace;font-size:20px;font-weight:700">${fmt(order.total)}</div>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:24px;margin-bottom:24px">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:20px">ENDEREÇO DE ENTREGA</h3>
        <p style="font-size:14px;color:var(--text2)">${order.address.name} • ${order.address.phone}</p>
        <p style="font-size:14px;color:var(--text2)">${order.address.street}, ${order.address.num} ${order.address.complement ? '— ' + order.address.complement : ''}</p>
        <p style="font-size:14px;color:var(--text2)">${order.address.neighborhood ? order.address.neighborhood + ', ' : ''}${order.address.city} — ${order.address.state}</p>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:24px">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;margin-bottom:20px">RASTREAMENTO</h3>
        <div class="tracking-steps">${trackingSteps || '<p style="color:var(--text3)">Sem atualizações ainda</p>'}</div>
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

  // Notify buyer
  const order = orders[idx];
  const notifs = DB.getNotifs();
  const product = DB.getProducts().find(p => p.id === order.productId);
  notifs.push({
    id: uid(),
    userId: order.buyerId,
    type: 'tracking',
    message: `📦 Atualização do pedido "${product?.title}": ${desc} — ${location}`,
    orderId: order.id,
    read: false,
    createdAt: new Date().toISOString(),
  });
  DB.setNotifs(notifs);

  toast('Rastreamento atualizado!', 'success');
  render();
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function renderNotifications() {
  if (!state.user) { showLogin(); return ''; }
  const notifs = DB.getNotifs().filter(n => n.userId === state.user.id).reverse();

  // Mark all as read
  const allNotifs = DB.getNotifs();
  allNotifs.forEach(n => { if (n.userId === state.user.id) n.read = true; });
  DB.setNotifs(allNotifs);

  return `
    <div class="page-container" style="padding-top:32px;max-width:700px;margin:0 auto">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:24px">🔔 NOTIFICAÇÕES</h2>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);overflow:hidden">
        ${notifs.length === 0 ? `<div class="empty-state"><div class="icon">🔔</div><h3>Nenhuma notificação</h3></div>` :
          notifs.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}" onclick="${n.orderId ? `navigate('tracking',{id:'${n.orderId}'})` : ''}">
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
    <div class="page-container" style="padding-top:32px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:24px">📦 MEUS PEDIDOS</h2>
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
  const totalRevenue = orders.filter(o => o.status !== 'pending_payment' && o.status !== 'cancelled').reduce((a, o) => a + o.total, 0);
  const notifs = DB.getNotifs().filter(n => n.userId === state.user.id && !n.read).length;

  return `
    <div class="page-container" style="padding-top:32px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:8px">PAINEL DO VENDEDOR</h2>
      <p style="color:var(--text3);margin-bottom:32px">Olá, ${state.user.username}!</p>

      <div class="dash-grid">
        <div class="dash-card">
          <div class="num">${products.length}</div>
          <div class="label">Produtos ativos</div>
        </div>
        <div class="dash-card">
          <div class="num">${orders.length}</div>
          <div class="label">Total de pedidos</div>
        </div>
        <div class="dash-card">
          <div class="num">${fmt(totalRevenue)}</div>
          <div class="label">Receita total</div>
        </div>
        <div class="dash-card">
          <div class="num">${notifs}</div>
          <div class="label">Notificações novas</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:32px">
        <button class="btn btn-primary" onclick="navigate('add-product')">+ Anunciar produto</button>
        <button class="btn btn-outline" onclick="navigate('seller-products')">Meus produtos</button>
        <button class="btn btn-outline" onclick="navigate('seller-coupons')">Cupons</button>
        <button class="btn btn-outline" onclick="navigate('notifications')">🔔 Notificações ${notifs > 0 ? `(${notifs})` : ''}</button>
      </div>

      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:16px">PEDIDOS RECENTES</h3>
      ${orders.length === 0 ? `<div class="empty-state"><div class="icon">📦</div><h3>Nenhum pedido ainda</h3></div>` :
        orders.reverse().slice(0, 5).map(o => {
          const product = DB.getProducts().find(p => p.id === o.productId);
          const buyer = DB.getUsers().find(u => u.id === o.buyerId);
          return `
            <div class="cart-item" style="cursor:pointer" onclick="navigate('tracking',{id:'${o.id}'})">
              <img class="cart-item-img" src="${product?.images[0]}" onerror="this.src='https://via.placeholder.com/80x80/111/444?text=?'">
              <div class="cart-item-info">
                <div class="cart-item-title">${product?.title || 'Produto'}</div>
                <div style="font-size:12px;color:var(--text3)">Cliente: ${buyer?.username || 'Comprador'} • ${timeAgo(o.createdAt)}</div>
                <div class="cart-item-price">${fmt(o.total)}</div>
              </div>
              <div style="font-size:13px;color:var(--text2)">${o.status}</div>
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
    <div class="page-container" style="padding-top:32px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px">MEUS PRODUTOS</h2>
        <button class="btn btn-primary" onclick="navigate('add-product')">+ Novo produto</button>
      </div>
      ${products.length === 0 ? `<div class="empty-state"><div class="icon">📦</div><h3>Nenhum produto ainda</h3><button class="btn btn-primary" onclick="navigate('add-product')" style="margin-top:16px">Anunciar produto</button></div>` :
        `<div style="display:grid;gap:12px">
          ${products.map(p => `
            <div style="display:flex;gap:16px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);align-items:center">
              <img src="${p.images[0]}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border)" onerror="this.src='https://via.placeholder.com/64x64/111/444?text=?'">
              <div style="flex:1">
                <div style="font-size:14px;font-weight:600">${p.title}</div>
                <div style="font-size:13px;color:var(--text3)">${fmt(p.price)} • ${p.stock} em estoque • ${p.sold||0} vendidos</div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-outline btn-sm" onclick="navigate('edit-product',{id:'${p.id}'})">Editar</button>
                <button class="btn btn-sm" style="background:none;border:1px solid var(--danger);color:var(--danger)" onclick="deleteProduct('${p.id}')">Excluir</button>
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

// ─── ADD PRODUCT ──────────────────────────────────────────────
function renderAddProduct() {
  if (!state.user?.isSeller) { navigate('home'); return ''; }
  return `
    <div class="page-container" style="padding-top:32px;max-width:680px;margin:0 auto">
      <button class="btn btn-outline btn-sm" style="margin-bottom:24px" onclick="history.back()">← Voltar</button>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:24px">ANUNCIAR PRODUTO</h2>
      <div class="form-group"><label>Título *</label><input class="form-control" id="prod-title" placeholder="Nome do produto"></div>
      <div class="form-group"><label>Descrição *</label><textarea class="form-control" id="prod-desc" placeholder="Descreva o produto..." style="min-height:120px"></textarea></div>
      <div class="two-col">
        <div class="form-group"><label>Preço (R$) *</label><input class="form-control" id="prod-price" type="number" step="0.01" placeholder="0,00"></div>
        <div class="form-group"><label>Preço original (opcional)</label><input class="form-control" id="prod-orig" type="number" step="0.01" placeholder="0,00"></div>
      </div>
      <div class="two-col">
        <div class="form-group"><label>Estoque *</label><input class="form-control" id="prod-stock" type="number" placeholder="0"></div>
        <div class="form-group"><label>Categoria *</label>
          <select class="form-control" id="prod-cat">
            <option value="moda">Moda</option>
            <option value="eletronicos">Eletrônicos</option>
            <option value="acessorios">Acessórios</option>
            <option value="bolsas">Bolsas</option>
            <option value="beleza">Beleza</option>
            <option value="casa">Casa</option>
            <option value="esporte">Esporte</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Imagens (URLs, uma por linha)</label>
        <textarea class="form-control" id="prod-images" placeholder="https://exemplo.com/imagem.jpg&#10;https://exemplo.com/imagem2.jpg" style="min-height:80px"></textarea>
      </div>
      <div class="form-group">
        <label>Ou faça upload de imagens</label>
        <label class="btn btn-outline" for="prod-img-upload" style="cursor:pointer;display:inline-flex">📎 Selecionar imagens</label>
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
      img.className = 'img-preview';
      img.src = e.target.result;
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
    const product = {
      id: uid(),
      sellerId: state.user.id,
      title,
      description: desc,
      price,
      originalPrice: origPrice,
      stock,
      category,
      images: allImages.length > 0 ? allImages : [`https://via.placeholder.com/400x400/111111/444444?text=${encodeURIComponent(title)}`],
      sold: 0,
      createdAt: new Date().toISOString(),
    };
    products.push(product);
    DB.setProducts(products);
    toast('Produto publicado!', 'success');
  }
  uploadedImages = [];
  navigate('seller-products');
}

// ─── EDIT PRODUCT ─────────────────────────────────────────────
function renderEditProduct() {
  if (!state.user?.isSeller) { navigate('home'); return ''; }
  const p = DB.getProducts().find(p => p.id === state.params.id);
  if (!p) return `<div class="page-container"><div class="empty-state"><h3>Produto não encontrado</h3></div></div>`;

  return `
    <div class="page-container" style="padding-top:32px;max-width:680px;margin:0 auto">
      <button class="btn btn-outline btn-sm" style="margin-bottom:24px" onclick="history.back()">← Voltar</button>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:24px">EDITAR PRODUTO</h2>
      <div class="form-group"><label>Título *</label><input class="form-control" id="prod-title" value="${p.title}"></div>
      <div class="form-group"><label>Descrição *</label><textarea class="form-control" id="prod-desc" style="min-height:120px">${p.description}</textarea></div>
      <div class="two-col">
        <div class="form-group"><label>Preço (R$) *</label><input class="form-control" id="prod-price" type="number" step="0.01" value="${p.price}"></div>
        <div class="form-group"><label>Preço original</label><input class="form-control" id="prod-orig" type="number" step="0.01" value="${p.originalPrice || ''}"></div>
      </div>
      <div class="two-col">
        <div class="form-group"><label>Estoque *</label><input class="form-control" id="prod-stock" type="number" value="${p.stock}"></div>
        <div class="form-group"><label>Categoria *</label>
          <select class="form-control" id="prod-cat">
            ${['moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'].map(c => `<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Imagens (URLs, uma por linha)</label>
        <textarea class="form-control" id="prod-images" style="min-height:80px">${p.images.filter(i => i.startsWith('http')).join('\n')}</textarea>
      </div>
      <div class="form-group">
        <label>Upload de imagens</label>
        <label class="btn btn-outline" for="prod-img-upload" style="cursor:pointer;display:inline-flex">📎 Selecionar imagens</label>
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
    <div class="page-container" style="padding-top:32px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:24px">CUPONS DE DESCONTO</h2>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:24px;margin-bottom:32px;max-width:480px">
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:20px">CRIAR CUPOM</h3>
        <div class="form-group"><label>Código do cupom *</label><input class="form-control" id="coupon-code" placeholder="EX: DESCONTO10" style="text-transform:uppercase"></div>
        <div class="two-col">
          <div class="form-group"><label>Desconto (%) *</label><input class="form-control" id="coupon-discount" type="number" min="1" max="100" placeholder="10"></div>
          <div class="form-group"><label>Usos máximos *</label><input class="form-control" id="coupon-uses" type="number" min="1" placeholder="100"></div>
        </div>
        <div class="form-group"><label>Descrição</label><input class="form-control" id="coupon-desc" placeholder="Ex: 10% na primeira compra"></div>
        <button class="btn btn-primary btn-full" onclick="createCoupon()">Criar cupom</button>
      </div>

      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:16px">MEUS CUPONS</h3>
      ${coupons.length === 0 ? `<div class="empty-state"><div class="icon">🏷</div><h3>Nenhum cupom criado</h3></div>` :
        coupons.map(c => `
          <div class="coupon-card">
            <div>
              <div class="coupon-code">${c.code}</div>
              <div class="coupon-info">${c.description || ''} • ${c.uses}/${c.maxUses} usos</div>
            </div>
            <div class="coupon-discount">${c.discount}%</div>
            <div style="display:flex;flex-direction:column;gap:6px">
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
  if (coupons.find(c => c.code === code && c.sellerId === state.user.id)) {
    toast('Código já existe', 'error'); return;
  }

  coupons.push({
    id: uid(),
    sellerId: state.user.id,
    code,
    discount,
    maxUses,
    uses: 0,
    description,
    active: true,
    createdAt: new Date().toISOString(),
  });
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
    <div class="page-container" style="padding-top:32px">
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:3px;margin-bottom:8px">GERENCIAR USUÁRIOS</h2>
      <p style="color:var(--text3);margin-bottom:24px">Promova usuários a vendedores</p>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);overflow:hidden">
        ${users.length === 0 ? `<div class="empty-state"><div class="icon">👥</div><h3>Nenhum usuário cadastrado</h3></div>` :
          users.map(u => `
            <div class="user-row">
              <img class="user-row-avatar" src="${u.avatar}" alt="${u.username}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${u.username}'">
              <div class="user-row-name">
                <div style="font-weight:600">${u.username}</div>
                <div style="font-size:12px;color:var(--text3)">${u.email || ''}</div>
              </div>
              <span class="role-badge ${u.isSeller ? 'seller' : ''}">${u.isSeller ? 'Vendedor' : 'Comprador'}</span>
              <div style="display:flex;gap:8px;margin-left:16px">
                ${u.isSeller ?
                  `<button class="btn btn-outline btn-sm" style="border-color:var(--danger);color:var(--danger)" onclick="demoteSeller('${u.id}')">Remover vendedor</button>` :
                  `<button class="btn btn-outline btn-sm" style="border-color:var(--success);color:var(--success)" onclick="promoteSeller('${u.id}')">Promover a vendedor</button>`
                }
              </div>
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

  // Notify user
  const notifs = DB.getNotifs();
  notifs.push({
    id: uid(),
    userId,
    type: 'promotion',
    message: '🎉 Parabéns! Você foi promovido a vendedor no REDZIN MARKET! Agora você pode anunciar produtos e criar cupons.',
    read: false,
    createdAt: new Date().toISOString(),
  });
  DB.setNotifs(notifs);

  toast(`${users[idx].username} é agora um vendedor!`, 'success');
  render();
}

function demoteSeller(userId) {
  if (!confirm('Remover status de vendedor?')) return;
  const users = DB.getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) return;
  users[idx].isSeller = false;
  DB.setUsers(users);
  toast('Status de vendedor removido', 'info');
  render();
}

// ─── BOOT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
