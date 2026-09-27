// ============================================
// Made By '@«« S H A D O W »»' on Discord
// HQL_Book - Main Script
// ============================================

const DB_NAME = 'HQL_BookDB';
const DB_VERSION = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

let db = null;
let currentUser = null;
let currentChatUser = null;
let pendingAttachment = null;
let allUsers = [];
let allPosts = [];
let allMessages = [];
let allFriends = [];

// ===== DATABASE =====
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      ['users', 'posts', 'messages', 'friends'].forEach(store => {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        }
      });
      if (!database.objectStoreNames.contains('me')) {
        database.createObjectStore('me', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbAdd(store, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbClear(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===== INIT =====
async function init() {
  try {
    db = await openDB();
    
    let me = await dbGet('me', 'current');
    if (!me) {
      me = {
        id: 'current',
        name: 'Người dùng ' + Math.floor(Math.random()*1000),
        bio: '',
        avatar: null,
        username: 'user' + Date.now().toString(36).slice(-5),
        createdAt: new Date().toISOString()
      };
      await dbPut('me', me);
    }
    currentUser = me;
    
    allUsers = await dbGetAll('users');
    if (allUsers.length === 0) {
      const demoUsers = [
        { name: 'Nguyễn Văn A', username: 'vana', bio: 'Yêu công nghệ', avatar: null, isDemo: true, online: true },
        { name: 'Trần Thị B', username: 'thib', bio: 'Thích du lịch', avatar: null, isDemo: true, online: true },
        { name: 'Lê Văn C', username: 'vanc', bio: 'Gamer', avatar: null, isDemo: true, online: false },
        { name: 'Phạm Thị D', username: 'thid', bio: 'Ca sĩ nghiệp dư', avatar: null, isDemo: true, online: true },
        { name: 'Hoàng Văn E', username: 'vane', bio: 'Lập trình viên', avatar: null, isDemo: true, online: false }
      ];
      for (const u of demoUsers) await dbAdd('users', u);
      allUsers = await dbGetAll('users');
    }
    
    updateMyAvatar();
    await loadAll();
    await renderAll();
    updatePostButtonState();
    
    console.log('✅ HQL_Book ready. Users:', allUsers.length);
  } catch (err) {
    console.error('❌ Init error:', err);
    showToast('Lỗi: ' + err.message, true);
  }
}

async function loadAll() {
  allPosts = await dbGetAll('posts');
  allMessages = await dbGetAll('messages');
  allFriends = await dbGetAll('friends');
  allUsers = await dbGetAll('users');
}

async function renderAll() {
  renderPosts();
  renderFriends();
  renderContacts();
  updateBadges();
}

// ===== HELPERS =====
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.className = 'toast' + (isError ? ' error' : ''), 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function getInitial(name) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

function formatTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return Math.floor(diff/60) + ' phút trước';
  if (diff < 86400) return Math.floor(diff/3600) + ' giờ trước';
  if (diff < 604800) return Math.floor(diff/86400) + ' ngày trước';
  return d.toLocaleDateString('vi-VN');
}

function formatMsgTime(iso) {
  const d = new Date(iso);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

function fileIcon(type) {
  if (!type) return '📎';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎥';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📕';
  if (type.includes('zip') || type.includes('rar')) return '🗜️';
  return '📎';
}

function isFriend(userId) {
  return allFriends.some(f => f.userId === userId);
}

function getFriendIds() {
  return allFriends.map(f => f.userId);
}

// ===== AVATAR =====
function updateMyAvatar() {
  const els = [
    document.getElementById('myAvatar'),
    document.getElementById('composerAvatar'),
    document.getElementById('profileAvatar')
  ];
  els.forEach(node => {
    if (!node) return;
    if (currentUser.avatar) {
      node.innerHTML = `<img src="${currentUser.avatar}">`;
    } else {
      node.textContent = getInitial(currentUser.name);
    }
  });
}

function renderAvatarHtml(user) {
  if (user.avatar) return `<img src="${user.avatar}">`;
  return getInitial(user.name);
}

// ===== POSTS =====
async function createPost() {
  const content = document.getElementById('postInput').value.trim();
  if (!content && !pendingAttachment) return;
  
  const post = {
    authorId: 'me',
    authorName: currentUser.name,
    authorAvatar: currentUser.avatar,
    content: content,
    attachment: pendingAttachment ? { ...pendingAttachment } : null,
    likes: 0,
    liked: false,
    comments: [],
    createdAt: new Date().toISOString()
  };
  
  try {
    await dbAdd('posts', post);
    document.getElementById('postInput').value = '';
    removeAttachment();
    showToast('✅ Đã đăng bài viết!');
    await loadAll();
    renderPosts();
    updatePostButtonState();
  } catch (err) {
    console.error(err);
    showToast('Lỗi đăng bài: ' + err.message, true);
  }
}

function updatePostButtonState() {
  const content = document.getElementById('postInput').value.trim();
  const btn = document.getElementById('postBtn');
  if (btn) btn.disabled = !content && !pendingAttachment;
}

// ===== ATTACHMENT =====
function handleAttachment(file, callback) {
  if (file.size > MAX_FILE_SIZE) {
    showToast('File quá lớn! Tối đa ' + (MAX_FILE_SIZE/(1024*1024)) + 'MB', true);
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    callback({
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
      name: file.name,
      size: file.size,
      mimeType: file.type,
      data: ev.target.result
    });
  };
  reader.onerror = () => showToast('Lỗi đọc file', true);
  reader.readAsDataURL(file);
}

function renderAttachmentPreview() {
  const preview = document.getElementById('attachPreview');
  const content = document.getElementById('attachContent');
  if (!preview || !content) return;
  
  if (!pendingAttachment) {
    preview.classList.remove('show');
    return;
  }
  
  preview.classList.add('show');
  if (pendingAttachment.type === 'image') {
    content.innerHTML = `<img src="${pendingAttachment.data}">`;
  } else if (pendingAttachment.type === 'video') {
    content.innerHTML = `<video src="${pendingAttachment.data}" controls></video>`;
  } else {
    content.innerHTML = `
      <div class="attachment-info">
        <div style="font-size:30px">${fileIcon(pendingAttachment.mimeType)}</div>
        <div>
          <div style="font-weight:bold">${escapeHtml(pendingAttachment.name)}</div>
          <div style="font-size:0.85em;color:#888">${formatSize(pendingAttachment.size)}</div>
        </div>
      </div>
    `;
  }
}

function removeAttachment() {
  pendingAttachment = null;
  ['postImageInput', 'postVideoInput', 'postFileInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderAttachmentPreview();
  updatePostButtonState();
}

function renderPosts() {
  const container = document.getElementById('postsContainer');
  const empty = document.getElementById('emptyFeed');
  if (!container) return;
  
  if (allPosts.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  const sorted = [...allPosts].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  container.innerHTML = sorted.map(p => {
    let mediaHtml = '';
    if (p.attachment) {
      const a = p.attachment;
      if (a.type === 'image') {
        mediaHtml = `<img class="post-media" src="${a.data}" onclick="openFullImage('${a.data}')">`;
      } else if (a.type === 'video') {
        mediaHtml = `<video class="post-media" src="${a.data}" controls></video>`;
      } else {
        mediaHtml = `
          <div class="post-file" onclick="downloadFile('${a.data}', '${escapeHtml(a.name)}')">
            <div class="post-file-icon">${fileIcon(a.mimeType)}</div>
            <div>
              <div style="font-weight:bold">${escapeHtml(a.name)}</div>
              <div style="font-size:0.85em;color:#888">${formatSize(a.size)} · Click để tải</div>
            </div>
          </div>
        `;
      }
    }
    
    const avatarHtml = p.authorAvatar 
      ? `<img src="${p.authorAvatar}">` 
      : getInitial(p.authorName);
    
    return `
      <div class="post" data-id="${p.id}">
        <div class="post-header">
          <div class="avatar">${avatarHtml}</div>
          <div class="post-info">
            <div class="post-author">${escapeHtml(p.authorName)}</div>
            <div class="post-time">${formatTime(p.createdAt)}</div>
          </div>
          <button class="post-menu" onclick="deletePost(${p.id})">🗑</button>
        </div>
        ${p.content ? `<div class="post-content">${escapeHtml(p.content)}</div>` : ''}
        ${mediaHtml}
        <div class="post-stats">
          <span>❤️ ${p.likes || 0} lượt thích</span>
        </div>
        <div class="post-actions">
          <button class="post-action ${p.liked ? 'liked' : ''}" onclick="likePost(${p.id})">
            ${p.liked ? '❤️' : '🤍'} Thích
          </button>
          <button class="post-action" onclick="downloadPost(${p.id})">⬇️ Tải</button>
        </div>
      </div>
    `;
  }).join('');
}

async function likePost(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  post.liked = !post.liked;
  post.likes = (post.likes || 0) + (post.liked ? 1 : -1);
  if (post.likes < 0) post.likes = 0;
  await dbPut('posts', post);
  await loadAll();
  renderPosts();
}

async function deletePost(id) {
  if (!confirm('Xóa bài viết này?')) return;
  await dbDelete('posts', id);
  showToast('🗑 Đã xóa bài viết');
  await loadAll();
  renderPosts();
}

function downloadPost(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post || !post.attachment) {
    showToast('Bài viết không có tệp đính kèm', true);
    return;
  }
  downloadFile(post.attachment.data, post.attachment.name);
}

function downloadFile(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function openFullImage(dataUrl) {
  const w = window.open('');
  w.document.write(`<body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${dataUrl}" style="max-width:100%;max-height:100%"></body>`);
}

// ===== FRIENDS =====
function openFriends() {
  const list = document.getElementById('friendsListModal');
  if (!list) return;
  const friendIds = getFriendIds();
  const friends = allUsers.filter(u => friendIds.includes(u.id));
  
  if (friends.length === 0) {
    list.innerHTML = '<p style="color:#888;text-align:center;padding:20px">Chưa có bạn bè. Hãy tìm và kết bạn!</p>';
  } else {
    list.innerHTML = friends.map(u => `
      <div class="user-result">
        <div class="contact-avatar">${renderAvatarHtml(u)}</div>
        <div>
          <div style="font-weight:bold">${escapeHtml(u.name)}</div>
          <div style="font-size:0.8em;color:#888">@${escapeHtml(u.username)}</div>
        </div>
        <button class="btn-add" onclick="openChatWith(${u.id});closeModal('friendsModal')">💬 Chat</button>
      </div>
    `).join('');
  }
  document.getElementById('friendsModal').classList.add('active');
}

function openSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
  searchUsers();
  document.getElementById('searchModal').classList.add('active');
  setTimeout(() => document.getElementById('searchInput').focus(), 100);
}

function searchUsers() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const results = document.getElementById('searchResults');
  if (!results) return;
  
  const filtered = allUsers.filter(u => 
    u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
  );
  
  if (filtered.length === 0) {
    results.innerHTML = '<p style="color:#888;text-align:center;padding:15px">Không tìm thấy</p>';
    return;
  }
  
  results.innerHTML = filtered.map(u => {
    const friend = isFriend(u.id);
    return `
      <div class="user-result">
        <div class="contact-avatar">${renderAvatarHtml(u)}</div>
        <div style="flex:1">
          <div style="font-weight:bold">${escapeHtml(u.name)}</div>
          <div style="font-size:0.8em;color:#888">@${escapeHtml(u.username)} · ${escapeHtml(u.bio || '')}</div>
        </div>
        ${friend 
          ? `<button class="btn-add" style="background:#31a24c" onclick="openChatWith(${u.id});closeModal('searchModal')">💬 Chat</button>`
          : `<button class="btn-add" onclick="addFriend(${u.id})">+ Kết bạn</button>`
        }
      </div>
    `;
  }).join('');
}

async function addFriend(userId) {
  if (isFriend(userId)) {
    showToast('Đã là bạn bè rồi!', true);
    return;
  }
  const u = allUsers.find(x => x.id === userId);
  if (!u) return;
  await dbAdd('friends', { userId, name: u.name, addedAt: new Date().toISOString() });
  showToast('✅ Đã kết bạn với ' + u.name);
  await loadAll();
  await renderAll();
  searchUsers();
}

function renderFriends() {
  const sidebar = document.getElementById('friendsListSidebar');
  if (!sidebar) return;
  const friendIds = getFriendIds();
  const friends = allUsers.filter(u => friendIds.includes(u.id));
  
  if (friends.length === 0) {
    sidebar.innerHTML = '<p style="padding:10px 15px;color:#888;font-size:0.85em">Chưa có bạn bè</p>';
    return;
  }
  
  sidebar.innerHTML = friends.map(u => `
    <div class="contact" onclick="openChatWith(${u.id})">
      <div class="contact-avatar">
        ${renderAvatarHtml(u)}
        ${u.online ? '<div class="online-dot"></div>' : ''}
      </div>
      <div class="contact-name">${escapeHtml(u.name)}</div>
    </div>
  `).join('');
}

function renderContacts() {
  const list = document.getElementById('contactsList');
  if (!list) return;
  const friendIds = getFriendIds();
  const friends = allUsers.filter(u => friendIds.includes(u.id));
  
  if (friends.length === 0) {
    list.innerHTML = '<p style="padding:10px 15px;color:#888;font-size:0.85em">Kết bạn để chat</p>';
    return;
  }
  
  list.innerHTML = friends.map(u => {
    const lastMsg = [...allMessages]
      .filter(m => (m.fromId === u.id && m.toId === 'me') || (m.fromId === 'me' && m.toId === u.id))
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return `
      <div class="contact" onclick="openChatWith(${u.id})">
        <div class="contact-avatar">
          ${renderAvatarHtml(u)}
          ${u.online ? '<div class="online-dot"></div>' : ''}
        </div>
        <div style="flex:1;min-width:0">
          <div class="contact-name">${escapeHtml(u.name)}</div>
          ${lastMsg ? `<div style="font-size:0.75em;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(lastMsg.text || '📎 Tệp đính kèm')}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ===== CHAT =====
function toggleContacts() {
  const win = document.getElementById('chatWindow');
  if (!win) return;
  if (win.classList.contains('open')) {
    closeChat();
  } else {
    const friendIds = getFriendIds();
    if (friendIds.length === 0) {
      showToast('Kết bạn trước để chat!', true);
      openSearch();
      return;
    }
    openChatWith(friendIds[0]);
  }
}

function openChatWith(userId) {
  const u = allUsers.find(x => x.id === userId);
  if (!u) return;
  
  currentChatUser = u;
  document.getElementById('chatName').textContent = u.name;
  document.getElementById('chatStatus').textContent = u.online ? 'Đang hoạt động' : 'Offline';
  document.getElementById('chatAvatar').innerHTML = renderAvatarHtml(u);
  document.getElementById('chatWindow').classList.add('open');
  
  renderMessages();
  setTimeout(() => document.getElementById('chatInput').focus(), 100);
}

function closeChat() {
  document.getElementById('chatWindow').classList.remove('open');
  currentChatUser = null;
}

function renderMessages() {
  if (!currentChatUser) return;
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  const msgs = allMessages
    .filter(m => (m.fromId === 'me' && m.toId === currentChatUser.id) || 
                 (m.fromId === currentChatUser.id && m.toId === 'me'))
    .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  if (msgs.length === 0) {
    container.innerHTML = '<p style="color:#888;text-align:center;padding:20px;font-size:0.85em">Bắt đầu cuộc trò chuyện</p>';
    return;
  }
  
  container.innerHTML = msgs.map(m => {
    const mine = m.fromId === 'me';
    let content = '';
    
    if (m.text) content += `<div>${escapeHtml(m.text)}</div>`;
    
    if (m.attachment) {
      const a = m.attachment;
      if (a.type === 'image') {
        content += `<img src="${a.data}" onclick="openFullImage('${a.data}')">`;
      } else if (a.type === 'video') {
        content += `<video src="${a.data}" controls></video>`;
      } else {
        content += `<div class="message-file" onclick="downloadFile('${a.data}', '${escapeHtml(a.name)}')">
          <span style="font-size:20px">${fileIcon(a.mimeType)}</span>
          <span>${escapeHtml(a.name)}</span>
        </div>`;
      }
    }
    
    return `
      <div class="message ${mine ? 'me' : 'other'}">
        ${content}
        <div class="message-time">${formatMsgTime(m.createdAt)}</div>
      </div>
    `;
  }).join('');
  
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  if (!currentChatUser) {
    showToast('Chưa chọn người để chat!', true);
    return;
  }
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  
  if (!text && !pendingAttachment) return;
  
  const msg = {
    fromId: 'me',
    toId: currentChatUser.id,
    text: text,
    attachment: pendingAttachment ? { ...pendingAttachment } : null,
    createdAt: new Date().toISOString()
  };
  
  try {
    await dbAdd('messages', msg);
    input.value = '';
    pendingAttachment = null;
    renderAttachmentPreview();
    await loadAll();
    renderMessages();
    renderContacts();
    
    // Auto-reply
    const chatUser = currentChatUser;
    setTimeout(async () => {
      const replies = [
        'Ok bạn!', 'Hay quá!', 'Mình hiểu rồi', 'Để mình xem đã',
        '😄', 'Cảm ơn bạn nhé!', 'Nghe hay đấy', 'Vậy à?',
        'Mình cũng nghĩ vậy', '👍', 'Ok luôn', 'Tuyệt vời!'
      ];
      const reply = {
        fromId: chatUser.id,
        toId: 'me',
        text: replies[Math.floor(Math.random() * replies.length)],
        createdAt: new Date().toISOString()
      };
      await dbAdd('messages', reply);
      await loadAll();
      if (currentChatUser && currentChatUser.id === chatUser.id) {
        renderMessages();
      }
      renderContacts();
    }, 1000 + Math.random() * 2000);
  } catch (err) {
    console.error(err);
    showToast('Lỗi gửi tin nhắn: ' + err.message, true);
  }
}

// ===== PROFILE =====
function openProfile() {
  document.getElementById('profileNameInput').value = currentUser.name;
  document.getElementById('profileBioInput').value = currentUser.bio || '';
  document.getElementById('profileModal').classList.add('active');
}

async function saveProfile() {
  const name = document.getElementById('profileNameInput').value.trim();
  const bio = document.getElementById('profileBioInput').value.trim();
  const avatarFile = document.getElementById('profileAvatarInput').files[0];
  
  if (!name) {
    showToast('Tên không được để trống!', true);
    return;
  }
  
  currentUser.name = name;
  currentUser.bio = bio;
  
  const finalize = async () => {
    await dbPut('me', currentUser);
    updateMyAvatar();
    // Update my posts
    for (const p of allPosts.filter(x => x.authorId === 'me')) {
      p.authorName = name;
      p.authorAvatar = currentUser.avatar;
      await dbPut('posts', p);
    }
    await loadAll();
    renderAll();
    showToast('✅ Đã lưu hồ sơ!');
    closeModal('profileModal');
  };
  
  if (avatarFile) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      currentUser.avatar = e.target.result;
      await finalize();
    };
    reader.readAsDataURL(avatarFile);
  } else {
    await finalize();
  }
}

async function clearAllData() {
  if (!confirm('XÓA TOÀN BỘ DỮ LIỆU? Không thể hoàn tác!')) return;
  if (!confirm('Chắc chắn chưa?')) return;
  for (const store of ['posts', 'messages', 'friends', 'users', 'me']) {
    await dbClear(store);
  }
  showToast('🗑 Đã xóa. Đang tải lại...');
  setTimeout(() => location.reload(), 1000);
}

// ===== BADGES =====
function updateBadges() {
  const friendIds = getFriendIds();
  const fb = document.getElementById('friendBadge');
  const mb = document.getElementById('msgBadge');
  
  if (fb) {
    if (friendIds.length > 0) {
      fb.style.display = 'flex';
      fb.textContent = friendIds.length;
    } else fb.style.display = 'none';
  }
  
  if (mb) {
    const unread = allMessages.filter(m => m.toId === 'me' && !m.read).length;
    if (unread > 0) {
      mb.style.display = 'flex';
      mb.textContent = unread;
    } else mb.style.display = 'none';
  }
}

// ===== NAV =====
function showFeed() {
  closeChat();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== MODALS =====
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// ===== EVENT LISTENERS =====
function bindEvents() {
  // Post input
  const postInput = document.getElementById('postInput');
  if (postInput) {
    postInput.addEventListener('input', updatePostButtonState);
    postInput.addEventListener('keyup', updatePostButtonState);
  }
  
  // Post attachments
  ['postImageInput', 'postVideoInput', 'postFileInput'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      handleAttachment(file, (att) => {
        pendingAttachment = att;
        renderAttachmentPreview();
        updatePostButtonState();
      });
    });
  });
  
  // Chat attachments
  ['chatImageInput', 'chatVideoInput', 'chatFileInput'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !currentChatUser) return;
      handleAttachment(file, async (att) => {
        const msg = {
          fromId: 'me',
          toId: currentChatUser.id,
          text: '',
          attachment: att,
          createdAt: new Date().toISOString()
        };
        await dbAdd('messages', msg);
        await loadAll();
        renderMessages();
        renderContacts();
      });
    });
  });
  
  // Modal close on backdrop click
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('active');
    });
  });
  
  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
  });
}

// ===== START =====
window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  init();
});
