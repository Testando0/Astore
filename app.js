// ============================================================
// REDZIN MARKET - FRONTEND
// ============================================================
var state = {
  user: null,
  page: 'home',
  params: {},
  uploaded: [],
  chatSocketRoom: null,
  unreadCount: 0
};
var API = '/api';
var ws = null;
var wsReconnectTimer = null;

// ===== UTILS =====
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmt(n) { return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ','); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  });
}
function timeAgo(d) {
  if (!d) return '';
  var s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 0) s = 0;
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
  setTimeout(function() { el.remove(); }, 3500);
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
  return fetch(API + url, opts).then(function(r) {
    return r.json().catch(function() { return {}; });
  });
}
function openModal(content) {
  document.getElementById('modal-wrap').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><button class="modal-close" onclick="closeModal()">✕</button>' + content + '</div></div>';
}
function closeModal() { document.getElementById('modal-wrap').innerHTML = ''; }
function loadingHTML() { return '<div class="loading"><div class="spinner"></div>Carregando...</div>'; }

// ===== WEBSOCKET =====
function connectWS() {
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    ws = new WebSocket(proto + '//' + location.host);
  } catch(e) {
    scheduleReconnect();
    return;
  }
  ws.onopen = function() {
    if (state.user) wsSend({ type: 'auth', userId: state.user.id });
  };
  ws.onmessage = function(e) {
    var msg;
    try { msg = JSON.parse(e.data); } catch(err) { return; }
    if (msg.type === 'chat_room') renderChatMessages(msg.roomId, msg.messages);
    if (msg.type === 'new_message') {
      appendChatMsg(msg.message);
    }
    if (msg.type === 'new_notification') {
      toast(msg.notification.message.split('\n')[0], 'success');
      bumpNotifBadge();
      if (state.page === 'notifications') renderNotifications(document.getElementById('main'));
      if (state.page === 'sales' || state.page === 'seller-dashboard') render();
    }
  };
  ws.onclose = function() { scheduleReconnect(); };
  ws.onerror = function() {};
}
function scheduleReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(function() {
    wsReconnectTimer = null;
    connectWS();
  }, 2500);
}
function wsSend(msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}
function bumpNotifBadge() {
  state.unreadCount++;
  var b = document.getElementById('notif-badge');
  if (b) {
    b.textContent = state.unreadCount > 9 ? '9+' : state.unreadCount;
    b.style.display = 'flex';
  }
}

// ===== DROPDOWN =====
function toggleMenu() {
  var dd = document.getElementById('dropdown');
  var ov = document.getElementById('dropdown-overlay');
  if (dd.classList.contains('show')) { closeDropdown(); return; }
  var html = '';
  if (state.user) {
    html += '<div class="dd-header"><img src="' + esc(state.user.avatar || '') + '" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed=user\'"><div>';
    html += '<div style="font-weight:600;font-size:14px">' + esc(state.user.username) + '</div>';
    html += '<div style="font-size:11px;color:var(--text3)">' + (state.user.isadmin ? 'Admin' : state.user.isseller ? 'Vendedor' : 'Comprador') + '</div>';
    html += '</div></div>';
    html += '<div class="dd-item" onclick="go(\'profile\')">👤 Meu Perfil</div>';
    html += '<div class="dd-item" onclick="go(\'orders\')">📦 Meus Pedidos</div>';
    if (state.user.isseller) {
      html += '<div class="dd-item" onclick="go(\'seller-dashboard\')">💰 Painel Vendedor</div>';
      html += '<div class="dd-item" onclick="go(\'sales\')">🧾 Minhas Vendas</div>';
    }
    html += '<div class="dd-item" onclick="go(\'chats\')">💬 Conversas</div>';
    html += '<div class="dd-item" onclick="go(\'notifications\')">🔔 Notificações</div>';
    if (state.user.isadmin) {
      html += '<div class="dd-divider"></div>';
      html += '<div class="dd-item" onclick="go(\'admin-users\')">⚙️ Gerenciar Usuários</div>';
    }
    html += '<div class="dd-divider"></div>';
    html += '<div class="dd-item danger" onclick="logout()">🚪 Sair</div>';
  } else {
    html += '<div class="dd-item" onclick="closeDropdown();showLogin()">🔑 Entrar</div>';
    html += '<div class="dd-item" onclick="closeDropdown();showRegister()">📝 Criar conta</div>';
  }
  dd.innerHTML = html;
  dd.classList.add('show');
  ov.classList.add('show');
}
function closeDropdown() {
  var dd = document.getElementById('dropdown');
  var ov = document.getElementById('dropdown-overlay');
  if (dd) dd.classList.remove('show');
  if (ov) ov.classList.remove('show');
}

// ===== AUTH =====
function showLogin() {
  closeDropdown();
  var h = '<h2>ENTRAR</h2>';
  h += '<div class="form-group"><label>Nome de usuário</label><input class="form-control" id="login-user" placeholder="Seu nome" autocomplete="username"></div>';
  h += '<button class="btn btn-primary btn-full" onclick="doLogin()">Entrar</button>';
  h += '<div class="divider"></div>';
  h += '<p style="text-align:center;color:var(--text3);font-size:13px">Não tem conta? <span class="text-link" onclick="closeModal();showRegister()">Criar conta</span></p>';
  openModal(h);
}
function showRegister() {
  closeDropdown();
  var h = '<h2>CRIAR CONTA</h2>';
  h += '<div class="form-group"><label>Nome de usuário *</label><input class="form-control" id="reg-user" placeholder="Escolha um nome" autocomplete="username"></div>';
  h += '<div class="form-group"><label>Email</label><input class="form-control" id="reg-email" type="email" placeholder="seu@email.com" autocomplete="email"></div>';
  h += '<div class="form-group"><label>Telefone</label><input class="form-control" id="reg-phone" type="tel" placeholder="(11) 99999-9999" autocomplete="tel"></div>';
  h += '<button class="btn btn-primary btn-full" onclick="doRegister()">Criar conta</button>';
  h += '<div class="divider"></div>';
  h += '<p style="text-align:center;color:var(--text3);font-size:13px">Já tem conta? <span class="text-link" onclick="closeModal();showLogin()">Entrar</span></p>';
  openModal(h);
}
function doLogin() {
  var username = document.getElementById('login-user').value.trim();
  if (!username) { toast('Digite seu nome', 'error'); return; }
  api('POST', '/login', { username: username }).then(function(data) {
    if (data.success) {
      setUser(data.user);
      closeModal();
      toast('Bem-vindo, ' + data.user.username + '!', 'success');
      render();
    } else toast(data.error || 'Erro', 'error');
  }).catch(function() { toast('Erro de conexão', 'error'); });
}
function doRegister() {
  var username = document.getElementById('reg-user').value.trim();
  var email = document.getElementById('reg-email').value.trim();
  var phone = document.getElementById('reg-phone').value.trim();
  if (!username || username.length < 3) { toast('Nome muito curto', 'error'); return; }
  var user = {
    id: uid(),
    username: username,
    email: email,
    phone: phone,
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(username),
    pixKey: null
  };
  api('POST', '/register', user).then(function(data) {
    if (data.success) {
      setUser(data.user);
      closeModal();
      toast('Conta criada!', 'success');
      render();
    } else toast(data.error || 'Erro', 'error');
  }).catch(function() { toast('Erro de conexão', 'error'); });
}
function setUser(user) {
  state.user = user;
  localStorage.setItem('redzin_user', JSON.stringify(user));
  updateBtn();
  if (ws && ws.readyState === 1) wsSend({ type: 'auth', userId: user.id });
}
function logout() {
  state.user = null;
  localStorage.removeItem('redzin_user');
  updateBtn();
  closeDropdown();
  go('home');
  toast('Até logo!', 'info');
}
function updateBtn() {
  var btn = document.getElementById('user-btn');
  if (!btn) return;
  if (state.user) {
    btn.innerHTML = '<img src="' + esc(state.user.avatar || '') + '" onerror="this.style.display=\'none\';this.parentNode.textContent=\'👤\'">';
  } else {
    btn.innerHTML = '👤';
  }
}

// ===== ROUTER =====
function render() {
  var main = document.getElementById('main');
  main.innerHTML = loadingHTML();
  var p = state.page;
  if (p === 'home') renderHome(main);
  else if (p === 'product') renderProduct(main);
  else if (p === 'profile') renderProfile(main);
  else if (p === 'orders') renderOrders(main);
  else if (p === 'sales') renderSales(main);
  else if (p === 'tracking') renderTracking(main);
  else if (p === 'seller-dashboard') renderDash(main);
  else if (p === 'seller-products') renderMyProducts(main);
  else if (p === 'add-product') renderAddProduct(main);
  else if (p === 'edit-product') renderEditProduct(main);
  else if (p === 'seller-coupons') renderCoupons(main);
  else if (p === 'seller-pix') renderPix(main);
  else if (p === 'admin-users') renderUsers(main);
  else if (p === 'chats') renderChatsList(main);
  else if (p === 'chat') renderChat(main);
  else if (p === 'notifications') renderNotifications(main);
  else renderHome(main);
}

// ===== HOME =====
function renderHome(el) {
  api('GET', '/products').then(function(data) {
    var products = data.products || [];
    var cats = ['todos','moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'];
    var active = state.params.category || 'todos';
    var filtered = active === 'todos' ? products : products.filter(function(p) { return p.category === active; });
    var h = '<div class="hero"><h1>REDZIN<span>MARKET</span></h1><p>o marketplace black & white</p></div>';
    h += '<div class="categories">';
    cats.forEach(function(c) {
      h += '<button class="cat-chip ' + (active === c ? 'active' : '') + '" onclick="go(\'home\',{category:\'' + c + '\'})">' + (c === 'todos' ? 'Todos' : c.charAt(0).toUpperCase() + c.slice(1)) + '</button>';
    });
    h += '</div><div class="container"><h2 class="section-title">' + filtered.length + ' PRODUTO' + (filtered.length === 1 ? '' : 'S') + '</h2><div class="grid">';
    if (filtered.length === 0) {
      h += '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📦</div><h3>Nenhum produto</h3><p>Ainda não há produtos nesta categoria</p></div>';
    } else {
      filtered.forEach(function(p) {
        var imgs = p.images || [];
        var imgSrc = imgs[0] || 'https://placehold.co/400x400/111/444?text=?';
        var off = (p.originalprice && p.price < p.originalprice) ? '<span class="badge-off">-' + Math.round((1 - p.price / p.originalprice) * 100) + '%</span>' : '';
        h += '<div class="card" onclick="go(\'product\',{id:\'' + p.id + '\'})">' + off;
        h += '<img src="' + esc(imgSrc) + '" onerror="this.src=\'https://placehold.co/400x400/111/444?text=?\'" loading="lazy">';
        h += '<div class="card-info"><div class="card-title">' + esc(p.title) + '</div>';
        h += '<div class="card-price">' + fmt(p.price) + (p.originalprice ? '<span class="old">' + fmt(p.originalprice) + '</span>' : '') + '</div>';
        h += '<div class="card-sold">' + (p.sold || 0) + ' vendido' + ((p.sold || 0) === 1 ? '' : 's') + '</div></div></div>';
      });
    }
    h += '</div></div>';
    el.innerHTML = h;
  }).catch(function() {
    el.innerHTML = '<div class="container"><div class="empty"><div class="empty-icon">⚠️</div><h3>Erro ao carregar</h3><p>Tente novamente</p></div></div>';
  });
}

// ===== PRODUCT =====
function renderProduct(el) {
  Promise.all([api('GET', '/products'), api('GET', '/users')]).then(function(r) {
    var products = r[0].products || [];
    var users = r[1].users || [];
    var p = products.find(function(x) { return x.id === state.params.id; });
    if (!p) {
      el.innerHTML = '<div class="container"><div class="empty"><div class="empty-icon">❓</div><h3>Não encontrado</h3></div></div>';
      return;
    }
    var seller = users.find(function(u) { return u.id === p.sellerid; });
    var imgs = p.images || [];
    var h = '<div class="container" style="max-width:960px">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:14px" onclick="go(\'home\')">← Voltar</button>';
    h += '<div class="detail"><div>';
    h += '<img class="detail-img" id="main-img" src="' + esc(imgs[0] || 'https://placehold.co/600x600/111/444?text=?') + '" onerror="this.src=\'https://placehold.co/600x600/111/444?text=?\'">';
    if (imgs.length > 1) {
      h += '<div class="detail-thumbs">';
      imgs.forEach(function(u, i) {
        h += '<img class="detail-thumb ' + (i === 0 ? 'active' : '') + '" src="' + esc(u) + '" onclick="changeImg(this,\'' + esc(u).replace(/'/g, '&#39;') + '\')">';
      });
      h += '</div>';
    }
    h += '</div><div class="detail-info">';
    h += '<h1>' + esc(p.title) + '</h1>';
    h += '<div class="price-big">' + fmt(p.price) + (p.originalprice ? '<span class="old">' + fmt(p.originalprice) + '</span>' : '') + '</div>';
    h += '<div class="meta"><span>📦 ' + p.stock + ' em estoque</span><span>🛒 ' + (p.sold || 0) + ' vendidos</span><span>🏷 ' + esc(p.category || '') + '</span></div>';
    h += '<p style="color:var(--text2);font-size:14px;line-height:1.6;margin-bottom:16px">' + esc(p.description || 'Sem descrição') + '</p>';
    h += '<div class="qty-row"><span style="font-size:13px;color:var(--text2)">Qtd:</span><button class="qty-btn" onclick="chgQty(-1)">−</button><input class="qty-input" id="qty" value="1" readonly><button class="qty-btn" onclick="chgQty(1)">+</button></div>';
    if (p.stock > 0) {
      h += '<button class="btn btn-primary btn-full" onclick="startCheckout(\'' + p.id + '\')">🛒 Comprar agora</button>';
    } else {
      h += '<button class="btn btn-outline btn-full" disabled>Sem estoque</button>';
    }
    h += '<button class="btn btn-outline btn-full" style="margin-top:10px" onclick="openChatWith(\'' + p.sellerid + '\',' + JSON.stringify(p.title) + ')">💬 Falar com vendedor</button>';
    if (seller) {
      h += '<div class="seller-mini"><img src="' + esc(seller.avatar) + '" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed=' + esc(seller.username) + '\'"><div><div style="font-size:14px;font-weight:600">' + esc(seller.username) + '</div><div style="font-size:11px;color:var(--text3)">Vendedor</div></div></div>';
    }
    h += '</div></div></div>';
    el.innerHTML = h;
  });
}
function changeImg(thumb, src) {
  document.getElementById('main-img').src = src;
  document.querySelectorAll('.detail-thumb').forEach(function(t) { t.classList.remove('active'); });
  thumb.classList.add('active');
}
function chgQty(d) {
  var i = document.getElementById('qty');
  var max = Math.max(1, parseInt(document.querySelector('[data-stock]')?.dataset.stock || '999'));
  var v = Math.max(1, parseInt(i.value) + d);
  i.value = v;
}
function openChatWith(userId, ctx) {
  if (!state.user) { showLogin(); return; }
  if (state.user.id === userId) { toast('Você é o vendedor', 'warning'); return; }
  wsSend({ type: 'chat_open', userId: state.user.id, otherUserId: userId, productContext: ctx });
  state.params = { otherUserId: userId, ctx: ctx };
  setTimeout(function() { go('chat'); }, 80);
}

// ===== CHECKOUT =====
function startCheckout(productId) {
  if (!state.user) { showLogin(); return; }
  var qty = parseInt(document.getElementById('qty').value) || 1;
  api('GET', '/products').then(function(data) {
    var p = (data.products || []).find(function(x) { return x.id === productId; });
    if (!p) { toast('Produto não encontrado', 'error'); return; }
    if (p.stock < qty) { toast('Estoque insuficiente', 'error'); return; }
    var u = state.user;
    var h = '<h2>FINALIZAR COMPRA</h2>';
    h += '<div style="background:var(--bg3);padding:12px;border-radius:10px;margin-bottom:16px;display:flex;gap:12px;align-items:center">';
    h += '<img src="' + esc((p.images || [])[0] || 'https://placehold.co/60x60/111/444?text=?') + '" style="width:50px;height:50px;object-fit:cover;border-radius:8px">';
    h += '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">' + esc(p.title) + '</div>';
    h += '<div style="font-size:12px;color:var(--text3)">' + qty + 'x · ' + fmt(p.price * qty) + '</div></div></div>';
    h += '<div class="form-group"><label>Nome completo *</label><input class="form-control" id="chk-name" value="' + esc(u.username) + '"></div>';
    h += '<div class="form-group"><label>Telefone *</label><input class="form-control" id="chk-phone" type="tel" value="' + esc(u.phone || '') + '" placeholder="(11) 99999-9999"></div>';
    h += '<div class="two-col"><div class="form-group"><label>Rua *</label><input class="form-control" id="chk-street"></div>';
    h += '<div class="form-group"><label>Número *</label><input class="form-control" id="chk-num"></div></div>';
    h += '<div class="form-group"><label>Bairro</label><input class="form-control" id="chk-neigh"></div>';
    h += '<div class="two-col"><div class="form-group"><label>Cidade *</label><input class="form-control" id="chk-city"></div>';
    h += '<div class="form-group"><label>UF *</label><input class="form-control" id="chk-state" maxlength="2" placeholder="SP" style="text-transform:uppercase"></div></div>';
    h += '<div class="form-group"><label>CEP</label><input class="form-control" id="chk-zip" inputmode="numeric"></div>';
    h += '<div class="form-group"><label>Cupom (opcional)</label><input class="form-control" id="chk-coupon" placeholder="CÓDIGO" style="text-transform:uppercase"></div>';
    h += '<div id="coupon-msg" style="font-size:12px;margin-bottom:8px"></div>';
    h += '<button class="btn btn-primary btn-full" onclick="confirmCheckout(\'' + productId + '\',' + qty + ',\'' + p.sellerid + '\')">Gerar PIX</button>';
    openModal(h);
  });
}
async function confirmCheckout(productId, qty, sellerId) {
  var name = document.getElementById('chk-name').value.trim();
  var phone = document.getElementById('chk-phone').value.trim();
  var street = document.getElementById('chk-street').value.trim();
  var num = document.getElementById('chk-num').value.trim();
  var neigh = document.getElementById('chk-neigh').value.trim();
  var city = document.getElementById('chk-city').value.trim();
  var uf = document.getElementById('chk-state').value.trim().toUpperCase();
  var zip = document.getElementById('chk-zip').value.trim();
  var coupon = document.getElementById('chk-coupon').value.trim().toUpperCase();

  if (!name || !phone || !street || !num || !city || !uf) {
    toast('Preencha os campos obrigatórios', 'error');
    return;
  }

  var address = { name: name, phone: phone, street: street, num: num, neigh: neigh, city: city, state: uf, zip: zip };

  var btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando PIX...'; }

  try {
    var res = await api('POST', '/checkout', {
      productId: productId,
      quantity: qty,
      buyerId: state.user.id,
      buyerEmail: state.user.email || 'comprador@redzin.com',
      buyerName: name,
      address: address,
      couponCode: coupon || null
    });
    if (!res.success) {
      toast(res.error || 'Erro ao gerar PIX', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Gerar PIX'; }
      return;
    }
    showPixModal(res);
  } catch(e) {
    toast('Erro de conexão', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Gerar PIX'; }
  }
}
function showPixModal(res) {
  var h = '<h2>PAGUE COM PIX</h2>';
  h += '<p style="color:var(--text2);font-size:13px;margin-bottom:14px;text-align:center">Escaneie o QR Code ou copie o código</p>';
  if (res.qrCodeBase64) {
    h += '<div class="pix-qr"><img src="data:image/png;base64,' + res.qrCodeBase64 + '" alt="QR Code PIX"></div>';
  }
  h += '<div style="text-align:center;margin-bottom:16px;font-family:\'Space Mono\',monospace;font-size:22px;font-weight:700">' + fmt(res.total) + '</div>';
  h += '<div class="form-group"><label>Código PIX (copia e cola)</label>';
  h += '<div class="pix-code" id="pix-code">' + esc(res.qrCode || '') + '</div></div>';
  h += '<button class="btn btn-outline btn-full" onclick="copyPix()" style="margin-bottom:10px">📋 Copiar código</button>';
  h += '<p style="font-size:12px;color:var(--text3);text-align:center;line-height:1.5">Após o pagamento o vendedor será notificado automaticamente.<br>Você receberá uma notificação quando for confirmado.</p>';
  h += '<button class="btn btn-primary btn-full" style="margin-top:16px" onclick="closeModal();go(\'orders\')">Ver meus pedidos</button>';
  openModal(h);
}
function copyPix() {
  var text = document.getElementById('pix-code').textContent;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(function() { toast('Copiado!', 'success'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copiado!', 'success'); } catch(e) { toast('Copie manualmente', 'info'); }
    ta.remove();
  }
}

// ===== PROFILE =====
function renderProfile(el) {
  if (!state.user) { showLogin(); return; }
  var u = state.user;
  var h = '<div class="container" style="max-width:600px">';
  h += '<h2 class="section-title">MEU PERFIL</h2>';
  h += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:22px">';
  h += '<img src="' + esc(u.avatar || '') + '" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed=user\'" style="width:72px;height:72px;border-radius:50%;border:3px solid var(--border2);object-fit:cover">';
  h += '<div><h3 style="font-size:19px;font-weight:700">' + esc(u.username) + '</h3>';
  if (u.isseller) h += '<span class="role-badge seller">Vendedor</span> ';
  if (u.isadmin) h += '<span class="role-badge admin">Admin</span>';
  h += '</div></div>';
  h += '<div class="form-group"><label>Email</label><input class="form-control" id="p-email" value="' + esc(u.email || '') + '" type="email"></div>';
  h += '<div class="form-group"><label>Telefone</label><input class="form-control" id="p-phone" value="' + esc(u.phone || '') + '" type="tel"></div>';
  h += '<div class="form-group"><label>Chave PIX (para receber)</label><input class="form-control" id="p-pix" value="' + esc(u.pixKey || '') + '" placeholder="CPF, email, telefone..."></div>';
  h += '<button class="btn btn-primary btn-full" onclick="saveProfile()">Salvar</button>';
  if (u.isseller) h += '<button class="btn btn-outline btn-full" style="margin-top:10px" onclick="go(\'seller-dashboard\')">Painel Vendedor</button>';
  if (u.isadmin) h += '<button class="btn btn-outline btn-full" style="margin-top:10px" onclick="go(\'admin-users\')">Gerenciar Usuários</button>';
  h += '<button class="btn btn-outline btn-full" style="margin-top:10px;color:var(--danger);border-color:var(--danger)" onclick="logout()">Sair da conta</button>';
  h += '</div>';
  el.innerHTML = h;
}
function saveProfile() {
  api('POST', '/update-user', {
    userId: state.user.id,
    email: document.getElementById('p-email').value.trim(),
    phone: document.getElementById('p-phone').value.trim(),
    avatar: state.user.avatar,
    pixKey: document.getElementById('p-pix').value.trim()
  }).then(function(d) {
    if (d.success) { setUser(d.user); toast('Salvo!', 'success'); render(); }
    else toast('Erro', 'error');
  });
}

// ===== SELLER DASHBOARD =====
function renderDash(el) {
  if (!state.user || !state.user.isseller) { go('home'); return; }
  Promise.all([
    api('GET', '/products'),
    api('GET', '/orders?sellerId=' + state.user.id)
  ]).then(function(r) {
    var myP = (r[0].products || []).filter(function(p) { return p.sellerid === state.user.id; });
    var orders = r[1].orders || [];
    var rev = 0;
    orders.forEach(function(o) { if (o.status !== 'pending_payment') rev += Number(o.total); });
    var paidOrders = orders.filter(function(o) { return o.status === 'paid' || o.status === 'processing' || o.status === 'shipped'; });
    var h = '<div class="container">';
    h += '<h2 class="section-title">PAINEL DO VENDEDOR</h2>';
    h += '<p style="color:var(--text3);margin-bottom:18px;font-size:13px">Olá, @' + esc(state.user.username) + '!</p>';
    h += '<div class="dash-grid">';
    h += '<div class="dash-card"><div class="num">' + myP.length + '</div><div class="label">Produtos</div></div>';
    h += '<div class="dash-card"><div class="num">' + orders.length + '</div><div class="label">Pedidos</div></div>';
    h += '<div class="dash-card"><div class="num" style="font-size:15px">' + fmt(rev) + '</div><div class="label">Receita</div></div>';
    h += '</div>';
    if (paidOrders.length > 0) {
      h += '<div class="panel" style="border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.05)">';
      h += '<div style="font-weight:700;color:var(--success);margin-bottom:6px">💰 ' + paidOrders.length + ' pedido' + (paidOrders.length === 1 ? '' : 's') + ' pago' + (paidOrders.length === 1 ? '' : 's') + ' aguardando envio</div>';
      h += '<div style="font-size:12px;color:var(--text2)">Vá em "Minhas Vendas" para preparar e atualizar o rastreamento.</div>';
      h += '</div>';
    }
    h += '<div class="action-grid">';
    h += '<button class="btn btn-primary" onclick="go(\'add-product\')">+ Anunciar</button>';
    h += '<button class="btn btn-outline" onclick="go(\'seller-products\')">Produtos</button>';
    h += '<button class="btn btn-outline" onclick="go(\'sales\')">Vendas</button>';
    h += '<button class="btn btn-outline" onclick="go(\'seller-coupons\')">Cupons</button>';
    h += '</div>';
    h += '<h3 class="section-title">PEDIDOS RECENTES</h3>';
    if (orders.length === 0) {
      h += '<div class="empty"><div class="empty-icon">📦</div><h3>Nenhum pedido</h3></div>';
    } else {
      orders.slice(0, 5).forEach(function(o) {
        h += '<div class="list-item" onclick="go(\'tracking\',{id:\'' + o.id + '\'})"><div class="list-item-info"><div class="list-item-title">' + esc(o.producttitle || 'Pedido ' + o.id.slice(0, 8)) + '</div><div class="list-item-sub">' + timeAgo(o.createdat) + '</div><div class="list-item-price">' + fmt(o.total) + '</div></div><span class="status-badge status-' + o.status + '">' + statusLabel(o.status) + '</span></div>';
      });
    }
    h += '</div>';
    el.innerHTML = h;
  });
}
function statusLabel(s) {
  var m = { pending_payment:'Aguardando', paid:'Pago', processing:'Preparando', shipped:'Enviado', delivered:'Entregue' };
  return m[s] || s;
}

// ===== MY PRODUCTS =====
function renderMyProducts(el) {
  if (!state.user || !state.user.isseller) { go('home'); return; }
  api('GET', '/products').then(function(data) {
    var myP = (data.products || []).filter(function(p) { return p.sellerid === state.user.id; });
    var h = '<div class="container">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    h += '<h2 class="section-title" style="margin:0">MEUS PRODUTOS</h2>';
    h += '<button class="btn btn-primary btn-sm" onclick="go(\'add-product\')">+ Novo</button></div>';
    if (myP.length === 0) {
      h += '<div class="empty"><div class="empty-icon">📦</div><h3>Nenhum produto</h3><p>Anuncie seu primeiro produto</p><button class="btn btn-primary" onclick="go(\'add-product\')">Anunciar agora</button></div>';
    } else {
      myP.forEach(function(p) {
        var img = (p.images || [])[0] || 'https://placehold.co/60x60/111/444?text=?';
        h += '<div class="list-item"><img class="list-item-img" src="' + esc(img) + '" onerror="this.src=\'https://placehold.co/60x60/111/444?text=?\'">';
        h += '<div class="list-item-info"><div class="list-item-title">' + esc(p.title) + '</div><div class="list-item-sub">' + fmt(p.price) + ' · ' + p.stock + ' est · ' + (p.sold || 0) + ' vendidos</div></div>';
        h += '<div style="display:flex;gap:6px;flex-shrink:0">';
        h += '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();go(\'edit-product\',{id:\'' + p.id + '\'})">✏️</button>';
        h += '<button class="btn btn-sm" style="background:none;border:1px solid var(--danger);color:var(--danger)" onclick="event.stopPropagation();delProduct(\'' + p.id + '\')">🗑</button>';
        h += '</div></div>';
      });
    }
    h += '</div>';
    el.innerHTML = h;
  });
}
function delProduct(id) {
  if (!confirm('Excluir este produto?')) return;
  api('POST', '/product/delete', { id: id, sellerId: state.user.id }).then(function() {
    toast('Produto excluído', 'info');
    render();
  });
}

// ===== ADD PRODUCT =====
function renderAddProduct(el) {
  if (!state.user || !state.user.isseller) { go('home'); return; }
  state.uploaded = [];
  var h = '<div class="container" style="max-width:680px">';
  h += '<button class="btn btn-outline btn-sm" style="margin-bottom:14px" onclick="go(\'seller-products\')">← Voltar</button>';
  h += '<h2 class="section-title">ANUNCIAR PRODUTO</h2>';
  h += '<div class="form-group"><label>Título *</label><input class="form-control" id="p-title" placeholder="Nome do produto" maxlength="100"></div>';
  h += '<div class="form-group"><label>Descrição *</label><textarea class="form-control" id="p-desc" placeholder="Descreva seu produto..." style="min-height:100px"></textarea></div>';
  h += '<div class="two-col"><div class="form-group"><label>Preço (R$) *</label><input class="form-control" id="p-price" type="number" step="0.01" inputmode="decimal" placeholder="0,00"></div>';
  h += '<div class="form-group"><label>Preço original</label><input class="form-control" id="p-orig" type="number" step="0.01" inputmode="decimal" placeholder="opcional"></div></div>';
  h += '<div class="two-col"><div class="form-group"><label>Estoque *</label><input class="form-control" id="p-stock" type="number" inputmode="numeric" placeholder="1"></div>';
  h += '<div class="form-group"><label>Categoria *</label><select class="form-control" id="p-cat">';
  ['moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'].forEach(function(c) {
    h += '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>';
  });
  h += '</select></div></div>';
  h += '<div class="form-group"><label>Fotos</label>';
  h += '<label class="btn btn-outline btn-sm" for="p-file" style="cursor:pointer;display:inline-flex">📷 Enviar fotos</label>';
  h += '<input type="file" id="p-file" accept="image/*" multiple onchange="uploadImgs(event)" style="display:none">';
  h += '<div class="img-previews" id="p-prev"></div></div>';
  h += '<div class="form-group"><label>Ou cole URLs de imagens (uma por linha)</label><textarea class="form-control" id="p-imgs" placeholder="https://..." style="min-height:60px"></textarea></div>';
  h += '<button class="btn btn-primary btn-full" onclick="saveProd()">Publicar produto</button>';
  h += '</div>';
  el.innerHTML = h;
}
function uploadImgs(ev) {
  var files = Array.from(ev.target.files || []);
  if (!files.length) return;
  var prev = document.getElementById('p-prev');
  prev.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px">Enviando...</div>';
  var done = 0;
  files.forEach(function(file) {
    if (!file.type.startsWith('image/')) { done++; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      fetch('/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: e.target.result, type: file.type })
      }).then(function(r) { return r.json(); })
      .then(function(j) {
        if (j.url) {
          state.uploaded.push(j.url);
          var img = document.createElement('img');
          img.className = 'img-preview';
          img.src = j.url;
          var ld = prev.querySelector('div');
          if (ld) ld.remove();
          prev.appendChild(img);
        }
        done++;
        if (done === files.length) toast(state.uploaded.length + ' foto(s) enviada(s)', 'success');
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
  var urls = document.getElementById('p-imgs').value.split('\n').map(function(x) { return x.trim(); }).filter(Boolean);
  var imgs = state.uploaded.concat(urls);
  if (!title || !desc || !price || price <= 0 || !cat) { toast('Preencha todos os campos obrigatórios', 'error'); return; }
  if (stock < 1) { toast('Estoque deve ser maior que 0', 'error'); return; }
  if (imgs.length === 0) imgs = ['https://placehold.co/600x600/111/444?text=' + encodeURIComponent(title)];
  var prod = {
    id: editId || uid(),
    sellerId: state.user.id,
    title: title, description: desc, price: price,
    originalPrice: orig, stock: stock, category: cat, images: imgs
  };
  api('POST', editId ? '/product/update' : '/product/create', prod).then(function(r) {
    if (r.error) { toast(r.error, 'error'); return; }
    toast(editId ? 'Atualizado!' : 'Publicado!', 'success');
    state.uploaded = [];
    go('seller-products');
  });
}

// ===== EDIT PRODUCT =====
function renderEditProduct(el) {
  if (!state.user || !state.user.isseller) { go('home'); return; }
  state.uploaded = [];
  api('GET', '/products').then(function(data) {
    var p = (data.products || []).find(function(x) { return x.id === state.params.id; });
    if (!p) { el.innerHTML = '<div class="container"><div class="empty"><h3>Não encontrado</h3></div></div>'; return; }
    var h = '<div class="container" style="max-width:680px">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:14px" onclick="go(\'seller-products\')">← Voltar</button>';
    h += '<h2 class="section-title">EDITAR PRODUTO</h2>';
    h += '<div class="form-group"><label>Título *</label><input class="form-control" id="p-title" value="' + esc(p.title) + '"></div>';
    h += '<div class="form-group"><label>Descrição *</label><textarea class="form-control" id="p-desc" style="min-height:100px">' + esc(p.description || '') + '</textarea></div>';
    h += '<div class="two-col"><div class="form-group"><label>Preço *</label><input class="form-control" id="p-price" type="number" step="0.01" value="' + p.price + '"></div>';
    h += '<div class="form-group"><label>Original</label><input class="form-control" id="p-orig" type="number" step="0.01" value="' + (p.originalprice || '') + '"></div></div>';
    h += '<div class="two-col"><div class="form-group"><label>Estoque *</label><input class="form-control" id="p-stock" type="number" value="' + p.stock + '"></div>';
    h += '<div class="form-group"><label>Categoria *</label><select class="form-control" id="p-cat">';
    ['moda','eletronicos','acessorios','bolsas','beleza','casa','esporte'].forEach(function(c) {
      h += '<option value="' + c + '" ' + (p.category === c ? 'selected' : '') + '>' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>';
    });
    h += '</select></div></div>';
    h += '<div class="form-group"><label>Fotos atuais</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
    (p.images || []).forEach(function(u) {
      h += '<img src="' + esc(u) + '" class="img-preview">';
    });
    h += '</div></div>';
    h += '<div class="form-group"><label>Substituir por URLs (uma por linha)</label><textarea class="form-control" id="p-imgs" style="min-height:60px" placeholder="Deixe vazio para manter as atuais"></textarea></div>';
    h += '<div class="form-group"><label>Ou envie novas fotos</label><label class="btn btn-outline btn-sm" for="p-file" style="cursor:pointer;display:inline-flex">📷 Enviar</label><input type="file" id="p-file" accept="image/*" multiple onchange="uploadImgs(event)" style="display:none"><div class="img-previews" id="p-prev"></div></div>';
    h += '<button class="btn btn-primary btn-full" onclick="saveProdEdit(\'' + p.id + '\')">Salvar alterações</button>';
    h += '</div>';
    el.innerHTML = h;
    state.currentEditImages = p.images || [];
  });
}
function saveProdEdit(editId) {
  var title = document.getElementById('p-title').value.trim();
  var desc = document.getElementById('p-desc').value.trim();
  var price = parseFloat(document.getElementById('p-price').value);
  var orig = parseFloat(document.getElementById('p-orig').value) || null;
  var stock = parseInt(document.getElementById('p-stock').value) || 0;
  var cat = document.getElementById('p-cat').value;
  var urls = document.getElementById('p-imgs').value.split('\n').map(function(x) { return x.trim(); }).filter(Boolean);
  var imgs = state.uploaded.concat(urls);
  if (imgs.length === 0) imgs = state.currentEditImages || [];
  if (!title || !desc || !price || !cat) { toast('Preencha tudo', 'error'); return; }
  api('POST', '/product/update', {
    id: editId, sellerId: state.user.id,
    title: title, description: desc, price: price,
    originalPrice: orig, stock: stock, category: cat, images: imgs
  }).then(function() {
    toast('Atualizado!', 'success');
    state.uploaded = [];
    go('seller-products');
  });
}

// ===== COUPONS =====
function renderCoupons(el) {
  if (!state.user || !state.user.isseller) { go('home'); return; }
  api('GET', '/coupons?sellerId=' + state.user.id).then(function(data) {
    var coupons = data.coupons || [];
    var h = '<div class="container">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:14px" onclick="go(\'seller-dashboard\')">← Voltar</button>';
    h += '<h2 class="section-title">CUPONS</h2>';
    h += '<div class="panel">';
    h += '<h3 style="font-size:15px;font-weight:700;margin-bottom:14px">Criar novo cupom</h3>';
    h += '<div class="form-group"><label>Código *</label><input class="form-control" id="c-code" placeholder="DESCONTO10" style="text-transform:uppercase"></div>';
    h += '<div class="two-col"><div class="form-group"><label>Desconto % *</label><input class="form-control" id="c-disc" type="number" min="1" max="100" inputmode="numeric"></div>';
    h += '<div class="form-group"><label>Usos máx *</label><input class="form-control" id="c-uses" type="number" min="1" inputmode="numeric"></div></div>';
    h += '<div class="form-group"><label>Descrição</label><input class="form-control" id="c-desc" placeholder="10% na primeira compra"></div>';
    h += '<button class="btn btn-primary btn-full" onclick="mkCoupon()">Criar cupom</button></div>';
    if (coupons.length === 0) {
      h += '<div class="empty"><div class="empty-icon">🏷</div><h3>Nenhum cupom</h3></div>';
    } else {
      coupons.forEach(function(c) {
        h += '<div class="coupon-card"><div style="flex:1;min-width:0"><div class="coupon-code">' + esc(c.code) + '</div><div class="coupon-info">' + esc(c.description || '') + ' · ' + c.uses + '/' + c.maxuses + ' usos</div></div>';
        h += '<div class="coupon-pct">' + c.discount + '%</div>';
        h += '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">';
        h += '<span class="chip ' + (c.active ? 'chip-on' : 'chip-off') + '" style="text-align:center">' + (c.active ? 'Ativo' : 'Off') + '</span>';
        h += '<button class="btn btn-outline btn-sm" onclick="tglCoupon(\'' + c.id + '\',' + (c.active ? 'false' : 'true') + ')">' + (c.active ? 'Desativar' : 'Ativar') + '</button>';
        h += '<button class="btn btn-sm" style="background:none;border:1px solid var(--danger);color:var(--danger)" onclick="rmCoupon(\'' + c.id + '\')">Excluir</button>';
        h += '</div></div>';
      });
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
  if (!code || !disc || disc < 1 || disc > 100 || !uses || uses < 1) { toast('Preencha corretamente', 'error'); return; }
  api('POST', '/coupon/create', { id: uid(), sellerId: state.user.id, code: code, discount: disc, maxUses: uses, description: desc }).then(function(r) {
    if (r.error) { toast(r.error, 'error'); return; }
    toast('Cupom criado!', 'success');
    render();
  });
}
function tglCoupon(id, active) { api('POST', '/coupon/toggle', { id: id, active: active }).then(function() { render(); }); }
function rmCoupon(id) {
  if (!confirm('Excluir cupom?')) return;
  api('POST', '/coupon/delete', { id: id }).then(function() { toast('Excluído', 'info'); render(); });
}

// ===== PIX =====
function renderPix(el) {
  if (!state.user || !state.user.isseller) { go('home'); return; }
  var h = '<div class="container" style="max-width:500px">';
  h += '<button class="btn btn-outline btn-sm" style="margin-bottom:14px" onclick="go(\'seller-dashboard\')">← Voltar</button>';
  h += '<h2 class="section-title">CHAVE PIX</h2>';
  h += '<div class="pix-card">';
  h += '<p style="color:var(--text2);font-size:13px;margin-bottom:16px;line-height:1.5">Os pagamentos são recebidos via Mercado Pago. Sua chave PIX é apenas informativa.</p>';
  h += '<div class="form-group"><label>Chave PIX</label><input class="form-control" id="pix-key" value="' + esc(state.user.pixKey || '') + '" placeholder="CPF, email, telefone..."></div>';
  h += '<button class="btn btn-primary btn-full" onclick="savePix()">Salvar</button></div></div>';
  el.innerHTML = h;
}
function savePix() {
  var key = document.getElementById('pix-key').value.trim();
  api('POST', '/update-user', {
    userId: state.user.id,
    email: state.user.email, phone: state.user.phone,
    avatar: state.user.avatar, pixKey: key
  }).then(function(d) { if (d.success) { setUser(d.user); toast('Salvo!', 'success'); } });
}

// ===== ADMIN USERS =====
function renderUsers(el) {
  if (!state.user || !state.user.isadmin) { go('home'); return; }
  api('GET', '/users').then(function(data) {
    var users = (data.users || []).filter(function(u) { return !u.isadmin && u.id !== state.user.id; });
    var h = '<div class="container">';
    h += '<h2 class="section-title">GERENCIAR USUÁRIOS</h2>';
    h += '<p style="color:var(--text3);margin-bottom:14px;font-size:13px">Promova ou rebaixe vendedores</p>';
    h += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">';
    if (users.length === 0) h += '<div class="empty"><div class="empty-icon">👥</div><h3>Nenhum usuário</h3></div>';
    else users.forEach(function(u) {
      h += '<div class="user-row"><img src="' + esc(u.avatar) + '" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed=' + esc(u.username) + '\'">';
      h += '<div class="user-row-name"><div style="font-weight:600;font-size:14px">' + esc(u.username) + '</div><div style="font-size:11px;color:var(--text3)">' + esc(u.email || 'sem email') + '</div></div>';
      h += '<span class="role-badge ' + (u.isseller ? 'seller' : '') + '">' + (u.isseller ? 'Vendedor' : 'Comprador') + '</span>';
      h += '<button class="btn btn-outline btn-sm" onclick="promote(\'' + u.id + '\',' + (u.isseller ? 'false' : 'true') + ')">' + (u.isseller ? 'Rebaixar' : 'Promover') + '</button></div>';
    });
    h += '</div></div>';
    el.innerHTML = h;
  });
}
function promote(id, val) {
  api('POST', '/promote', { targetUserId: id, promote: val, requesterId: state.user.id }).then(function(d) {
    if (d.success) { toast(val ? 'Promovido a vendedor!' : 'Rebaixado', 'success'); render(); }
    else toast(d.error || 'Erro', 'error');
  });
}

// ===== ORDERS (BUYER) =====
function renderOrders(el) {
  if (!state.user) { showLogin(); return; }
  api('GET', '/orders?buyerId=' + state.user.id).then(function(data) {
    var orders = data.orders || [];
    var h = '<div class="container">';
    h += '<h2 class="section-title">MEUS PEDIDOS</h2>';
    if (orders.length === 0) {
      h += '<div class="empty"><div class="empty-icon">📦</div><h3>Nenhum pedido</h3><p>Suas compras aparecerão aqui</p><button class="btn btn-primary" onclick="go(\'home\')">Explorar produtos</button></div>';
    } else orders.forEach(function(o) {
      h += '<div class="list-item" onclick="go(\'tracking\',{id:\'' + o.id + '\'})">';
      h += '<div class="list-item-info"><div class="list-item-title">' + esc(o.producttitle || 'Pedido #' + o.id.slice(0, 8)) + '</div>';
      h += '<div class="list-item-sub">' + timeAgo(o.createdat) + '</div>';
      h += '<div class="list-item-price">' + fmt(o.total) + '</div></div>';
      h += '<span class="status-badge status-' + o.status + '">' + statusLabel(o.status) + '</span></div>';
    });
    h += '</div>';
    el.innerHTML = h;
  });
}

// ===== SALES (SELLER) =====
function renderSales(el) {
  if (!state.user || !state.user.isseller) { go('home'); return; }
  api('GET', '/orders?sellerId=' + state.user.id).then(function(data) {
    var orders = data.orders || [];
    var h = '<div class="container">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:14px" onclick="go(\'seller-dashboard\')">← Voltar</button>';
    h += '<h2 class="section-title">MINHAS VENDAS</h2>';
    if (orders.length === 0) {
      h += '<div class="empty"><div class="empty-icon">🧾</div><h3>Nenhuma venda ainda</h3></div>';
    } else orders.forEach(function(o) {
      h += '<div class="list-item" onclick="go(\'tracking\',{id:\'' + o.id + '\'})">';
      h += '<div class="list-item-info"><div class="list-item-title">' + esc(o.producttitle || '#' + o.id.slice(0, 8)) + '</div>';
      h += '<div class="list-item-sub">' + timeAgo(o.createdat) + ' · Qtd ' + o.quantity + '</div>';
      h += '<div class="list-item-price">' + fmt(o.total) + '</div></div>';
      h += '<span class="status-badge status-' + o.status + '">' + statusLabel(o.status) + '</span></div>';
    });
    h += '</div>';
    el.innerHTML = h;
  });
}

// ===== TRACKING =====
function renderTracking(el) {
  Promise.all([api('GET', '/orders'), api('GET', '/products')]).then(function(r) {
    var order = (r[0].orders || []).find(function(o) { return o.id === state.params.id; });
    if (!order) { el.innerHTML = '<div class="container"><div class="empty"><h3>Pedido não encontrado</h3></div></div>'; return; }
    var isSeller = state.user && state.user.id === order.sellerid;
    var isBuyer = state.user && state.user.id === order.buyerid;
    if (!isSeller && !isBuyer) { el.innerHTML = '<div class="container"><div class="empty"><h3>Sem permissão</h3></div></div>'; return; }
    var addr = order.address || {};
    var h = '<div class="container" style="max-width:720px">';
    h += '<button class="btn btn-outline btn-sm" style="margin-bottom:14px" onclick="history.back()">← Voltar</button>';
    h += '<div class="panel">';
    h += '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
    h += '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:15px">' + esc(order.producttitle || 'Produto') + '</div>';
    h += '<div style="font-size:12px;color:var(--text3);margin-top:3px">Pedido #' + order.id.slice(0, 8) + ' · ' + timeAgo(order.createdat) + '</div>';
    h += '<div style="margin-top:8px"><span class="status-badge status-' + order.status + '">' + statusLabel(order.status) + '</span></div></div>';
    h += '<div style="font-family:\'Space Mono\',monospace;font-size:20px;font-weight:700">' + fmt(order.total) + '</div></div></div>';
    h += '<div class="panel"><h3 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text2)">📍 DADOS DE ENTREGA</h3>';
    h += '<div style="font-size:13px;line-height:1.7;color:var(--text2)">';
    h += '<div><strong style="color:var(--text)">' + esc(addr.name || '-') + '</strong></div>';
    h += '<div>📞 ' + esc(addr.phone || '-') + '</div>';
    h += '<div>🏠 ' + esc(addr.street || '') + ', ' + esc(addr.num || '') + (addr.neigh ? ' - ' + esc(addr.neigh) : '') + '</div>';
    h += '<div>' + esc(addr.city || '') + '/' + esc(addr.state || '') + (addr.zip ? ' - CEP ' + esc(addr.zip) : '') + '</div>';
    h += '</div></div>';
    h += '<div class="panel"><h3 style="font-size:13px;font-weight:700;margin-bottom:14px;color:var(--text2)">📦 RASTREAMENTO</h3>';
    var tracking = order.tracking || [];
    if (tracking.length === 0) h += '<p style="color:var(--text3);font-size:13px">Aguardando atualizações</p>';
    else {
      h += '<div class="track-steps">';
      tracking.slice().reverse().forEach(function(t) {
        h += '<div class="track-step"><div class="track-dot"></div><div><div style="font-weight:600;font-size:13px">' + esc(t.status) + '</div><div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(t.location || '') + ' · ' + timeAgo(t.date) + '</div></div></div>';
      });
      h += '</div>';
    }
    if (isSeller && (order.status === 'paid' || order.status === 'processing' || order.status === 'shipped')) {
      h += '<div class="divider"></div>';
      h += '<h3 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text2)">ATUALIZAR RASTREAMENTO</h3>';
      h += '<div class="form-group"><label>Status do pedido</label><select class="form-control" id="t-status">';
      h += '<option value="processing">Em preparação</option>';
      h += '<option value="shipped">Enviado</option>';
      h += '<option value="delivered">Entregue</option>';
      h += '</select></div>';
      h += '<div class="form-group"><label>Localização</label><input class="form-control" id="t-loc" placeholder="Ex: Centro de Triagem SP"></div>';
      h += '<div class="form-group"><label>Descrição</label><input class="form-control" id="t-desc" placeholder="Ex: Saiu para entrega"></div>';
      h += '<button class="btn btn-primary btn-full" onclick="updTrack(\'' + order.id + '\')">Atualizar</button>';
    }
    h += '</div></div>';
    el.innerHTML = h;
  });
}
function updTrack(orderId) {
  var status = document.getElementById('t-status').value;
  var loc = document.getElementById('t-loc').value.trim() || '-';
  var desc = document.getElementById('t-desc').value.trim() || statusLabel(status);
  api('GET', '/orders').then(function(data) {
    var order = (data.orders || []).find(function(o) { return o.id === orderId; });
    if (!order) return;
    var tracking = order.tracking || [];
    tracking.push({ status: desc, location: loc, date: new Date().toISOString() });
    api('POST', '/order/update-tracking', { id: orderId, status: status, tracking: tracking, sellerId: state.user.id }).then(function(r) {
      if (r.error) { toast(r.error, 'error'); return; }
      toast('Rastreamento atualizado!', 'success');
      render();
    });
  });
}

// ===== NOTIFICATIONS =====
function renderNotifications(el) {
  if (!state.user) { showLogin(); return; }
  api('GET', '/notifications?userId=' + state.user.id).then(function(data) {
    var notifs = data.notifs || [];
    state.unreadCount = 0;
    var b = document.getElementById('notif-badge');
    if (b) b.style.display = 'none';
    var h = '<div class="container" style="max-width:720px">';
    h += '<h2 class="section-title">NOTIFICAÇÕES</h2>';
    h += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">';
    if (notifs.length === 0) h += '<div class="empty"><div class="empty-icon">🔔</div><h3>Nenhuma notificação</h3><p>Você verá aqui quando alguém comprar ou enviar</p></div>';
    else notifs.forEach(function(n) {
      var onClick = n.orderid ? 'go(\'tracking\',{id:\'' + n.orderid + '\'})' : '';
      h += '<div class="notif-item" onclick="' + onClick + '">';
      h += '<div class="notif-dot ' + (n.read ? '' : 'unread') + '"></div>';
      h += '<div style="flex:1;min-width:0"><div class="notif-message">' + esc(n.message) + '</div>';
      h += '<div style="font-size:11px;color:var(--text3);margin-top:6px">' + timeAgo(n.createdat) + '</div></div></div>';
    });
    h += '</div></div>';
    el.innerHTML = h;
  });
}

// ===== CHAT LIST =====
function renderChatsList(el) {
  if (!state.user) { showLogin(); return; }
  // Busca todas as conversas via endpoints: precisamos de uma rota simples.
  // Como não temos rota dedicada, listamos pelas salas do usuário via filtro local simples.
  api('GET', '/orders').then(function(orders) {
    // Alternativa: mostrar quem já conversamos - vamos criar uma rota no backend
    fetch(API + '/chat/rooms?userId=' + state.user.id)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var rooms = data.rooms || [];
        var h = '<div class="container">';
        h += '<h2 class="section-title">CONVERSAS</h2>';
        if (rooms.length === 0) {
          h += '<div class="empty"><div class="empty-icon">💬</div><h3>Nenhuma conversa</h3><p>Abra um produto e clique em "Falar com vendedor"</p></div>';
        } else rooms.forEach(function(r) {
          h += '<div class="chat-list-item" onclick="openExistingChat(\'' + r.otherId + '\',\'' + esc(r.otherName).replace(/'/g, '') + '\')">';
          h += '<img src="' + esc(r.otherAvatar) + '" onerror="this.src=\'https://api.dicebear.com/7.x/initials/svg?seed=' + esc(r.otherName) + '\'">';
          h += '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">' + esc(r.otherName) + '</div>';
          h += '<div style="font-size:12px;color:var(--text3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.lastMessage || 'Sem mensagens') + '</div></div>';
          h += '<div style="font-size:11px;color:var(--text3);flex-shrink:0">' + (r.lastDate ? timeAgo(r.lastDate) : '') + '</div></div>';
        });
        h += '</div>';
        el.innerHTML = h;
      })
      .catch(function() {
        el.innerHTML = '<div class="container"><div class="empty"><h3>Erro ao carregar conversas</h3></div></div>';
      });
  });
}
function openExistingChat(userId, name) {
  state.params = { otherUserId: userId, otherName: name };
  go('chat');
}

// ===== CHAT ROOM =====
function renderChat(el) {
  if (!state.user) { showLogin(); return; }
  var otherId = state.params.otherUserId;
  if (!otherId) { go('chats'); return; }
  var h = '<div class="container" style="max-width:720px;padding-bottom:0">';
  h += '<button class="btn btn-outline btn-sm" style="margin-bottom:12px" onclick="go(\'chats\')">← Voltar</button>';
  h += '<div class="chat-box"><div class="chat-msgs" id="chat-msgs"><div class="loading"><div class="spinner"></div>Abrindo...</div></div>';
  h += '<div class="chat-input-row"><input class="form-control" id="chat-in" placeholder="Mensagem..." autocomplete="off" onkeydown="if(event.key===\'Enter\')sendMsg()"><button class="btn btn-primary" onclick="sendMsg()">➤</button></div></div>';
  h += '</div>';
  el.innerHTML = h;
  state.chatSocketRoom = null;
  // Abre a sala
  setTimeout(function() {
    wsSend({ type: 'chat_open', userId: state.user.id, otherUserId: otherId, productContext: state.params.ctx });
  }, 200);
}
function renderChatMessages(roomId, messages) {
  state.chatSocketRoom = roomId;
  var c = document.getElementById('chat-msgs');
  if (!c) return;
  var h = '';
  (messages || []).forEach(function(m) {
    var mine = state.user && m.senderid === state.user.id;
    var sys = m.senderid === '__system__';
    if (sys) {
      h += '<div class="chat-system">' + esc(m.text) + '</div>';
    } else {
      h += '<div class="chat-msg ' + (mine ? 'right' : 'left') + '"><div class="chat-bubble">' + esc(m.text) + '</div><div class="chat-time">' + timeAgo(m.createdat) + '</div></div>';
    }
  });
  if (!messages || messages.length === 0) h = '<div class="chat-system">Inicie a conversa</div>';
  c.innerHTML = h;
  c.scrollTop = c.scrollHeight;
}
function appendChatMsg(m) {
  var c = document.getElementById('chat-msgs');
  if (!c) return;
  if (m.roomId !== state.chatSocketRoom) return;
  var mine = state.user && m.senderId === state.user.id;
  var div = document.createElement('div');
  div.className = 'chat-msg ' + (mine ? 'right' : 'left');
  div.innerHTML = '<div class="chat-bubble">' + esc(m.text) + '</div><div class="chat-time">' + timeAgo(m.createdAt) + '</div>';
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}
function sendMsg() {
  var input = document.getElementById('chat-in');
  if (!input) return;
  var text = input.value.trim();
  if (!text || !state.chatSocketRoom) return;
  var ok = wsSend({ type: 'chat_message', roomId: state.chatSocketRoom, senderId: state.user.id, text: text });
  if (!ok) { toast('Conectando...', 'warning'); return; }
  input.value = '';
  input.focus();
}

// ===== INIT =====
function init() {
  var saved = localStorage.getItem('redzin_user');
  if (saved) {
    try { state.user = JSON.parse(saved); } catch(e) {}
  }
  var btn = document.getElementById('user-btn');
  if (btn) btn.addEventListener('click', function(e) { e.stopPropagation(); toggleMenu(); });
  document.addEventListener('click', function(e) {
    var dd = document.getElementById('dropdown');
    var btn2 = document.getElementById('user-btn');
    if (dd && dd.classList.contains('show') && !dd.contains(e.target) && e.target !== btn2) {
      closeDropdown();
    }
  });
  connectWS();
  render();
  updateBtn();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
