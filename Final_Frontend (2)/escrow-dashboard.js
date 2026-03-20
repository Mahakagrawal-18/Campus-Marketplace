/* ═══════════════════════════════════════════════════════════════
   escrow-dashboard.js — Campus Exchange Escrow Dashboard
   Requires: api.js (already in your frontend folder)
═══════════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────────
let currentRole   = 'all';
let currentStatus = '';
let pendingTxnId  = null;
let reviewRating  = 0;
let clockInterval = null;

const RATING_LABELS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  // Populate user badge in header
  const user = getUser();
  if (user) {
    document.getElementById('userName').textContent    = user.name.split(' ')[0];
    document.getElementById('userTrust').textContent   = `★ ${(user.trustScore || 5.0).toFixed(1)}`;
    document.getElementById('userAvatar').textContent  = user.name[0].toUpperCase();
  }

  // Live clock
  updateClock();
  clockInterval = setInterval(updateClock, 1000);

  // Load data
  loadStats();
  loadTransactions();
});

function updateClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  const ss  = String(now.getSeconds()).padStart(2, '0');
  const el  = document.getElementById('headerClock');
  if (el) el.textContent = `${hh}:${mm}:${ss}`;
}

// ═══════════════════════════════════════════════════════════════
// REFRESH
// ═══════════════════════════════════════════════════════════════
async function refreshAll() {
  const btn  = document.querySelector('.refresh-btn');
  const icon = document.getElementById('refreshIcon');
  btn.classList.add('spinning');
  await Promise.all([loadStats(), loadTransactions()]);
  btn.classList.remove('spinning');
}

// ═══════════════════════════════════════════════════════════════
// LOAD STATS
// ═══════════════════════════════════════════════════════════════
async function loadStats() {
  try {
    const res  = await apiFetch('/api/transactions/dashboard');
    const data = await res.json();
    if (!data.success) return;

    const s = data.data;

    // Stat strip
    document.getElementById('statStrip').innerHTML = `
      <div class="stat-card" style="--card-accent:var(--cyan);--card-glow:rgba(0,212,255,0.06)">
        <div class="stat-label">TOTAL TXNS</div>
        <div class="stat-value">${s.totalTransactions}</div>
        <div class="stat-sub">lifetime</div>
      </div>
      <div class="stat-card" style="--card-accent:var(--green);--card-glow:rgba(0,230,118,0.06)">
        <div class="stat-label">EARNED</div>
        <div class="stat-value">₹${abbrev(s.asSeller?.totalEarned || 0)}</div>
        <div class="stat-sub">${s.asSeller?.completed || 0} sales done</div>
      </div>
      <div class="stat-card" style="--card-accent:var(--purple);--card-glow:rgba(201,123,255,0.06)">
        <div class="stat-label">SPENT</div>
        <div class="stat-value">₹${abbrev(s.asbuyer?.totalSpent || 0)}</div>
        <div class="stat-sub">${s.asbuyer?.completed || 0} purchases</div>
      </div>
      <div class="stat-card" style="--card-accent:var(--yellow);--card-glow:rgba(255,179,0,0.06)">
        <div class="stat-label">ACTIVE</div>
        <div class="stat-value">${(s.asbuyer?.reserved || 0) + (s.asSeller?.reserved || 0)}</div>
        <div class="stat-sub">reserved now</div>
      </div>
      <div class="stat-card" style="--card-accent:var(--orange);--card-glow:rgba(255,112,67,0.06)">
        <div class="stat-label">TRUST</div>
        <div class="stat-value">${(s.trustScore || 5.0).toFixed(1)}</div>
        <div class="stat-sub">★ reputation score</div>
      </div>
    `;

    // Pipeline counts
    const reserved  = (s.asbuyer?.reserved  || 0) + (s.asSeller?.reserved  || 0);
    const completed = (s.asbuyer?.completed || 0) + (s.asSeller?.completed || 0);
    const disputed  = (s.asbuyer?.disputed  || 0) + (s.asSeller?.disputed  || 0);

    setText('pipeAvailable', '—');
    setText('pipeReserved',  reserved);
    setText('pipeCompleted', completed);
    setText('pipeDisputed',  disputed);

  } catch (err) {
    console.error('Stats load error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// LOAD TRANSACTIONS
// ═══════════════════════════════════════════════════════════════
async function loadTransactions() {
  const rows = document.getElementById('txnRows');
  rows.innerHTML = `
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
  `;

  try {
    let url = `/api/transactions/my?role=${currentRole}`;
    if (currentStatus) url += `&status=${currentStatus}`;

    const res  = await apiFetch(url);
    const data = await res.json();

    rows.innerHTML = '';

    if (!data.data || data.data.length === 0) {
      rows.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">NO TRANSACTIONS</div>
          <div class="empty-sub">Transactions you make as buyer or seller will appear here.</div>
        </div>`;
      return;
    }

    data.data.forEach((txn, i) => {
      const row = buildRow(txn, i);
      rows.appendChild(row);
    });

  } catch (err) {
    rows.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">LOAD FAILED</div>
        <div class="empty-sub">Is the backend running on localhost:5000?</div>
      </div>`;
    console.error('Transaction load error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// BUILD ROW
// ═══════════════════════════════════════════════════════════════
function buildRow(txn, idx) {
  const me       = getUser()?._id;
  const isBuyer  = txn.buyer?._id === me || txn.buyer === me;
  const other    = isBuyer ? txn.seller : txn.buyer;
  const imgSrc   = txn.listing?.images?.[0]?.url || 'https://via.placeholder.com/44x44?text=📦';
  const statusLC = (txn.status || '').toLowerCase();

  // Escrow progress percentage
  const pct = txn.status === 'Completed' ? 100
    : txn.status === 'Reserved'
      ? (txn.sellerConfirmed && txn.buyerConfirmed ? 90
        : (txn.sellerConfirmed || txn.buyerConfirmed) ? 55 : 20)
      : 0;

  // Countdown
  let timerHTML = '';
  if (txn.status === 'Reserved' && txn.expiresAt) {
    const diff = new Date(txn.expiresAt) - Date.now();
    if (diff > 0) {
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      timerHTML = `<div class="timer-text"><i class="fa fa-clock"></i> ${h}h ${m}m left</div>`;
    } else {
      timerHTML = `<div class="timer-text expired"><i class="fa fa-clock"></i> Expired</div>`;
    }
  }

  // Escrow cell
  const escrowHTML = txn.status === 'Reserved' ? `
    <div class="escrow-bar-wrap">
      <div class="escrow-track">
        <div class="escrow-fill ${pct === 100 ? 'done' : ''}" style="width:${pct}%"></div>
      </div>
      <span class="escrow-pct">${pct}%</span>
    </div>
    <div class="confirm-dots">
      <div class="dot ${txn.sellerConfirmed ? 'lit' : ''}"></div>
      <span>SELLER</span>
      <div style="width:16px;height:1px;background:var(--border2)"></div>
      <div class="dot ${txn.buyerConfirmed ? 'lit' : ''}"></div>
      <span>BUYER</span>
    </div>
    ${timerHTML}
  ` : txn.status === 'Completed' ? `
    <div class="confirm-dots">
      <div class="dot lit"></div><span>SELLER</span>
      <div style="width:16px;height:1px;background:var(--border2)"></div>
      <div class="dot lit"></div><span>BUYER</span>
    </div>
    <div class="timer-text" style="color:var(--green)">Handover complete</div>
  ` : `<span style="font-family:var(--mono);font-size:10px;color:var(--text-dim)">${txn.status}</span>`;

  // Action buttons
  const actionsHTML = buildActions(txn, isBuyer);

  // My confirmation status
  const myConfirmed = isBuyer ? txn.buyerConfirmed : txn.sellerConfirmed;

  const row = document.createElement('div');
  row.className = 'txn-row';
  row.style.animationDelay = `${idx * 40}ms`;

  row.innerHTML = `
    <!-- ITEM -->
    <div class="txn-item">
      <img class="txn-thumb" src="${imgSrc}" alt="${txn.listing?.title || 'Item'}"
           onerror="this.src='https://via.placeholder.com/44x44?text=📦'">
      <div class="txn-item-info">
        <div class="txn-title">${txn.listing?.title || 'Unknown Item'}</div>
        <div class="txn-cat">${txn.listing?.category || '—'} · ${txn.listing?.condition || '—'}</div>
        <div class="role-badge ${isBuyer ? 'role-buyer' : 'role-seller'}">
          ${isBuyer ? '🛒 BUYER' : '🏪 SELLER'}
        </div>
      </div>
    </div>

    <!-- COUNTERPARTY -->
    <div class="txn-party-cell">
      <div class="txn-party">${other?.name || '—'}</div>
      <div class="txn-hostel">${other?.hostel || 'IITJ'}</div>
    </div>

    <!-- AMOUNT -->
    <div class="txn-amount">₹${(txn.agreedPrice || 0).toLocaleString('en-IN')}</div>

    <!-- STATUS -->
    <div>
      <span class="status-pill s-${statusLC}">${txn.status}</span>
    </div>

    <!-- ESCROW STATE -->
    <div class="escrow-cell">${escrowHTML}</div>

    <!-- ACTIONS -->
    <div class="action-cell">${actionsHTML}</div>
  `;

  return row;
}

// ═══════════════════════════════════════════════════════════════
// BUILD ACTION BUTTONS
// ═══════════════════════════════════════════════════════════════
function buildActions(txn, isBuyer) {
  const id = txn._id;

  if (txn.status === 'Completed') {
    if (txn.hasReviewed) {
      return `<span class="act-btn btn-done"><i class="fa fa-star"></i> Reviewed</span>`;
    }
    return `
      <button class="act-btn btn-review" onclick="openReviewModal('${id}', ${isBuyer})">
        <i class="fa fa-star"></i> REVIEW
      </button>`;
  }

  if (txn.status === 'Reserved') {
    const myConfirmed = isBuyer ? txn.buyerConfirmed : txn.sellerConfirmed;
    let html = '';

    // Seller-only: release (marks handover done)
    if (!isBuyer && !txn.sellerConfirmed) {
      html += `<button class="act-btn btn-release" onclick="doRelease('${id}')">
        <i class="fa fa-paper-plane"></i> RELEASE
      </button>`;
    }

    // Either party: confirm receipt
    if (!myConfirmed) {
      html += `<button class="act-btn btn-confirm" onclick="doConfirm('${id}')">
        <i class="fa fa-check"></i> CONFIRM
      </button>`;
    } else {
      html += `<span class="act-btn btn-done"><i class="fa fa-check"></i> CONFIRMED</span>`;
    }

    // Dispute
    html += `<button class="act-btn btn-dispute" onclick="openDisputeModal('${id}')">
      <i class="fa fa-exclamation-triangle"></i>
    </button>`;

    // Cancel
    html += `<button class="act-btn btn-cancel" onclick="doCancel('${id}')">
      <i class="fa fa-times"></i>
    </button>`;

    return html;
  }

  if (txn.status === 'Disputed') {
    return `<span style="font-family:var(--mono);font-size:9px;color:var(--red);letter-spacing:1px;">
      <i class="fa fa-gavel"></i> UNDER REVIEW
    </span>`;
  }

  return `<span style="font-family:var(--mono);font-size:9px;color:var(--text-dim)">${txn.status}</span>`;
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTION ACTIONS
// ═══════════════════════════════════════════════════════════════
async function doRelease(id) {
  if (!confirm('Mark item as handed over to the buyer?')) return;
  await callAction(`/api/transactions/${id}/release`, {}, '📦 Item released! Waiting for buyer confirmation.');
}

async function doConfirm(id) {
  if (!confirm('Confirm you have received the item / payment?')) return;
  await callAction(`/api/transactions/${id}/confirm`, {}, '✅ Confirmed!');
}

async function doCancel(id) {
  if (!confirm('Cancel this transaction? The listing will become available again.')) return;
  await callAction(`/api/transactions/${id}/cancel`, {}, 'Transaction cancelled. Item is available again.');
}

async function callAction(url, body, successMsg) {
  try {
    const res  = await apiFetch(url, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
      showToast(successMsg, 'success');
      await loadStats();
      await loadTransactions();
    } else {
      showToast(data.message || 'Action failed.', 'error');
    }
  } catch {
    showToast('Server error. Try again.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// DISPUTE MODAL
// ═══════════════════════════════════════════════════════════════
function openDisputeModal(id) {
  pendingTxnId = id;
  document.getElementById('disputeReason').value = '';
  openModal('disputeModal');
}

async function submitDispute() {
  const reason = document.getElementById('disputeReason').value.trim();
  if (!reason) { showToast('Please describe the issue.', 'error'); return; }
  await callAction(`/api/transactions/${pendingTxnId}/dispute`, { reason }, '⚠️ Dispute raised. Admin will review.');
  closeModal('disputeModal');
  pendingTxnId = null;
}

// ═══════════════════════════════════════════════════════════════
// REVIEW MODAL
// ═══════════════════════════════════════════════════════════════
function openReviewModal(id, isBuyer) {
  pendingTxnId  = id;
  reviewRating  = 0;
  document.getElementById('reviewSub').textContent    = isBuyer ? 'Rate the seller' : 'Rate the buyer';
  document.getElementById('reviewComment').value      = '';
  document.getElementById('ratingLabel').textContent  = 'Select a rating';
  setStar(0);
  openModal('reviewModal');
}

function setStar(n) {
  reviewRating = n;
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('lit', parseInt(s.dataset.v) <= n);
  });
  document.getElementById('ratingLabel').textContent = n > 0 ? RATING_LABELS[n] : 'Select a rating';
}

async function submitReview() {
  if (!reviewRating) { showToast('Please pick a star rating.', 'error'); return; }
  const comment = document.getElementById('reviewComment').value.trim();
  try {
    const res  = await apiFetch('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ transactionId: pendingTxnId, rating: reviewRating, comment }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('⭐ Review submitted! Trust score updated.', 'success');
      closeModal('reviewModal');
      pendingTxnId = null;
      await loadStats();
      await loadTransactions();
    } else {
      showToast(data.message || 'Review failed.', 'error');
    }
  } catch {
    showToast('Server error.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// FILTERS
// ═══════════════════════════════════════════════════════════════
function setRole(role, el) {
  currentRole = role;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadTransactions();
}

function setStatus(status, el) {
  currentStatus = status;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  loadTransactions();
}

// ═══════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', function (e) {
    if (e.target === this) closeModal(this.id);
  });
});

// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.remove('show'); }, 3600);
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function abbrev(n) {
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)   return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString('en-IN');
}
