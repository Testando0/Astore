// ========================================
// REDZIN MARKET - FRONTEND COMPLETO
// ========================================
var state = { user: null, page: 'home', params: {}, cart: [] };
var API = '/api';
var ws = null;

// ===== UTILS =====
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmt(n) { return 'R$ ' + (n || 0).toFixed(2).replace('.', ','); }
function timeAgo(d) {
  var s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return Math.floor(s / 60) + 'min';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
function toast(msg, type) {
  var c = document.getElementById('toasts');
  var el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(function() { el.remove(); }, 3000);
}
function go(page, params) {
  state.page = page;
  state.params = params || {};
  closeDropdown();
  render();
  window.scrollTo(0, 0);
}
function api(method, url, body) {
  var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(API + url, opts).then(function(r) { return r.json(); });
}

// ===== WEBSOCKET =====
function connectWS() {
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host);
  ws.onopen = function() { if (state.user) ws.send(JSON.stringify({ type: 'auth', userId: state.user.id })); };
  ws.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.type === 'chat_room') renderChatRoom(msg.roomId, msg.messages);
    if (msg.type === 'new_message') appendChatMsg(msg.message);
  };
  ws.onclose = function() { setTimeout(connectWS, 3000); };
}
function wsSend(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

// ===== DROPDOWN =====
function toggleMenu() {
  var dd = document.getElementById('dropdown');
  var ov = document.getElementById('dropdown-overlay');
  if (dd.classList.contains('show')) {
    closeDropdown();
    return;
  }
  var html = '';
  if (state.user) {
    html += '<div class="dd-header"><img src="' + state.user.avatar + '"><div>';
    html += '<div style="font-weight:600">' + state.user.username + '</div>';
    html += '<div style="font-size:11px;color:var(--text3)">' + (state.user.isSeller ? 'Vendedor' : 'Comprador') + '</div>';
    html += '</div></div>';
    html += '<div class="dd-item" onclick="go(\'profile\')">👤 Meu Perfil</div>';
    html += '<div class="dd-item" onclick="go(\'orders\')">📦 Meus Pedidos</div>';
    html += '<div class="dd-item" onclick="go(\'notifications\')">🔔 Notificações</div>';
    if (state.user.isSeller) html += '<div class="dd-item" onclick="go(\'seller-dashboard\')">💰 Painel Vendedor</div>';
    if (state.user.isAdmin) html += '<div class="dd-item" onclick="go(\'admin-users\')">⚙️ Gerenciar Usuários</div>';
    html += '<div class="dd-divider"></div>';
    html += '<div class="dd-item danger" onclick="logout()">🚪 Sair</div>';
  } else {
    html += '<div class="dd-item" onclick="showLogin()">🔑 Entrar</div>';
    html += '<div class="dd-item" onclick="showRegister()">📝 Criar conta</div>';
  }
  dd.innerHTML = html;
  dd.classList.add('show');
  ov.classList.add('show');
}
function closeDropdown() {
  document.getElementById('dropdown').classList.remove('show');
  document.getElementById('dropdown-overlay').classList.remove('show');
}

// ===== AUTH =====
function showLogin() {
  closeDropdown();
  var h = '<h2>ENTRAR</h2>';
  h += '<div class="form-group"><label>Nome de usuário</label><input class="form-control" id="login-user" placeholder="Seu nome"></div>';
  h += '<button class="btn btn-primary btn-full" onclick="doLogin()">Entrar</button>';
  h += '<div class="divider"></div>';
  h += '<p style="text-align:center;color:var(--text3);font-size:13px">Não tem conta? <span class="text-link" onclick="closeModal();showRegister()">Criar conta</span></p>';
  openModal(h);
}
function showRegister() {
  closeDropdown();
  var h = '<h2>CRIAR CONTA</h2>';
  h += '<div class="form-group"><label>Nome de usuário *</label><input class="form-control" id="reg-user" placeholder="Escolha um nome"></div>';
  h += '<div class="form-group"><label>Email</label><input class="form-control" id="reg-email" type="email" placeholder="seu@email.com"></div>';
  h += '<div class="form-group"><label>Telefone</label><input class="form-control" id="reg-phone" placeholder="11999999999"></div>';
  h += '<button class="btn btn-primary btn-full" onclick="doRegister()">Criar conta</button>';
  h += '<div class="divider"></div>';
  h += '<p style="text-align:center;color:var(--text3);font-size:13px">Já tem conta? <span class="text-link" onclick="closeModal();showLogin()">Entrar</span></p>';
  openModal(h);
}
function doLogin() {
  var username = document.getElementById('login-user').value.trim();
  if (!username) { toast('Digite seu nome', 'error'); return; }
  api('POST', '/login', { username: username }).then(function(data) {
    if (data.success) { setUser(data.user); closeModal(); toast('Bem-vindo!', 'success'); render(); }
    else toast(data.error || 'Erro', 'error');
  }).catch(function() { toast('Erro de conexão', 'error'); });
}
function doRegister() {
  var username = document.getElementById('reg-user').value.trim();
  var email = document.getElementById('reg-email').value.trim();
  var phone = document.getElementById('reg-phone').value.trim();
  if (!username) { toast('Digite um nome', 'error'); return; }
  var user = { id: uid(), username: username, email: email, phone: phone, avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(username), pixKey: null, isSeller: 0, isAdmin: 0 };
  api('POST', '/register', user).then(function(data) {
    if (data.success) { setUser(data.user); closeModal(); toast('Conta criada!', 'success'); render(); }
    else toast(data.error || 'Erro', 'error');
  }).catch(function() { toast('Erro de conexão', 'error'); });
}
function setUser(user) {
  state.user = user;
  localStorage.setItem('astore_user', JSON.stringify(user));
  updateBtn();
  wsSend({ type: 'auth', userId: user.id });
}
function logout() {
  state.user = null;
  localStorage.removeItem('astore_user');
  updateBtn();
  closeDropdown();
  go('home');
  toast('Até logo!', 'info');
}
function updateBtn() {
  var btn = document.getElementById('user-btn');
  if (state.user) btn.innerHTML = '<img src="' + state.user.avatar + '">';
  else btn.innerHTML = '&#128100;';
}

// ===== MODAL =====
function openModal(content) {
  document.getElementById('modal-wrap').innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><button class="modal-close" onclick="closeModal()">✕</button>' + content + '</div></div>';
}
function closeModal() { document.getElementById('modal-wrap').innerHTML = ''; }

// ===== RENDER =====
function render() {
  var main = document.getElementById('main');
  var p = state.page;
  if (p === 'home') renderHome(main);
  else if (p === 'product') renderProduct(main);
  else if (p === 'profile') renderProfile(main);
  else if (p === 'orders') renderOrders(main);
  else if (p === 'tracking') renderTracking(main);
  else if (p === 'seller-dashboard') renderDash(main);
  else if (p === 'seller-products') renderMyProducts(main);
  else if (p === 'add-product') renderAddProduct(main);
  else if (p === 'edit-product') renderEditProduct(main);
  else if (p === 'seller-coupons') renderCoupons(main);
  else if (p === 'seller-pix') renderPix(main);
  else if (p === 'admin-users') renderUsers(main);
  else if (p === 'chat') renderChat(main);
  else if (p === 'notifications') renderNotifs(main);
  else renderHome(main);
}

// ===== HOME =====
function renderHome(el) {
  api('GET', '/products').then(function(data) {
    var products = data.products || [];
    var cats = ['todos','moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'];
    var active = state.params.category || 'todos';
    var filtered = active === 'todos' ? products : products.filter(function(p) { return p.category === active; });
    var h = '<div class="hero"><h1>REDZIN<span>MARKET</span></h1><p>O marketplace black & white</p></div>';
    h += '<div class="categories">';
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      h += '<button class="cat-chip ' + (active === c ? 'active' : '') + '" onclick="go(\'home\',{category:\'' + c + '\'})">' + (c === 'todos' ? 'Todos' : c.charAt(0).toUpperCase() + c.slice(1)) + '</button>';
    }
    h += '</div><div class="container"><h2 class="section-title">' + filtered.length + ' PRODUTOS</h2><div class="grid">';
    if (filtered.length === 0) {
      h += '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📦</div><h3>Nenhum produto ainda</h3></div>';
    } else {
      for (var j = 0; j < filtered.length; j++) {
        var p = filtered[j];
        var off = (p.originalPrice && p.price < p.originalPrice) ? '<span class="badge-off">-' + Math.round((1 - p.price / p.originalPrice) * 100) + '%</span>' : '';
        h += '<div class="card" onclick="go(\'product\',{id:\'' + p.id + '\'})">' + off;
        h += '<img src="' + (p.images[0] || 'https://placehold.co/200x200/111/444?text=Produto') + '" onerror="this.src=\'https://placehold.co/200x200/111/444?text=?\'">';
        h += '<div class="card-info"><div class="card-title">' + p.title + '</div>';
        h += '<div class="card-price">' + fmt(p.price) + (p.originalPrice ? '<span class="old">' + fmt(p.originalPrice) + '</span>' : '') + '</div>';
        h += '<div class="card-sold">' + (p.sold || 0) + ' vendidos</div></div></div>';
      }
    }
    h += '</div></div>';
    el.innerHTML = h;
  });
}

// ===== PRODUCT =====
function renderProduct(el) {
  Promise.all([api('GET', '/products'), api('GET', '/users')]).then(function(r) {
    var products = r[0].products || [];
    var users = r[1].users || [];
    var p = products.find(function(x) { return x.id === state.params.id; });
    if (!p) { el.innerHTML = '<div class="container"><h2>Produto não encontrado</h2></div>'; return; }
    var seller = users.find(function(u) { return u.id === p.sellerId; });
    var h = '<div class="container" style="padding-top:20px;max-width:900px;margin:0 auto">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="go(\'home\')">← Voltar</button>';
    h += '<div class="detail"><div>';
    h += '<img class="detail-img" id="main-img" src="' + (p.images[0] || 'https://placehold.co/400x400/111/444?text=Produto') + '">';
    if (p.images.length > 1) {
      h += '<div class="detail-thumbs">';
      for (var i = 0; i < p.images.length; i++) {
        h += '<img class="detail-thumb ' + (i === 0 ? 'active' : '') + '" src="' + p.images[i] + '" onclick="changeImg(this,\'' + p.images[i] + '\')">';
      }
      h += '</div>';
    }
    h += '</div><div class="detail-info">';
    h += '<h1>' + p.title + '</h1>';
    h += '<div class="price-big">' + fmt(p.price) + (p.originalPrice ? '<span class="old">' + fmt(p.originalPrice) + '</span>' : '') + '</div>';
    h += '<div class="meta"><span>📦 ' + p.stock + ' em estoque</span><span>🛒 ' + (p.sold || 0) + ' vendidos</span><span>🏷 ' + p.category + '</span></div>';
    h += '<div style="margin-bottom:16px"><p style="color:var(--text2);font-size:14px;line-height:1.6">' + (p.description || 'Sem descrição') + '</p></div>';
    h += '<div class="qty-row"><span style="font-size:13px;color:var(--text2)">Qtd:</span><button class="qty-btn" onclick="chgQty(-1)">−</button><input class="qty-input" id="qty" value="1" readonly><button class="qty-btn" onclick="chgQty(1)">+</button></div>';
    h += '<button class="btn btn-primary btn-full" onclick="addCart(\'' + p.id + '\')">Adicionar ao carrinho</button>';
    h += '<button class="chat-btn" onclick="openChatWith(\'' + p.sellerId + '\',\'' + p.title.replace(/'/g, '') + '\')">💬 Falar com vendedor</button>';
    if (seller) {
      h += '<div class="seller-mini"><img src="' + seller.avatar + '"><div><div style="font-size:13px;font-weight:600">' + seller.username + '</div><div style="font-size:11px;color:var(--text3)">Vendedor</div></div></div>';
    }
    h += '</div></div></div>';
    el.innerHTML = h;
  });
}
function changeImg(thumb, src) {
  document.getElementById('main-img').src = src;
  var all = document.querySelectorAll('.detail-thumb');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
  thumb.classList.add('active');
}
function chgQty(d) { var i = document.getElementById('qty'); var v = parseInt(i.value) + d; if (v < 1) v = 1; i.value = v; }
function addCart(pid) {
  if (!state.user) { showLogin(); return; }
  toast('Produto adicionado!', 'success');
}
function openChatWith(userId, ctx) {
  if (!state.user) { showLogin(); return; }
  wsSend({ type: 'chat_open', userId: state.user.id, otherUserId: userId, productContext: ctx });
  go('chat');
}

// ===== PROFILE =====
function renderProfile(el) {
  if (!state.user) { showLogin(); return; }
  var u = state.user;
  var h = '<div class="container" style="padding-top:20px;max-width:600px;margin:0 auto">';
  h += '<h2 class="section-title">MEU PERFIL</h2>';
  h += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">';
  h += '<img src="' + u.avatar + '" style="width:72px;height:72px;border-radius:50%;border:3px solid var(--border2)">';
  h += '<div><h3 style="font-size:20px;font-weight:700">' + u.username + '</h3>';
  if (u.isSeller) h += '<span class="role-badge seller">Vendedor</span> ';
  if (u.isAdmin) h += '<span class="role-badge admin">Admin</span>';
  h += '</div></div>';
  h += '<div class="form-group"><label>Email</label><input class="form-control" id="p-email" value="' + (u.email || '') + '"></div>';
  h += '<div class="form-group"><label>Telefone</label><input class="form-control" id="p-phone" value="' + (u.phone || '') + '"></div>';
  h += '<div class="form-group"><label>Chave PIX</label><input class="form-control" id="p-pix" value="' + (u.pixKey || '') + '" placeholder="CPF, email, telefone..."></div>';
  h += '<button class="btn btn-primary btn-full" onclick="saveProfile()">Salvar</button>';
  if (u.isSeller) h += '<button class="btn btn-outline btn-full" style="margin-top:10px" onclick="go(\'seller-dashboard\')">Painel Vendedor</button>';
  if (u.isAdmin) h += '<button class="btn btn-outline btn-full" style="margin-top:10px" onclick="go(\'admin-users\')">Gerenciar Usuários</button>';
  h += '<button class="btn btn-outline btn-full" style="margin-top:10px;color:var(--danger);border-color:var(--danger)" onclick="logout()">Sair</button>';
  h += '</div>';
  el.innerHTML = h;
}
function saveProfile() {
  api('POST', '/update-user', { userId: state.user.id, email: document.getElementById('p-email').value.trim(), phone: document.getElementById('p-phone').value.trim(), avatar: state.user.avatar, pixKey: document.getElementById('p-pix').value.trim() })
    .then(function(d) { if (d.success) { setUser(d.user); toast('Salvo!', 'success'); render(); } else toast('Erro', 'error'); });
}

// ===== SELLER DASHBOARD =====
function renderDash(el) {
  if (!state.user || !state.user.isSeller) { go('home'); return; }
  Promise.all([api('GET', '/products'), api('GET', '/orders?sellerId=' + state.user.id)]).then(function(r) {
    var myP = (r[0].products || []).filter(function(p) { return p.sellerId === state.user.id; });
    var orders = r[1].orders || [];
    var rev = 0; for (var i = 0; i < orders.length; i++) if (orders[i].status !== 'pending_payment') rev += orders[i].total;
    var h = '<div class="container" style="padding-top:20px">';
    h += '<h2 class="section-title">PAINEL DO VENDEDOR</h2>';
    h += '<p style="color:var(--text3);margin-bottom:20px">Olá, ' + state.user.username + '!</p>';
    h += '<div class="dash-grid">';
    h += '<div class="dash-card"><div class="num">' + myP.length + '</div><div class="label">Produtos</div></div>';
    h += '<div class="dash-card"><div class="num">' + orders.length + '</div><div class="label">Pedidos</div></div>';
    h += '<div class="dash-card"><div class="num" style="font-size:18px">' + fmt(rev) + '</div><div class="label">Receita</div></div>';
    h += '</div><div class="action-grid">';
    h += '<button class="btn btn-primary" onclick="go(\'add-product\')">+ Anunciar</button>';
    h += '<button class="btn btn-outline" onclick="go(\'seller-products\')">Produtos</button>';
    h += '<button class="btn btn-outline" onclick="go(\'seller-coupons\')">Cupons</button>';
    h += '<button class="btn btn-outline" onclick="go(\'seller-pix\')">PIX</button>';
    h += '</div><h3 class="section-title">PEDIDOS RECENTES</h3>';
    if (orders.length === 0) h += '<div class="empty"><div class="empty-icon">📦</div><h3>Nenhum pedido</h3></div>';
    else for (var j = 0; j < Math.min(orders.length, 5); j++) {
      var o = orders[j];
      h += '<div class="list-item" onclick="go(\'tracking\',{id:\'' + o.id + '\'})"><div class="list-item-info"><div class="list-item-title">Pedido ' + o.id.slice(0, 8) + '</div><div class="list-item-sub">' + timeAgo(o.createdAt) + '</div><div class="list-item-price">' + fmt(o.total) + '</div></div><div style="font-size:12px;color:var(--text2)">' + o.status + '</div></div>';
    }
    h += '</div>';
    el.innerHTML = h;
  });
}

// ===== MY PRODUCTS =====
function renderMyProducts(el) {
  if (!state.user || !state.user.isSeller) { go('home'); return; }
  api('GET', '/products').then(function(data) {
    var myP = (data.products || []).filter(function(p) { return p.sellerId === state.user.id; });
    var h = '<div class="container" style="padding-top:20px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    h += '<h2 class="section-title" style="margin:0">MEUS PRODUTOS</h2>';
    h += '<button class="btn btn-primary btn-sm" onclick="go(\'add-product\')">+ Novo</button></div>';
    if (myP.length === 0) {
      h += '<div class="empty"><div class="empty-icon">📦</div><h3>Nenhum produto</h3><button class="btn btn-primary" onclick="go(\'add-product\')" style="margin-top:14px">Anunciar</button></div>';
    } else {
      for (var i = 0; i < myP.length; i++) {
        var p = myP[i];
        h += '<div class="list-item"><img class="list-item-img" src="' + (p.images[0] || '') + '" onerror="this.src=\'https://placehold.co/56x56/111/444?text=?\'">';
        h += '<div class="list-item-info"><div class="list-item-title">' + p.title + '</div><div class="list-item-sub">' + fmt(p.price) + ' · ' + p.stock + ' est · ' + (p.sold || 0) + ' vend</div></div>';
        h += '<div style="display:flex;gap:6px;flex-shrink:0"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();go(\'edit-product\',{id:\'' + p.id + '\'})">✏️</button>';
        h += '<button class="btn btn-sm" style="background:none;border:1px solid var(--danger);color:var(--danger)" onclick="event.stopPropagation();delProduct(\'' + p.id + '\')">🗑</button></div></div>';
      }
    }
    h += '</div>';
    el.innerHTML = h;
  });
}
function delProduct(id) {
  if (!confirm('Excluir?')) return;
  api('POST', '/product/delete', { id: id }).then(function() { toast('Excluído', 'info'); render(); });
}

// ===== ADD PRODUCT =====
function renderAddProduct(el) {
  if (!state.user || !state.user.isSeller) { go('home'); return; }
  var h = '<div class="container" style="padding-top:20px;max-width:680px;margin:0 auto">';
  h += '<button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="go(\'seller-products\')">← Voltar</button>';
  h += '<h2 class="section-title">ANUNCIAR PRODUTO</h2>';
  h += '<div class="form-group"><label>Título *</label><input class="form-control" id="p-title" placeholder="Nome do produto"></div>';
  h += '<div class="form-group"><label>Descrição *</label><textarea class="form-control" id="p-desc" placeholder="Descreva..." style="min-height:100px"></textarea></div>';
  h += '<div class="two-col"><div class="form-group"><label>Preço *</label><input class="form-control" id="p-price" type="number" step="0.01"></div>';
  h += '<div class="form-group"><label>Original</label><input class="form-control" id="p-orig" type="number" step="0.01"></div></div>';
  h += '<div class="two-col"><div class="form-group"><label>Estoque *</label><input class="form-control" id="p-stock" type="number"></div>';
  h += '<div class="form-group"><label>Categoria *</label><select class="form-control" id="p-cat">';
  var cats = ['moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'];
  for (var i = 0; i < cats.length; i++) h += '<option value="' + cats[i] + '">' + cats[i] + '</option>';
  h += '</select></div></div>';
  h += '<div class="form-group"><label>URLs das imagens (uma por linha)</label><textarea class="form-control" id="p-imgs" placeholder="https://..." style="min-height:70px"></textarea></div>';
  h += '<div class="form-group"><label>Upload</label><label class="btn btn-outline btn-sm" for="p-file" style="cursor:pointer">Selecionar</label><input type="file" id="p-file" accept="image/*" multiple onchange="uploadImgs(event)" style="display:none"><div class="img-previews" id="p-prev"></div></div>';
  h += '<button class="btn btn-primary btn-full" onclick="saveProd()">Publicar</button>';
  h += '</div>';
  el.innerHTML = h;
}
var uploaded = [];
function uploadImgs(ev) {
  var files = Array.from(ev.target.files);
  var prev = document.getElementById('p-prev');
  uploaded = [];
  prev.innerHTML = '<div style="color:var(--text2);font-size:13px">Enviando...</div>';
  var done = 0;
  files.forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      fetch('/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: e.target.result, type: file.type }) })
        .then(function(r) { return r.json(); })
        .then(function(j) {
          if (j.url) { uploaded.push(j.url); var img = document.createElement('img'); img.className = 'img-preview'; img.src = j.url; prev.appendChild(img); }
          done++;
          if (done === files.length) { var ld = prev.querySelector('div'); if (ld) ld.remove(); toast(uploaded.length + ' enviada(s)', 'success'); }
        });
    };
    reader.readAsDataURL(file);
  });
}
function saveProd(editId) {
  var title = document.getElementById('p-title').value.trim();
  var desc = document.getElementById('p-desc').value.trim();
  var price = parseFloat(document.getElementById('p-price').value);
  var orig = parseFloat(document.getElementById('p-orig').value) || null;
  var stock = parseInt(document.getElementById('p-stock').value) || 0;
  var cat = document.getElementById('p-cat').value;
  var urls = document.getElementById('p-imgs').value.split('\n').filter(function(u) { return u.trim(); });
  var imgs = uploaded.concat(urls).filter(Boolean);
  if (!title || !desc || !price || !cat) { toast('Preencha tudo', 'error'); return; }
  if (imgs.length === 0) imgs = ['https://placehold.co/400x400/111/444?text=' + encodeURIComponent(title)];
  var prod = { id: editId || uid(), sellerId: state.user.id, title: title, description: desc, price: price, originalPrice: orig, stock: stock, category: cat, images: imgs };
  api('POST', editId ? '/product/update' : '/product/create', prod).then(function() {
    toast(editId ? 'Atualizado!' : 'Publicado!', 'success');
    uploaded = [];
    go('seller-products');
  });
}

// ===== EDIT PRODUCT =====
function renderEditProduct(el) {
  if (!state.user || !state.user.isSeller) { go('home'); return; }
  api('GET', '/products').then(function(data) {
    var p = (data.products || []).find(function(x) { return x.id === state.params.id; });
    if (!p) { el.innerHTML = '<div class="container"><h3>Não encontrado</h3></div>'; return; }
    var h = '<div class="container" style="padding-top:20px;max-width:680px;margin:0 auto">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="go(\'seller-products\')">← Voltar</button>';
    h += '<h2 class="section-title">EDITAR PRODUTO</h2>';
    h += '<div class="form-group"><label>Título *</label><input class="form-control" id="p-title" value="' + p.title + '"></div>';
    h += '<div class="form-group"><label>Descrição *</label><textarea class="form-control" id="p-desc" style="min-height:100px">' + p.description + '</textarea></div>';
    h += '<div class="two-col"><div class="form-group"><label>Preço *</label><input class="form-control" id="p-price" type="number" step="0.01" value="' + p.price + '"></div>';
    h += '<div class="form-group"><label>Original</label><input class="form-control" id="p-orig" type="number" step="0.01" value="' + (p.originalPrice || '') + '"></div></div>';
    h += '<div class="two-col"><div class="form-group"><label>Estoque *</label><input class="form-control" id="p-stock" type="number" value="' + p.stock + '"></div>';
    h += '<div class="form-group"><label>Categoria *</label><select class="form-control" id="p-cat">';
    var cats = ['moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'];
    for (var i = 0; i < cats.length; i++) h += '<option value="' + cats[i] + '" ' + (p.category === cats[i] ? 'selected' : '') + '>' + cats[i] + '</option>';
    h += '</select></div></div>';
    h += '<div class="form-group"><label>Imagens</label><textarea class="form-control" id="p-imgs" style="min-height:70px">' + p.images.join('\n') + '</textarea></div>';
    h += '<div class="form-group"><div class="img-previews" id="p-prev"></div></div>';
    h += '<button class="btn btn-primary btn-full" onclick="saveProd(\'' + p.id + '\')">Salvar</button>';
    h += '</div>';
    el.innerHTML = h;
  });
}

// ===== COUPONS =====
function renderCoupons(el) {
  if (!state.user || !state.user.isSeller) { go('home'); return; }
  api('GET', '/coupons?sellerId=' + state.user.id).then(function(data) {
    var coupons = data.coupons || [];
    var h = '<div class="container" style="padding-top:20px">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="go(\'seller-dashboard\')">← Voltar</button>';
    h += '<h2 class="section-title">CUPONS</h2>';
    h += '<div class="panel" style="max-width:480px">';
    h += '<h3 style="font-size:16px;font-weight:700;margin-bottom:14px">Criar Cupom</h3>';
    h += '<div class="form-group"><label>Código *</label><input class="form-control" id="c-code" placeholder="DESCONTO10" style="text-transform:uppercase"></div>';
    h += '<div class="two-col"><div class="form-group"><label>Desconto % *</label><input class="form-control" id="c-disc" type="number" min="1" max="100"></div>';
    h += '<div class="form-group"><label>Usos máx *</label><input class="form-control" id="c-uses" type="number" min="1"></div></div>';
    h += '<div class="form-group"><label>Descrição</label><input class="form-control" id="c-desc" placeholder="10% primeira compra"></div>';
    h += '<button class="btn btn-primary btn-full" onclick="mkCoupon()">Criar</button></div>';
    if (coupons.length === 0) h += '<div class="empty"><div class="empty-icon">🏷</div><h3>Nenhum cupom</h3></div>';
    else for (var i = 0; i < coupons.length; i++) {
      var c = coupons[i];
      h += '<div class="coupon-card"><div><div class="coupon-code">' + c.code + '</div><div class="coupon-info">' + (c.description || '') + ' · ' + c.uses + '/' + c.maxUses + '</div></div>';
      h += '<div class="coupon-pct">' + c.discount + '%</div>';
      h += '<div style="display:flex;flex-direction:column;gap:5px"><span class="chip ' + (c.active ? 'chip-on' : 'chip-off') + '">' + (c.active ? 'Ativo' : 'Off') + '</span>';
      h += '<button class="btn btn-outline btn-sm" onclick="tglCoupon(\'' + c.id + '\',' + (!c.active) + ')">' + (c.active ? 'Desativar' : 'Ativar') + '</button>';
      h += '<button class="btn btn-sm" style="background:none;border:1px solid var(--danger);color:var(--danger)" onclick="rmCoupon(\'' + c.id + '\')">Excluir</button></div></div>';
    }
    h += '</div>';
    el.innerHTML = h;
  });
}
function mkCoupon() {
  var code = document.getElementById('c-code').value.trim().toUpperCase();
  var disc = parseInt(document.getElementById('c-disc').value);
  var uses = parseInt(document.getElementById('c-uses').value);
  var desc = document.getElementById('c-desc').value.trim();
  if (!code || !disc || !uses) { toast('Preencha tudo', 'error'); return; }
  api('POST', '/coupon/create', { id: uid(), sellerId: state.user.id, code: code, discount: disc, maxUses: uses, description: desc }).then(function() { toast('Cupom criado!', 'success'); render(); });
}
function tglCoupon(id, active) { api('POST', '/coupon/toggle', { id: id, active: active }).then(function() { render(); }); }
function rmCoupon(id) { if (!confirm('Excluir?')) return; api('POST', '/coupon/delete', { id: id }).then(function() { toast('Excluído', 'info'); render(); }); }

// ===== PIX =====
function renderPix(el) {
  if (!state.user || !state.user.isSeller) { go('home'); return; }
  var h = '<div class="container" style="padding-top:20px;max-width:500px;margin:0 auto">';
  h += '<button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="go(\'seller-dashboard\')">← Voltar</button>';
  h += '<h2 class="section-title">CHAVE PIX</h2>';
  h += '<div class="pix-card"><p style="color:var(--text2);font-size:13px;margin-bottom:16px">Configure para receber pagamentos.</p>';
  h += '<div class="form-group"><label>Tipo</label><select class="form-control" id="pix-type"><option>CPF</option><option>CNPJ</option><option>E-mail</option><option>Telefone</option><option>Aleatória</option></select></div>';
  h += '<div class="form-group"><label>Chave PIX</label><input class="form-control" id="pix-key" value="' + (state.user.pixKey || '') + '" placeholder="Sua chave"></div>';
  h += '<button class="btn btn-primary btn-full" onclick="savePix()">Salvar</button></div></div>';
  el.innerHTML = h;
}
function savePix() {
  var key = document.getElementById('pix-key').value.trim();
  if (!key) { toast('Digite a chave', 'error'); return; }
  api('POST', '/update-user', { userId: state.user.id, email: state.user.email, phone: state.user.phone, avatar: state.user.avatar, pixKey: key })
    .then(function(d) { if (d.success) { setUser(d.user); toast('Salvo!', 'success'); } });
}

// ===== ADMIN USERS =====
function renderUsers(el) {
  if (!state.user || !state.user.isAdmin) { go('home'); return; }
  api('GET', '/users').then(function(data) {
    var users = (data.users || []).filter(function(u) { return !u.isAdmin; });
    var h = '<div class="container" style="padding-top:20px">';
    h += '<h2 class="section-title">GERENCIAR USUÁRIOS</h2>';
    h += '<p style="color:var(--text3);margin-bottom:16px">Promova ou rebaixe vendedores</p>';
    h += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">';
    if (users.length === 0) h += '<div class="empty"><div class="empty-icon">👥</div><h3>Nenhum usuário</h3></div>';
    else for (var i = 0; i < users.length; i++) {
      var u = users[i];
      h += '<div class="user-row"><img src="' + u.avatar + '" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed=' + u.username + '\'">';
      h += '<div class="user-row-name"><div style="font-weight:600">' + u.username + '</div><div style="font-size:11px;color:var(--text3)">' + (u.email || '') + '</div></div>';
      h += '<span class="role-badge ' + (u.isSeller ? 'seller' : '') + '">' + (u.isSeller ? 'Vendedor' : 'Comprador') + '</span>';
      h += '<button class="btn btn-outline btn-sm" onclick="promote(\'' + u.id + '\',' + (!u.isSeller) + ')">' + (u.isSeller ? 'Rebaixar' : 'Promover') + '</button></div>';
    }
    h += '</div></div>';
    el.innerHTML = h;
  });
}
function promote(id, val) {
  api('POST', '/promote', { targetUserId: id, promote: val }).then(function(d) {
    if (d.success) { toast(val ? 'Promovido!' : 'Rebaixado!', 'success'); render(); }
  });
}

// ===== ORDERS =====
function renderOrders(el) {
  if (!state.user) { showLogin(); return; }
  api('GET', '/orders?buyerId=' + state.user.id).then(function(data) {
    var orders = data.orders || [];
    var h = '<div class="container" style="padding-top:20px">';
    h += '<h2 class="section-title">MEUS PEDIDOS</h2>';
    if (orders.length === 0) h += '<div class="empty"><div class="empty-icon">📦</div><h3>Nenhum pedido</h3></div>';
    else for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      h += '<div class="list-item" onclick="go(\'tracking\',{id:\'' + o.id + '\'})"><div class="list-item-info"><div class="list-item-title">Pedido ' + o.id.slice(0, 8) + '</div><div class="list-item-sub">' + timeAgo(o.createdAt) + '</div><div class="list-item-price">' + fmt(o.total) + '</div></div><div style="font-size:12px;color:var(--text2)">' + o.status + '</div></div>';
    }
    h += '</div>';
    el.innerHTML = h;
  });
}

// ===== TRACKING =====
function renderTracking(el) {
  Promise.all([api('GET', '/orders'), api('GET', '/products')]).then(function(r) {
    var order = (r[0].orders || []).find(function(o) { return o.id === state.params.id; });
    if (!order) { el.innerHTML = '<div class="container"><h2>Pedido não encontrado</h2></div>'; return; }
    var product = (r[1].products || []).find(function(p) { return p.id === order.productId; });
    var isSeller = state.user && state.user.id === order.sellerId;
    var h = '<div class="container" style="padding-top:20px;max-width:700px;margin:0 auto">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="history.back()">← Voltar</button>';
    h += '<div class="panel"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
    if (product) h += '<img src="' + (product.images[0] || '') + '" style="width:50px;height:50px;object-fit:cover;border-radius:8px;border:1px solid var(--border)" onerror="this.style.display=\'none\'">';
    h += '<div style="flex:1"><div style="font-weight:700">' + (product ? product.title : 'Produto') + '</div><div style="font-size:12px;color:var(--text2);margin-top:2px">' + order.status + '</div></div>';
    h += '<div style="font-family:\'Space Mono\',monospace;font-size:18px;font-weight:700">' + fmt(order.total) + '</div></div></div>';
    h += '<div class="panel"><h3 style="font-size:14px;font-weight:700;margin-bottom:12px">📍 ENDEREÇO</h3>';
    h += '<p style="font-size:13px;color:var(--text2)">' + (order.address.name || '-') + ' · ' + (order.address.phone || '') + '</p>';
    h += '<p style="font-size:13px;color:var(--text2)">' + (order.address.street || '') + ' ' + (order.address.num || '') + '</p>';
    h += '<p style="font-size:13px;color:var(--text2)">' + (order.address.city || '') + ' - ' + (order.address.state || '') + '</p></div>';
    h += '<div class="panel"><h3 style="font-size:14px;font-weight:700;margin-bottom:16px">📦 RASTREAMENTO</h3>';
    if (order.tracking.length === 0) h += '<p style="color:var(--text3)">Sem atualizações</p>';
    else {
      h += '<div class="track-steps">';
      for (var i = 0; i < order.tracking.length; i++) {
        var t = order.tracking[i];
        h += '<div class="track-step"><div class="track-dot"></div><div><div style="font-weight:600;font-size:13px">' + t.status + '</div><div style="font-size:11px;color:var(--text3)">' + t.location + ' · ' + timeAgo(t.date) + '</div></div></div>';
      }
      h += '</div>';
    }
    if (isSeller) {
      h += '<div class="divider"></div><h3 style="font-size:14px;font-weight:700;margin-bottom:12px">ATUALIZAR</h3>';
      h += '<div class="form-group"><label>Status</label><select class="form-control" id="t-status"><option value="processing">Processando</option><option value="shipped">Enviado</option><option value="delivered">Entregue</option></select></div>';
      h += '<div class="form-group"><label>Local</label><input class="form-control" id="t-loc" placeholder="Centro de Triagem SP"></div>';
      h += '<div class="form-group"><label>Descrição</label><input class="form-control" id="t-desc" placeholder="Saiu para entrega"></div>';
      h += '<button class="btn btn-primary btn-full" onclick="updTrack(\'' + order.id + '\')">Atualizar</button>';
    }
    h += '</div></div>';
    el.innerHTML = h;
  });
}
function updTrack(orderId) {
  var status = document.getElementById('t-status').value;
  var loc = document.getElementById('t-loc').value.trim() || '-';
  var desc = document.getElementById('t-desc').value.trim() || status;
  api('GET', '/orders').then(function(data) {
    var order = (data.orders || []).find(function(o) { return o.id === orderId; });
    if (!order) return;
    order.tracking.push({ status: desc, date: new Date().toISOString(), location: loc });
    api('POST', '/order/update-tracking', { id: orderId, status: status, tracking: order.tracking }).then(function() {
      api('POST', '/notifications/create', { id: uid(), userId: order.buyerId, type: 'tracking', message: 'Pedido: ' + desc + ' - ' + loc, orderId: orderId });
      toast('Atualizado!', 'success');
      render();
    });
  });
}

// ===== NOTIFICATIONS =====
function renderNotifs(el) {
  if (!state.user) { showLogin(); return; }
  api('GET', '/notifications?userId=' + state.user.id).then(function(data) {
    var notifs = data.notifs || [];
    var h = '<div class="container" style="padding-top:20px;max-width:700px;margin:0 auto">';
    h += '<h2 class="section-title">NOTIFICAÇÕES</h2>';
    h += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">';
    if (notifs.length === 0) h += '<div class="empty"><div class="empty-icon">🔔</div><h3>Nenhuma notificação</h3></div>';
    else for (var i = 0; i < notifs.length; i++) {
      var n = notifs[i];
      var oc = n.orderId ? 'go(\'tracking\',{id:\'' + n.orderId + '\'})' : '';
      h += '<div class="notif-item" onclick="' + oc + '"><div class="notif-dot ' + (n.read ? '' : 'unread') + '"></div><div><div style="font-size:13px">' + n.message + '</div><div style="font-size:11px;color:var(--text3);margin-top:4px">' + timeAgo(n.createdAt) + '</div></div></div>';
    }
    h += '</div></div>';
    el.innerHTML = h;
  });
}

// ===== CHAT =====
function renderChat(el) {
  var h = '<div class="container" style="padding-top:20px;max-width:700px;margin:0 auto">';
  h += '<button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="history.back()">← Voltar</button>';
  h += '<h2 class="section-title">CHAT</h2>';
  h += '<div class="chat-box"><div class="chat-msgs" id="chat-msgs"><div class="empty"><div class="empty-icon">💬</div><h3>Aguardando...</h3></div></div>';
  h += '<div class="chat-input-row"><input class="form-control" id="chat-in" placeholder="Mensagem..." onkeydown="if(event.key===\'Enter\')sendMsg()"><button class="btn btn-primary" onclick="sendMsg()">→</button></div></div>';
  h += '</div>';
  el.innerHTML = h;
}
var currentRoom = null;
function renderChatRoom(roomId, messages) {
  currentRoom = roomId;
  var c = document.getElementById('chat-msgs');
  if (!c) return;
  var h = '';
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    var mine = state.user && m.senderId === state.user.id;
    var sys = m.senderId === '__system__';
    if (sys) { h += '<div style="text-align:center;font-size:12px;color:var(--text3);margin:10px 0">' + m.text + '</div>'; continue; }
    h += '<div class="chat-msg ' + (mine ? 'right' : 'left') + '"><div class="chat-bubble">' + m.text + '</div><div class="chat-time">' + timeAgo(m.createdAt) + '</div></div>';
  }
  c.innerHTML = h;
  c.scrollTop = c.scrollHeight;
}
function appendChatMsg(msg) {
  var c = document.getElementById('chat-msgs');
  if (!c) return;
  var mine = state.user && msg.senderId === state.user.id;
  var div = document.createElement('div');
  div.className = 'chat-msg ' + (mine ? 'right' : 'left');
  div.innerHTML = '<div class="chat-bubble">' + msg.text + '</div><div class="chat-time">' + timeAgo(msg.createdAt) + '</div>';
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}
function sendMsg() {
  var input = document.getElementById('chat-in');
  var text = input.value.trim();
  if (!text || !currentRoom) return;
  wsSend({ type: 'chat_message', roomId: currentRoom, senderId: state.user.id, text: text });
  input.value = '';
}

// ===== INIT =====
function init() {
  var saved = localStorage.getItem('astore_user');
  if (saved) { try { state.user = JSON.parse(saved); } catch(e) {} }
  
  document.getElementById('user-btn').addEventListener('click', toggleMenu);
  
  connectWS();
  render();
  updateBtn();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
