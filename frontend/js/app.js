/* ===== CONFIG ===== */
const API = 'http://localhost:5000/api';
let chatHistory = [];
let allRecords = [];

/* ===== UTILS ===== */
function $(id) { return document.getElementById(id); }
function escHtml(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function markdownBold(text) { return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); }

/* ===== STATUS CHECK ===== */
async function checkStatus() {
  try {
    const res = await fetch(`${API}/data`);
    if (res.ok) {
      $('statusDot').className = 'status-dot online';
      $('statusText').textContent = 'Online';
    }
  } catch {
    $('statusDot').className = 'status-dot error';
    $('statusText').textContent = 'Offline';
  }
}

/* ===== DATA TABLE ===== */
async function loadTable(params = {}) {
  const container = $('tableContainer');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API}/data${qs ? '?' + qs : ''}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    allRecords = json.data;
    $('recordCount').textContent = `${json.count} record${json.count !== 1 ? 's' : ''}`;
    renderTable(allRecords);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>⚠ ${err.message}</p></div>`;
  }
}

function renderTable(records) {
  const container = $('tableContainer');
  if (!records.length) {
    container.innerHTML = '<div class="empty-state"><p>No records found</p></div>';
    return;
  }
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${records.map(r => `
          <tr>
            <td><span class="id-chip">${r.id}</span></td>
            <td>${escHtml(r.name)}</td>
            <td>${escHtml(r.phone)}</td>
            <td>${escHtml(r.email)}</td>
            <td>${escHtml(r.address)}</td>
            <td>
              <div class="table-actions">
                <button class="btn-edit" onclick="openEdit(${r.id})">Edit</button>
                <button class="btn-delete" onclick="confirmDelete(${r.id}, '${escHtml(r.name)}')">Del</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ===== SEARCH & FILTER ===== */
$('globalSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { renderTable(allRecords); return; }
  renderTable(allRecords.filter(r =>
    Object.values(r).some(v => v && v.toString().toLowerCase().includes(q))
  ));
});

$('applyFilter').addEventListener('click', () => {
  const field = $('filterField').value;
  const value = $('filterValue').value.trim();
  if (!value) return;
  loadTable(field ? { [field]: value } : { search: value });
});

$('clearFilter').addEventListener('click', () => {
  $('filterField').value = '';
  $('filterValue').value = '';
  loadTable();
});

$('filterValue').addEventListener('keypress', e => { if (e.key === 'Enter') $('applyFilter').click(); });
$('refreshBtn').addEventListener('click', loadTable);

/* ===== COLLAPSIBLE ADD FORM ===== */
let addFormOpen = true;
$('addSectionToggle').addEventListener('click', () => {
  addFormOpen = !addFormOpen;
  $('addFormBody').classList.toggle('collapsed', !addFormOpen);
  $('collapseArrow').classList.toggle('up', addFormOpen);
});

/* ===== EDIT MODAL ===== */
function openEdit(id) {
  const record = allRecords.find(r => String(r.id) === String(id));
  if (!record) return;
  $('editId').value = record.id;
  $('editName').value = record.name || '';
  $('editPhone').value = record.phone || '';
  $('editEmail').value = record.email || '';
  $('editAddress').value = record.address || '';
  $('modalOverlay').classList.add('open');
}

function closeModal() { $('modalOverlay').classList.remove('open'); }
$('modalClose').addEventListener('click', closeModal);
$('cancelEdit').addEventListener('click', closeModal);
$('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) closeModal(); });

$('saveEdit').addEventListener('click', async () => {
  const id = $('editId').value;
  const btn = $('saveEdit');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const res = await fetch(`${API}/data/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: $('editName').value, phone: $('editPhone').value,
        email: $('editEmail').value, address: $('editAddress').value
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    closeModal();
    loadTable();
  } catch (err) {
    alert('Update failed: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
});

/* ===== DELETE ===== */
async function confirmDelete(id, name) {
  if (!confirm(`Delete record for "${name}"?`)) return;
  try {
    const res = await fetch(`${API}/data/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    loadTable();
  } catch (err) { alert('Delete failed: ' + err.message); }
}

/* ===== ADD RECORD ===== */
$('submitAdd').addEventListener('click', async () => {
  const name = $('addName').value.trim();
  const resultEl = $('addResult');
  resultEl.className = 'form-result';
  if (!name) { resultEl.textContent = 'Please enter a name.'; resultEl.className = 'form-result error'; return; }
  const btn = $('submitAdd');
  btn.disabled = true; btn.textContent = 'Adding...';
  try {
    const res = await fetch(`${API}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone: $('addPhone').value.trim(), email: $('addEmail').value.trim(), address: $('addAddress').value.trim() })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    resultEl.textContent = `✅ ${json.message}`;
    resultEl.className = 'form-result success';
    $('addName').value = ''; $('addPhone').value = ''; $('addEmail').value = ''; $('addAddress').value = '';
    loadTable();
    setTimeout(() => { resultEl.className = 'form-result'; }, 3000);
  } catch (err) {
    resultEl.textContent = `❌ ${err.message}`;
    resultEl.className = 'form-result error';
  } finally {
    btn.disabled = false; btn.textContent = '✦ Add Record';
  }
});

/* ===== CLEAR CHAT ===== */
$('clearChatBtn').addEventListener('click', () => {
  chatHistory = [];
  $('chatMessages').innerHTML = `
    <div class="chat-msg bot">
      <div class="msg-avatar">◈</div>
      <div class="msg-bubble"><p>Chat cleared. How can I help you?</p></div>
    </div>
  `;
});

/* ===== CHAT ===== */
function fillChat(btn) {
  $('chatInput').value = btn.textContent.trim();
  $('chatInput').focus();
}

$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
$('sendBtn').addEventListener('click', sendChat);

$('chatInput').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

function addChatMsg(role, html) {
  const msgs = $('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'bot' ? '◈' : '✦'}</div>
    <div class="msg-bubble">${html}</div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function buildMiniTable(records) {
  if (!records || !records.length) return '';
  return `
    <table class="mini-table">
      <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th></tr></thead>
      <tbody>
        ${records.map(r => `
          <tr>
            <td>${r.id}</td>
            <td>${escHtml(r.name)}</td>
            <td>${escHtml(r.phone)}</td>
            <td>${escHtml(r.email)}</td>
            <td>${escHtml(r.address)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function buildResultHtml(result) {
  if (!result) return '<p>Done.</p>';
  let html = '';
  const msg = markdownBold(result.message || '');

  if (result.type === 'error') {
    html += `<span class="result-badge error">✕ Error</span><p>${msg}</p>`;
  } else if (result.type === 'created') {
    html += `<span class="result-badge success">✓ Created</span><p>${msg}</p>`;
    if (result.record) html += buildMiniTable([result.record]);
  } else if (result.type === 'updated') {
    html += `<span class="result-badge success">✓ Updated</span><p>${msg}</p>`;
    if (result.record) html += buildMiniTable([result.record]);
  } else if (result.type === 'deleted') {
    html += `<span class="result-badge success">🗑 Deleted</span><p>${msg}</p>`;
  } else if (result.type === 'records') {
    html += `<span class="result-badge success">📋 Results</span><p>${msg}</p>`;
    if (result.records && result.records.length > 0) html += buildMiniTable(result.records);
  } else if (result.type === 'ambiguous') {
    html += `<span class="result-badge warn">⚠ Multiple matches</span><p>${msg}</p>`;
    if (result.records) html += buildMiniTable(result.records);
    if (result.updates) html += `<p style="margin-top:0.5rem;font-size:0.68rem;color:var(--text3)">Tell me the ID to update with: ${JSON.stringify(result.updates)}</p>`;
  } else {
    html += `<p>${msg}</p>`;
  }
  return html;
}

async function sendChat() {
  const input = $('chatInput');
  const message = input.value.trim();
  if (!message) return;
  const sendBtn = $('sendBtn');
  sendBtn.disabled = true;
  input.value = ''; input.style.height = 'auto';

  addChatMsg('user', `<p>${escHtml(message)}</p>`);
  const thinkingDiv = addChatMsg('bot', '<p class="thinking-msg">Thinking<span class="dots-anim"></span></p>');
  chatHistory.push({ role: 'user', content: message });

  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory.slice(-6) })
    });
    const json = await res.json();
    thinkingDiv.remove();

    if (!json.success) {
      addChatMsg('bot', `<span class="result-badge error">✕ Error</span><p>${escHtml(json.message)}</p>`);
      return;
    }

    const modeTag = json.usedAI
      ? `<span class="ai-mode-tag ai">◈ AI</span>`
      : `<span class="ai-mode-tag fallback" title="${escHtml(json.aiError || '')}">⚡ Smart Parse</span>`;

    addChatMsg('bot', modeTag + buildResultHtml(json.result));
    chatHistory.push({ role: 'assistant', content: json.result?.message || 'Done.' });

    if (['created', 'updated', 'deleted'].includes(json.result?.type)) {
      loadTable();
    }
  } catch (err) {
    thinkingDiv.remove();
    addChatMsg('bot', `<span class="result-badge error">✕ Connection Error</span><p>Could not reach the server. Make sure the backend is running.</p>`);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

/* ===== INIT ===== */
checkStatus();
loadTable();
