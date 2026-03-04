/* ===== CONFIG ===== */
const API = 'http://localhost:5000/api';
let chatHistory = [];
let allCustomers = [];
let currentDetailCustomerId = null;
let currentReportCustomerId = null;
let voiceLang = 'en-US';
let recognition = null;
let isRecording = false;

/* ===== UTILS ===== */
function $(id) { return document.getElementById(id); }
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function markdownBold(text) { return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); }
function formatCurrency(n) { return 'PKR ' + Number(n || 0).toLocaleString(); }
function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function currentMonthStr() { return new Date().toISOString().slice(0, 7); }

/* ===== STATUS CHECK ===== */
async function checkStatus() {
  try {
    const res = await fetch(`${API}/customers`);
    if (res.ok) {
      $('statusDot').className = 'status-dot online';
      $('statusText').textContent = 'Online';
    } else {
      throw new Error('Not OK');
    }
  } catch {
    $('statusDot').className = 'status-dot error';
    $('statusText').textContent = 'Offline';
  }
}

/* ===== CUSTOMER DASHBOARD ===== */
async function loadCustomers(search = '') {
  const list = $('customerList');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API}/customers${qs}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    allCustomers = json.data;
    $('customerCount').textContent = `${json.count} customer${json.count !== 1 ? 's' : ''}`;
    renderCustomerList(allCustomers);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>⚠ ${escHtml(err.message)}</p></div>`;
  }
}

function renderCustomerList(customers) {
  const list = $('customerList');
  if (!customers.length) {
    list.innerHTML = '<div class="empty-state"><p>No customers yet. Add one or use the chatbot!</p></div>';
    return;
  }
  list.innerHTML = customers.map(c => `
    <div class="customer-card" onclick="openCustomerDetail('${escHtml(c.id)}')" data-id="${escHtml(c.id)}">
      <div class="customer-card-left">
        <div class="customer-card-name">${escHtml(c.name)}</div>
        <div class="customer-card-meta">📞 ${escHtml(c.phone || '—')} ${c.extraInfo ? '· ' + escHtml(c.extraInfo) : ''}</div>
      </div>
      <div class="customer-card-right">
        <div class="customer-card-total">${formatCurrency(c.overallTotal)}</div>
        <div class="customer-card-last">${c.lastActivity ? 'Last: ' + c.lastActivity : 'No records'}</div>
      </div>
      <div class="customer-card-actions" onclick="event.stopPropagation()">
        <button class="btn-card-action btn-card-edit" onclick="openEditCustomerModal('${escHtml(c.id)}')">Edit</button>
        <button class="btn-card-action btn-card-delete" onclick="deleteCustomer('${escHtml(c.id)}', '${escHtml(c.name)}')">Del</button>
      </div>
    </div>
  `).join('');
}

/* ===== GLOBAL SEARCH ===== */
$('globalSearch').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  if (!q) { renderCustomerList(allCustomers); return; }
  const lower = q.toLowerCase();
  renderCustomerList(allCustomers.filter(c =>
    (c.name && c.name.toLowerCase().includes(lower)) ||
    (c.phone && c.phone.toLowerCase().includes(lower)) ||
    (c.extraInfo && c.extraInfo.toLowerCase().includes(lower))
  ));
});

$('refreshBtn').addEventListener('click', () => loadCustomers());

/* ===== ADD CUSTOMER MODAL ===== */
$('addCustomerBtn').addEventListener('click', () => {
  $('newCustomerName').value = '';
  $('newCustomerPhone').value = '';
  $('newCustomerExtra').value = '';
  $('addCustomerResult').className = 'form-result';
  $('addCustomerOverlay').classList.add('open');
  $('newCustomerName').focus();
});

function closeAddCustomer() { $('addCustomerOverlay').classList.remove('open'); }
$('addCustomerClose').addEventListener('click', closeAddCustomer);
$('cancelAddCustomer').addEventListener('click', closeAddCustomer);
$('addCustomerOverlay').addEventListener('click', e => { if (e.target === $('addCustomerOverlay')) closeAddCustomer(); });

$('saveNewCustomer').addEventListener('click', async () => {
  const name = $('newCustomerName').value.trim();
  const resultEl = $('addCustomerResult');
  resultEl.className = 'form-result';
  if (!name) {
    resultEl.textContent = 'Please enter a customer name.';
    resultEl.className = 'form-result error';
    return;
  }
  const btn = $('saveNewCustomer');
  btn.disabled = true; btn.textContent = 'Adding...';
  try {
    const res = await fetch(`${API}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone: $('newCustomerPhone').value.trim(), extraInfo: $('newCustomerExtra').value.trim() })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    resultEl.textContent = `✅ ${json.message}`;
    resultEl.className = 'form-result success';
    loadCustomers();
    setTimeout(() => closeAddCustomer(), 1200);
  } catch (err) {
    resultEl.textContent = `❌ ${err.message}`;
    resultEl.className = 'form-result error';
  } finally {
    btn.disabled = false; btn.textContent = '✦ Add Customer';
  }
});

/* ===== EDIT CUSTOMER (inline update via confirm) ===== */
async function openEditCustomerModal(id) {
  const customer = allCustomers.find(c => c.id === id);
  if (!customer) return;
  const name = prompt('Edit name:', customer.name);
  if (name === null) return;
  const phone = prompt('Edit phone:', customer.phone || '');
  if (phone === null) return;
  const extraInfo = prompt('Edit address/notes:', customer.extraInfo || '');
  if (extraInfo === null) return;
  try {
    const res = await fetch(`${API}/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), extraInfo: extraInfo.trim() })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    loadCustomers();
  } catch (err) { alert('Update failed: ' + err.message); }
}

/* ===== DELETE CUSTOMER ===== */
async function deleteCustomer(id, name) {
  if (!confirm(`Delete customer "${name}" and all their records?`)) return;
  try {
    const res = await fetch(`${API}/customers/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    loadCustomers();
  } catch (err) { alert('Delete failed: ' + err.message); }
}

/* ===== CUSTOMER DETAIL MODAL ===== */
async function openCustomerDetail(id) {
  currentDetailCustomerId = id;
  $('customerDetailOverlay').classList.add('open');
  $('customerDetailBody').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
  $('overallTotalBadge').textContent = '';
  try {
    const res = await fetch(`${API}/customers/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    const c = json.data;
    $('detailCustomerName').textContent = c.name;
    $('detailCustomerMeta').textContent = `📞 ${c.phone || '—'} · ${c.extraInfo || 'No notes'} · Joined: ${formatDate(c.createdAt)}`;
    $('overallTotalBadge').textContent = `Total: ${formatCurrency(c.overallTotal)}`;
    renderDailyRecords(c.dailyRecords || []);
  } catch (err) {
    $('customerDetailBody').innerHTML = `<div class="empty-state"><p>⚠ ${escHtml(err.message)}</p></div>`;
  }
}

function renderDailyRecords(dailyRecords) {
  const body = $('customerDetailBody');
  if (!dailyRecords.length) {
    body.innerHTML = '<div class="empty-state"><p>No daily records yet. Use the chatbot to add items!</p></div>';
    return;
  }
  const sorted = [...dailyRecords].sort((a, b) => b.date.localeCompare(a.date));
  body.innerHTML = `
    <table class="daily-records-table">
      <thead>
        <tr><th>Date</th><th>Items</th><th>Day Total</th><th>Note</th></tr>
      </thead>
      <tbody>
        ${sorted.map(d => `
          <tr>
            <td class="date-cell">${escHtml(d.date)}</td>
            <td>
              <ul class="items-list">
                ${(d.items || []).map(item => `
                  <li>${escHtml(item.description)} <span>× ${item.qty} @ PKR ${Number(item.price).toLocaleString()} = PKR ${(item.qty * item.price).toLocaleString()}</span></li>
                `).join('')}
              </ul>
            </td>
            <td class="day-total-cell">${formatCurrency(d.dayTotal)}</td>
            <td class="note-cell">${escHtml(d.note || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function closeCustomerDetail() { $('customerDetailOverlay').classList.remove('open'); }
$('customerDetailClose').addEventListener('click', closeCustomerDetail);
$('closeDetailBtn').addEventListener('click', closeCustomerDetail);
$('customerDetailOverlay').addEventListener('click', e => { if (e.target === $('customerDetailOverlay')) closeCustomerDetail(); });

$('generateReportBtn').addEventListener('click', () => {
  if (!currentDetailCustomerId) return;
  closeCustomerDetail();
  openReportModal(currentDetailCustomerId);
});

/* ===== MONTHLY REPORT MODAL ===== */
async function openReportModal(customerId, month) {
  currentReportCustomerId = customerId;
  $('reportOverlay').classList.add('open');
  $('reportBody').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
  $('reportTotalBadge').textContent = '';

  // Find customer name
  const customer = allCustomers.find(c => c.id === customerId);
  const m = month || currentMonthStr();

  $('reportSubtitle').textContent = `${customer ? customer.name : ''} — ${m}`;
  $('reportBody').innerHTML = `
    <div class="report-month-row">
      <label>Month:</label>
      <input type="month" class="month-input" id="reportMonthInput" value="${escHtml(m)}" />
      <button class="btn-fetch-report" id="fetchReportBtn">Load Report</button>
    </div>
    <div id="reportContent"><div class="loading-state"><div class="spinner"></div><p>Loading...</p></div></div>
  `;

  $('fetchReportBtn').addEventListener('click', () => {
    const selectedMonth = $('reportMonthInput').value;
    if (selectedMonth) fetchAndRenderReport(customerId, selectedMonth);
  });

  fetchAndRenderReport(customerId, m);
}

async function fetchAndRenderReport(customerId, month) {
  const contentEl = $('reportContent');
  if (!contentEl) return;
  contentEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
  $('reportTotalBadge').textContent = '';

  // Update subtitle
  const customer = allCustomers.find(c => c.id === customerId);
  $('reportSubtitle').textContent = `${customer ? customer.name : ''} — ${month}`;

  try {
    const res = await fetch(`${API}/customers/${customerId}/report?month=${encodeURIComponent(month)}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    const report = json.data;

    $('reportTotalBadge').textContent = `Month Total: ${formatCurrency(report.monthTotal)}`;

    if (!report.dailyRecords.length) {
      contentEl.innerHTML = `<div class="empty-state"><p>No records for ${month}.</p></div>`;
      return;
    }

    const sorted = [...report.dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
    contentEl.innerHTML = `
      <div class="report-header-section">
        <h4>🏪 ${escHtml(report.customer.name)}</h4>
        <p>📞 ${escHtml(report.customer.phone || '—')} · ${escHtml(report.customer.extraInfo || '')}</p>
      </div>
      ${sorted.map(d => `
        <div class="report-day-block">
          <div class="report-day-header">
            <span class="report-day-date">📅 ${escHtml(d.date)}</span>
            <span class="report-day-total-badge">${formatCurrency(d.dayTotal)}</span>
          </div>
          <table class="report-items-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
            <tbody>
              ${(d.items || []).map(item => `
                <tr>
                  <td>${escHtml(item.description)}</td>
                  <td>${item.qty}</td>
                  <td>PKR ${Number(item.price).toLocaleString()}</td>
                  <td>PKR ${(item.qty * item.price).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${d.note ? `<div style="padding:0.35rem 0.75rem;font-size:0.75rem;color:var(--text3);font-style:italic">📝 ${escHtml(d.note)}</div>` : ''}
        </div>
      `).join('')}
    `;

    // Store for download
    $('downloadReportBtn').onclick = () => downloadReportAsTxt(report, month);

  } catch (err) {
    contentEl.innerHTML = `<div class="empty-state"><p>⚠ ${escHtml(err.message)}</p></div>`;
  }
}

function downloadReportAsTxt(report, month) {
  const lines = [];
  lines.push('='.repeat(50));
  lines.push(`DUKAN LEDGER — MONTHLY REPORT`);
  lines.push('='.repeat(50));
  lines.push(`Customer: ${report.customer.name}`);
  lines.push(`Phone: ${report.customer.phone || '—'}`);
  lines.push(`Address/Notes: ${report.customer.extraInfo || '—'}`);
  lines.push(`Month: ${month}`);
  lines.push('='.repeat(50));
  lines.push('');

  const sorted = [...report.dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach(d => {
    lines.push(`Date: ${d.date}`);
    lines.push('-'.repeat(30));
    (d.items || []).forEach(item => {
      const amount = item.qty * item.price;
      lines.push(`  ${item.description.padEnd(20)} x${item.qty}  @PKR ${item.price}  = PKR ${amount}`);
    });
    lines.push(`  ${'Day Total:'.padEnd(30)} PKR ${d.dayTotal}`);
    if (d.note) lines.push(`  Note: ${d.note}`);
    lines.push('');
  });

  lines.push('='.repeat(50));
  lines.push(`MONTH TOTAL: PKR ${report.monthTotal}`);
  lines.push('='.repeat(50));
  lines.push(`Generated: ${new Date().toLocaleString()}`);

  const txt = lines.join('\n');
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report_${report.customer.name.replace(/\s+/g,'_')}_${month}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function closeReportModal() { $('reportOverlay').classList.remove('open'); }
$('reportClose').addEventListener('click', closeReportModal);
$('closeReportBtn').addEventListener('click', closeReportModal);
$('reportOverlay').addEventListener('click', e => { if (e.target === $('reportOverlay')) closeReportModal(); });

/* ===== VOICE INPUT ===== */
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $('micBtn').title = 'Voice input not supported in this browser';
    $('micBtn').style.opacity = '0.4';
    $('micBtn').disabled = true;
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = voiceLang;

  recognition.onstart = () => {
    isRecording = true;
    $('micBtn').classList.add('recording');
    $('voiceIndicator').classList.add('active');
  };
  recognition.onend = () => {
    isRecording = false;
    $('micBtn').classList.remove('recording');
    $('voiceIndicator').classList.remove('active');
  };
  recognition.onresult = (e) => {
    let transcript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    $('chatInput').value = transcript;
    $('chatInput').style.height = 'auto';
    $('chatInput').style.height = Math.min($('chatInput').scrollHeight, 100) + 'px';
  };
  recognition.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    isRecording = false;
    $('micBtn').classList.remove('recording');
    $('voiceIndicator').classList.remove('active');
  };
}

$('micBtn').addEventListener('click', () => {
  if (!recognition) { alert('Voice input is not supported in this browser.'); return; }
  if (isRecording) {
    recognition.stop();
  } else {
    recognition.lang = voiceLang;
    try { recognition.start(); } catch (e) { console.warn(e); }
  }
});

/* ===== LANGUAGE TOGGLE ===== */
$('langToggle').addEventListener('click', () => {
  const btn = $('langToggle');
  if (voiceLang === 'en-US') {
    voiceLang = 'ur-PK';
    btn.textContent = 'اردو';
    btn.classList.add('urdu');
  } else {
    voiceLang = 'en-US';
    btn.textContent = 'EN';
    btn.classList.remove('urdu');
  }
  if (recognition) recognition.lang = voiceLang;
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
    <div class="msg-avatar">${role === 'bot' ? '🤖' : '👤'}</div>
    <div class="msg-bubble">${html}</div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

$('clearChatBtn').addEventListener('click', () => {
  chatHistory = [];
  $('chatMessages').innerHTML = `
    <div class="chat-msg bot">
      <div class="msg-avatar">🤖</div>
      <div class="msg-bubble"><p>Chat cleared. Kuch poochna ho toh bolain!</p></div>
    </div>
  `;
});

function buildChatResultHtml(intent, data, message) {
  const msg = markdownBold(message || '');
  let html = '';

  if (!data || data.type === 'error') {
    html += `<span class="result-badge error">✕ Error</span><p>${msg}</p>`;
    return html;
  }

  switch (intent) {
    case 'ADD_CUSTOMER':
      html += `<span class="result-badge success">✓ Customer Added</span><p>${msg}</p>`;
      if (data.customer) html += buildCustomerMiniCard(data.customer);
      break;

    case 'ADD_DAILY_RECORD':
      html += `<span class="result-badge success">✓ Record Added</span><p>${msg}</p>`;
      if (data.dayRecord) {
        html += `<div style="margin-top:0.5rem;font-size:0.78rem">`;
        html += `<strong>Date:</strong> ${escHtml(data.date)}<br>`;
        html += `<strong>Items:</strong><ul class="items-list" style="margin-left:0.5rem">`;
        (data.dayRecord.items || []).forEach(item => {
          html += `<li>${escHtml(item.description)} × ${item.qty} @ PKR ${Number(item.price).toLocaleString()} = PKR ${(item.qty * item.price).toLocaleString()}</li>`;
        });
        html += `</ul><strong>Day Total:</strong> ${formatCurrency(data.dayRecord.dayTotal)}</div>`;
      }
      break;

    case 'GET_CUSTOMER':
    case 'GET_OVERALL_TOTAL':
      html += `<span class="result-badge info">📋 Customer</span><p>${msg}</p>`;
      if (data.customer) {
        const c = data.customer;
        html += `<div style="margin-top:0.5rem;font-size:0.78rem">
          <strong>${escHtml(c.name)}</strong> · ${escHtml(c.phone || '—')}<br>
          <span style="color:var(--text3)">${escHtml(c.extraInfo || '')}</span><br>
          Total: <strong>${formatCurrency(c.overallTotal)}</strong>
          <br><button class="example-btn" style="margin-top:0.4rem" onclick="openCustomerDetail('${escHtml(c.id)}')">View Full Record →</button>
        </div>`;
      }
      if (data.total !== undefined) {
        html += `<div style="margin-top:0.5rem;font-size:0.88rem;font-weight:700;color:var(--primary)">${formatCurrency(data.total)}</div>`;
      }
      break;

    case 'GET_ALL_CUSTOMERS':
    case 'SEARCH_CUSTOMER': {
      const customers = data.customers || [];
      html += `<span class="result-badge info">📋 ${customers.length} Customer(s)</span><p>${msg}</p>`;
      if (customers.length) {
        html += `<table class="mini-table"><thead><tr><th>Name</th><th>Phone</th><th>Total</th></tr></thead><tbody>`;
        customers.forEach(c => {
          html += `<tr>
            <td><button class="example-btn" style="padding:0.1rem 0.4rem" onclick="openCustomerDetail('${escHtml(c.id)}')">${escHtml(c.name)}</button></td>
            <td>${escHtml(c.phone || '—')}</td>
            <td>${formatCurrency(c.overallTotal)}</td>
          </tr>`;
        });
        html += `</tbody></table>`;
      }
      break;
    }

    case 'GET_DAILY_RECORDS': {
      html += `<span class="result-badge info">📋 Records</span><p>${msg}</p>`;
      const records = data.records || [];
      if (records.length && data.customer) {
        html += `<button class="example-btn" style="margin-bottom:0.4rem" onclick="openCustomerDetail('${escHtml(data.customer.id)}')">View Full Detail →</button>`;
      }
      break;
    }

    case 'GENERATE_MONTHLY_REPORT': {
      html += `<span class="result-badge info">📊 Report</span><p>${msg}</p>`;
      const report = data.report;
      if (report) {
        html += `<button class="example-btn" onclick="openReportModal('${escHtml(report.customer.id)}', '${escHtml(report.month)}')">📊 Open Full Report →</button>`;
      }
      break;
    }

    case 'UPDATE_CUSTOMER':
      html += `<span class="result-badge success">✓ Updated</span><p>${msg}</p>`;
      if (data.customer) html += buildCustomerMiniCard(data.customer);
      break;

    case 'DELETE_CUSTOMER':
      html += `<span class="result-badge warn">🗑 Deleted</span><p>${msg}</p>`;
      break;

    default:
      html += `<p>${msg}</p>`;
      if (data.type === 'info') html += `<span class="result-badge info">ℹ Info</span>`;
  }

  return html;
}

function buildCustomerMiniCard(c) {
  return `<div style="margin-top:0.5rem;font-size:0.78rem;background:var(--bg3);padding:0.5rem;border-radius:6px;border:1px solid var(--border)">
    <strong>${escHtml(c.name)}</strong> · ${escHtml(c.phone || '—')}<br>
    <span style="color:var(--text3)">${escHtml(c.extraInfo || '')}</span>
  </div>`;
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
      ? `<span class="ai-mode-tag ai">🤖 AI</span>`
      : `<span class="ai-mode-tag fallback" title="${escHtml(json.aiError || '')}">⚡ Fallback</span>`;

    addChatMsg('bot', modeTag + buildChatResultHtml(json.intent, json.data, json.message));
    chatHistory.push({ role: 'assistant', content: json.message || 'Done.' });

    const refreshIntents = ['ADD_CUSTOMER', 'ADD_DAILY_RECORD', 'UPDATE_CUSTOMER', 'DELETE_CUSTOMER'];
    if (refreshIntents.includes(json.intent)) {
      loadCustomers();
    }
  } catch (err) {
    thinkingDiv.remove();
    addChatMsg('bot', `<span class="result-badge error">✕ Connection Error</span><p>Server se connect nahi ho saka. Backend running hai?</p>`);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

/* ===== INIT ===== */
initSpeechRecognition();
checkStatus();
loadCustomers();
checkApiKeyStatus();

/* ===== API KEY SETUP ===== */
async function checkApiKeyStatus() {
  try {
    const res = await fetch(`${API}/config/status`);
    const json = await res.json();
    if (json.success && !json.hasApiKey) {
      $('apiKeyBanner').classList.add('visible');
    } else {
      $('apiKeyBanner').classList.remove('visible');
    }
  } catch { /* server might not be up yet */ }
}

function openSetupModal() {
  $('apiKeyInput').value = '';
  $('setupResult').className = 'form-result';
  $('setupOverlay').classList.add('open');
  $('apiKeyInput').focus();
}
function closeSetupModal() { $('setupOverlay').classList.remove('open'); }

$('setupBtn').addEventListener('click', openSetupModal);
$('setupClose').addEventListener('click', closeSetupModal);
$('cancelSetup').addEventListener('click', closeSetupModal);
$('setupOverlay').addEventListener('click', e => { if (e.target === $('setupOverlay')) closeSetupModal(); });

$('saveApiKey').addEventListener('click', async () => {
  const apiKey = $('apiKeyInput').value.trim();
  const resultEl = $('setupResult');
  resultEl.className = 'form-result';
  if (!apiKey) {
    resultEl.textContent = 'Please paste your API key.';
    resultEl.className = 'form-result error';
    return;
  }
  const btn = $('saveApiKey');
  btn.disabled = true; btn.textContent = 'Testing...';
  try {
    const res = await fetch(`${API}/config/apikey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    const json = await res.json();
    if (json.success) {
      resultEl.textContent = json.message;
      resultEl.className = 'form-result success';
      $('apiKeyBanner').classList.remove('visible');
      setTimeout(() => closeSetupModal(), 1500);
    } else {
      resultEl.textContent = '❌ ' + json.message;
      resultEl.className = 'form-result error';
    }
  } catch (err) {
    resultEl.textContent = '❌ Connection error: ' + err.message;
    resultEl.className = 'form-result error';
  } finally {
    btn.disabled = false; btn.textContent = '🔑 Save & Test';
  }
});

/* ===== LANGUAGE MANAGER ===== */
$('langManagerBtn').addEventListener('click', openLangManager);
$('langManagerClose').addEventListener('click', closeLangManager);
$('closeLangManager').addEventListener('click', closeLangManager);
$('langManagerOverlay').addEventListener('click', e => { if (e.target === $('langManagerOverlay')) closeLangManager(); });

function closeLangManager() { $('langManagerOverlay').classList.remove('open'); }

async function openLangManager() {
  $('langManagerOverlay').classList.add('open');
  await renderLangManager();
}

async function renderLangManager() {
  const body = $('langManagerBody');
  body.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const [availRes, activeRes] = await Promise.all([
      fetch(`${API}/languages/available`),
      fetch(`${API}/languages/active`)
    ]);
    const availJson = await availRes.json();
    const activeJson = await activeRes.json();

    if (!availJson.success) throw new Error(availJson.message);
    const packs = availJson.data;
    const activeCodes = activeJson.success ? activeJson.data : ['english'];

    body.innerHTML = `
      <div class="lang-section-title">Available Language Packs</div>
      <div class="lang-packs-grid" id="langPacksGrid">
        ${packs.map(pack => renderPackCard(pack, activeCodes)).join('')}
      </div>
      <div class="lang-section-title" style="margin-top:1rem">Active Languages</div>
      <p style="font-size:0.75rem;color:var(--text3);margin-bottom:0.75rem">Active language packs add vocabulary to the AI so it understands commands in those languages.</p>
      <div class="lang-active-list" id="langActiveList">
        ${packs.filter(p => p.installed).map(pack => renderActiveToggle(pack, activeCodes)).join('')}
      </div>
    `;

    // Bind download/remove buttons
    body.querySelectorAll('[data-download]').forEach(btn => {
      btn.addEventListener('click', () => downloadPack(btn.dataset.download));
    });
    body.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => removePack(btn.dataset.remove));
    });
    body.querySelectorAll('[data-toggle]').forEach(toggle => {
      toggle.addEventListener('change', () => handleActiveToggle(toggle, activeCodes));
    });
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><p>⚠ ${escHtml(err.message)}</p></div>`;
  }
}

function renderPackCard(pack, activeCodes) {
  const isActive = activeCodes.includes(pack.code);
  let actionBtn = '';
  if (pack.builtIn) {
    actionBtn = `<span class="lang-badge built-in">Built-in</span>`;
  } else if (pack.installed) {
    actionBtn = `<button class="lang-btn lang-btn-remove" data-remove="${escHtml(pack.code)}">🗑 Remove</button>`;
  } else {
    actionBtn = `<button class="lang-btn lang-btn-download" data-download="${escHtml(pack.code)}">⬇ Download</button>`;
  }

  return `
    <div class="lang-pack-card ${pack.installed ? 'installed' : ''}" id="pack-card-${escHtml(pack.code)}">
      <div class="lang-pack-header">
        <div class="lang-pack-name">${escHtml(pack.name)}</div>
        <div class="lang-pack-native">${escHtml(pack.nativeName)}</div>
      </div>
      <div class="lang-pack-desc">${escHtml(pack.description)}</div>
      <div class="lang-pack-meta">
        <span>v${escHtml(pack.version)}</span>
        <span>${escHtml(pack.size || '')}</span>
        <span class="lang-status-badge ${pack.installed ? 'installed' : ''}">${pack.installed ? '✅ Installed' : 'Not Installed'}</span>
      </div>
      <div class="lang-pack-actions">${actionBtn}</div>
    </div>
  `;
}

function renderActiveToggle(pack, activeCodes) {
  const isActive = activeCodes.includes(pack.code);
  const isEnglish = pack.code === 'english';
  return `
    <div class="lang-active-item">
      <div class="lang-active-info">
        <span class="lang-active-name">${escHtml(pack.name)}</span>
        <span class="lang-active-native">${escHtml(pack.nativeName)}</span>
        ${pack.voiceCode ? `<span class="lang-voice-code">🎙️ ${escHtml(pack.voiceCode)}</span>` : ''}
      </div>
      <label class="toggle-switch ${isEnglish ? 'disabled' : ''}">
        <input type="checkbox" data-toggle="${escHtml(pack.code)}" ${isActive ? 'checked' : ''} ${isEnglish ? 'disabled' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
}

async function downloadPack(code) {
  const card = $(`pack-card-${code}`);
  if (card) {
    card.classList.add('downloading');
    card.querySelector('.lang-pack-actions').innerHTML = `<span class="lang-downloading"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Installing...</span>`;
  }
  try {
    const res = await fetch(`${API}/languages/download/${encodeURIComponent(code)}`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      await renderLangManager(); // refresh
    } else {
      alert('❌ ' + json.message);
      if (card) card.classList.remove('downloading');
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
    if (card) card.classList.remove('downloading');
  }
}

async function removePack(code) {
  if (!confirm(`Remove "${code}" language pack?`)) return;
  try {
    const res = await fetch(`${API}/languages/${encodeURIComponent(code)}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      await renderLangManager(); // refresh
    } else {
      alert('❌ ' + json.message);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

async function handleActiveToggle(toggle, currentActiveCodes) {
  const code = toggle.dataset.toggle;
  let newActive = [...currentActiveCodes];
  if (toggle.checked) {
    if (!newActive.includes(code)) newActive.push(code);
  } else {
    newActive = newActive.filter(c => c !== code);
  }

  try {
    const res = await fetch(`${API}/languages/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeLanguages: newActive })
    });
    const json = await res.json();
    if (json.success) {
      // Update voice recognition language based on first non-english active pack
      updateVoiceLang(json.data);
    } else {
      alert('❌ ' + json.message);
      toggle.checked = !toggle.checked; // revert
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
    toggle.checked = !toggle.checked; // revert
  }
}

function updateVoiceLang(activeCodes) {
  // Use the voice code of the first non-English active language if available
  const langPriorityMap = {
    'roman-urdu': 'ur-PK',
    'punjabi-roman': 'pa-PK',
    'english': 'en-US'
  };
  for (const code of activeCodes) {
    if (code !== 'english' && langPriorityMap[code]) {
      voiceLang = langPriorityMap[code];
      if (recognition) recognition.lang = voiceLang;
      const btn = $('langToggle');
      if (btn) {
        btn.textContent = code === 'roman-urdu' ? 'اردو' : code === 'punjabi-roman' ? 'پنجابی' : 'EN';
        btn.classList.toggle('urdu', code !== 'english');
      }
      return;
    }
  }
  // Default to English
  voiceLang = 'en-US';
  if (recognition) recognition.lang = voiceLang;
  const btn = $('langToggle');
  if (btn) { btn.textContent = 'EN'; btn.classList.remove('urdu'); }
}
