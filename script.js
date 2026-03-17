/* ═══════════════════════════════════════
   FLO FINANCE — SCRIPT
   ═══════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────────────────
let state = {
  currentSavings: 0,
  name: 'User',
  transactions: [],
  goals: []
};

// ── Category Icons ──────────────────────────────────────────────────────
const CAT_ICONS = {
  Salary: '💼', Freelance: '💻', Investment: '📈', Gift: '🎁',
  Food: '🍔', Rent: '🏠', Transport: '🚗', Shopping: '🛍️',
  Utilities: '⚡', Health: '💊', Entertainment: '🎮', Other: '💸'
};

// ── Chart instances ────────────────────────────────────────────────────
let donutChart = null;
let barChart = null;
let lineChart = null;

// ── Load / Save ────────────────────────────────────────────────────────
function loadState() {
  try {
    const saved = localStorage.getItem('floFinanceData');
    if (saved) state = { ...state, ...JSON.parse(saved) };
  } catch (e) { console.warn('Could not load state', e); }
}

function saveState() {
  try {
    localStorage.setItem('floFinanceData', JSON.stringify(state));
  } catch (e) { console.warn('Could not save state', e); }
}

// ── Date Helpers ───────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function monthLabel(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ── Format Currency ────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

function fmtShort(n) {
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return fmt(n);
}

// ── Animated Counter ───────────────────────────────────────────────────
function animateCounter(el, target, duration = 600) {
  const start = performance.now();
  const from = parseFloat(el.dataset.current || 0);
  el.dataset.current = target;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = from + (target - from) * ease;
    el.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = fmt(target);
  }
  requestAnimationFrame(update);
}

// ── Compute Stats ──────────────────────────────────────────────────────
function getMonthStats() {
  const txns = state.transactions.filter(t => isThisMonth(t.date));
  const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const rate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
  return { income, expenses, rate };
}

function getTotalBalance() {
  const all = state.transactions;
  const inc = all.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = all.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return (state.currentSavings || 0) + inc - exp;
}

// ── Render Dashboard ───────────────────────────────────────────────────
function renderDashboard() {
  const balance = getTotalBalance();
  const { income, expenses, rate } = getMonthStats();
  const net = income - expenses;

  animateCounter(document.getElementById('heroBalance'), balance);

  const badge = document.getElementById('heroGrowth');
  badge.textContent = (net >= 0 ? '+' : '') + fmt(net);
  badge.className = 'hero-badge ' + (net >= 0 ? 'positive' : 'negative');

  animateCounter(document.getElementById('statIncome'), income);
  animateCounter(document.getElementById('statExpenses'), expenses);
  document.getElementById('statRate').textContent = rate + '%';

  // Recent 5 transactions
  const recent = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const list = document.getElementById('recentList');
  const empty = document.getElementById('emptyHome');
  list.innerHTML = '';

  if (recent.length === 0) {
    empty.classList.add('visible');
  } else {
    empty.classList.remove('visible');
    recent.forEach((t, i) => {
      const el = buildTxnItem(t);
      el.style.animationDelay = `${i * 50}ms`;
      list.appendChild(el);
    });
  }
}

// ── Build Transaction Item ─────────────────────────────────────────────
function buildTxnItem(t) {
  const el = document.createElement('div');
  el.className = 'txn-item';
  const icon = CAT_ICONS[t.category] || '💸';
  el.innerHTML = `
    <div class="txn-icon ${t.type}"><span>${icon}</span></div>
    <div class="txn-info">
      <div class="txn-desc">${escHtml(t.description)}</div>
      <div class="txn-cat">${escHtml(t.category)} · ${formatDate(t.date)}</div>
    </div>
    <div class="txn-right">
      <div class="txn-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</div>
    </div>
    <div class="txn-actions">
      <button class="txn-action-btn edit" data-id="${t.id}" title="Edit">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="txn-action-btn delete" data-id="${t.id}" title="Delete">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`;

  el.querySelector('.edit').addEventListener('click', () => openEditTxn(t.id));
  el.querySelector('.delete').addEventListener('click', () => deleteTxn(t.id));
  return el;
}

// ── Render Transactions Page ───────────────────────────────────────────
let currentFilter = 'all';

function renderTransactions() {
  const filtered = state.transactions.filter(t => {
    if (currentFilter === 'all') return true;
    return t.type === currentFilter;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const list = document.getElementById('txnList');
  const empty = document.getElementById('emptyTxn');
  list.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.add('visible');
  } else {
    empty.classList.remove('visible');
    filtered.forEach((t, i) => {
      const el = buildTxnItem(t);
      el.style.animationDelay = `${i * 40}ms`;
      list.appendChild(el);
    });
  }
}

// ── Analytics ─────────────────────────────────────────────────────────
function renderAnalytics() {
  const now = new Date();
  document.getElementById('chartMonth').textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const expenses = state.transactions.filter(t => t.type === 'expense' && isThisMonth(t.date));
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  document.getElementById('donutTotal').textContent = fmtShort(total);

  // Group by category
  const catMap = {};
  expenses.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const palette = ['#7C3AED','#A3E635','#38BDF8','#F97316','#EC4899','#FBBF24','#6366F1','#10B981'];

  const labels = categories.map(c => c[0]);
  const data = categories.map(c => c[1]);
  const colors = categories.map((_, i) => palette[i % palette.length]);

  // Donut
  if (donutChart) donutChart.destroy();
  const dCtx = document.getElementById('donutChart').getContext('2d');
  donutChart = new Chart(dCtx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: data.length ? data : [1], backgroundColor: data.length ? colors : ['#1E293B'], borderWidth: 0, hoverOffset: 6 }] },
    options: {
      cutout: '72%',
      animation: { duration: 800, easing: 'easeInOutQuart' },
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed)}` }
      }},
      responsive: true,
      maintainAspectRatio: true
    }
  });

  // Legend
  const legendEl = document.getElementById('legendList');
  legendEl.innerHTML = '';
  if (categories.length === 0) {
    legendEl.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center;padding:12px 0">No expenses this month</p>';
  } else {
    categories.forEach(([cat, amt], i) => {
      const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
      legendEl.innerHTML += `
        <div class="legend-item">
          <div class="legend-left">
            <div class="legend-dot" style="background:${colors[i]}"></div>
            <span class="legend-cat">${escHtml(cat)}</span>
          </div>
          <div>
            <span class="legend-amt">${fmt(amt)}</span>
            <span class="legend-pct">${pct}%</span>
          </div>
        </div>`;
    });
  }

  // Bar chart — last 4 months
  const months = [];
  const incData = [];
  const expData = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth(); const y = d.getFullYear();
    months.push(d.toLocaleDateString('en-US', { month: 'short' }));
    const txns = state.transactions.filter(t => {
      const td = new Date(t.date);
      return td.getMonth() === m && td.getFullYear() === y;
    });
    incData.push(txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    expData.push(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  }

  if (barChart) barChart.destroy();
  const bCtx = document.getElementById('barChart').getContext('2d');
  barChart = new Chart(bCtx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incData, backgroundColor: 'rgba(163,230,53,0.7)', borderRadius: 8, borderSkipped: false },
        { label: 'Expenses', data: expData, backgroundColor: 'rgba(248,113,113,0.7)', borderRadius: 8, borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 700, easing: 'easeInOutQuart' },
      plugins: { legend: { labels: { color: 'var(--text2)', font: { family: 'DM Sans', size: 12 }, boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'var(--text3)', font: { family: 'DM Sans', size: 11 } }, border: { display: false } },
        y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'var(--text3)', font: { family: 'DM Sans', size: 11 }, callback: v => fmtShort(v) }, border: { display: false } }
      }
    }
  });
}

// ── Goals ─────────────────────────────────────────────────────────────
function renderGoals() {
  const list = document.getElementById('goalsList');
  const empty = document.getElementById('emptyGoals');
  list.innerHTML = '';

  if (state.goals.length === 0) {
    empty.classList.add('visible');
    return;
  }
  empty.classList.remove('visible');

  state.goals.forEach((g, i) => {
    const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
    const complete = pct >= 100;
    const el = document.createElement('div');
    el.className = 'goal-card' + (complete ? ' complete' : '');
    el.style.animationDelay = `${i * 60}ms`;
    el.innerHTML = `
      <div class="goal-header">
        <div class="goal-info">
          <div class="goal-emoji">${g.emoji || '🎯'}</div>
          <div>
            <div class="goal-name">${escHtml(g.name)}</div>
            <div class="goal-target">Target: ${fmt(g.target)}</div>
          </div>
        </div>
        <div class="goal-actions">
          <button class="goal-action-btn edit" data-id="${g.id}" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="goal-action-btn delete" data-id="${g.id}" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved">${fmt(g.saved)}</span>
        <span class="goal-pct">${pct}%${complete ? ' ✓' : ''}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" data-pct="${pct}" style="width:0%"></div>
      </div>`;

    el.querySelector('.edit').addEventListener('click', () => openEditGoal(g.id));
    el.querySelector('.delete').addEventListener('click', () => deleteGoal(g.id));
    list.appendChild(el);

    // Animate bar
    setTimeout(() => {
      const fill = el.querySelector('.progress-fill');
      if (fill) fill.style.width = pct + '%';
    }, 100 + i * 80);
  });
}

// ── Projection ────────────────────────────────────────────────────────
function renderProjection() {
  const { income, expenses } = getMonthStats();
  const net = income - expenses;
  const balance = getTotalBalance();

  document.getElementById('projNet').textContent = fmt(net);
  document.getElementById('proj6m').textContent = fmt(balance + net * 6);

  const months = [];
  const savingsData = [];
  const tbody = document.getElementById('projTableBody');
  tbody.innerHTML = '';

  for (let i = 1; i <= 6; i++) {
    const label = monthLabel(i);
    months.push(label.split(' ')[0]);
    const projected = balance + net * i;
    savingsData.push(projected);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${label}</td>
      <td style="color:var(--green2)">${fmt(income)}</td>
      <td style="color:var(--red)">${fmt(expenses)}</td>
      <td>${fmt(projected)}</td>`;
    tbody.appendChild(tr);
  }

  // Line chart
  if (lineChart) lineChart.destroy();
  const lCtx = document.getElementById('lineChart').getContext('2d');

  const gradient = lCtx.createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, 'rgba(124,58,237,0.3)');
  gradient.addColorStop(1, 'rgba(124,58,237,0)');

  lineChart = new Chart(lCtx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Projected Savings',
        data: savingsData,
        borderColor: '#7C3AED',
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointBackgroundColor: '#7C3AED',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 900, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'var(--text3)', font: { family: 'DM Sans', size: 11 } }, border: { display: false } },
        y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'var(--text3)', font: { family: 'DM Sans', size: 11 }, callback: v => fmtShort(v) }, border: { display: false } }
      }
    }
  });
}

// ── Navigation ────────────────────────────────────────────────────────
let currentPage = 'home';

function switchPage(pageId) {
  // Hide old
  document.getElementById('page-' + currentPage).classList.remove('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  currentPage = pageId;
  const page = document.getElementById('page-' + pageId);
  page.classList.add('active');

  const navBtn = document.querySelector(`[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');

  updateNavIndicator();

  // Lazy render
  if (pageId === 'home') renderDashboard();
  if (pageId === 'transactions') renderTransactions();
  if (pageId === 'analytics') renderAnalytics();
  if (pageId === 'goals') renderGoals();
  if (pageId === 'projection') renderProjection();

  // Scroll top
  document.querySelector('.page-container').scrollTop = 0;
}

function updateNavIndicator() {
  const navBtns = document.querySelectorAll('.nav-item');
  const indicator = document.getElementById('navIndicator');
  navBtns.forEach((btn, i) => {
    if (btn.classList.contains('active')) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = btn.parentElement.getBoundingClientRect();
      const left = btnRect.left - navRect.left + (btnRect.width / 2) - 20;
      indicator.style.left = left + 'px';
    }
  });
}

// ── Modal Helpers ─────────────────────────────────────────────────────
function openModal(type = 'income', txnId = null) {
  const modal = document.getElementById('txnModal');
  const backdrop = document.getElementById('modalBackdrop');

  // Set type
  currentTxnType = type;
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  // Reset form
  document.getElementById('txnId').value = txnId || '';
  document.getElementById('txnDesc').value = '';
  document.getElementById('txnAmount').value = '';
  document.getElementById('txnDate').value = todayStr();
  document.getElementById('txnCategory').value = type === 'income' ? 'Salary' : 'Food';
  document.getElementById('modalTitle').textContent = txnId ? 'Edit Transaction' : 'Add Transaction';

  if (txnId) {
    const t = state.transactions.find(t => t.id === txnId);
    if (t) {
      currentTxnType = t.type;
      document.querySelectorAll('.type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === t.type);
      });
      document.getElementById('txnDesc').value = t.description;
      document.getElementById('txnAmount').value = t.amount;
      document.getElementById('txnDate').value = t.date;
      document.getElementById('txnCategory').value = t.category;
    }
  }

  backdrop.classList.add('visible');
  requestAnimationFrame(() => {
    modal.classList.add('open');
    document.getElementById('fabBtn').classList.add('open');
  });
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.getElementById('modalBackdrop').classList.remove('visible');
  document.getElementById('fabBtn').classList.remove('open');
}

function openGoalModal(goalId = null) {
  const modal = document.getElementById('goalModal');
  const backdrop = document.getElementById('modalBackdrop');

  document.getElementById('goalId').value = goalId || '';
  document.getElementById('goalName').value = '';
  document.getElementById('goalTarget').value = '';
  document.getElementById('goalSaved').value = '';
  document.getElementById('goalModalTitle').textContent = goalId ? 'Edit Goal' : 'New Goal';
  selectedEmoji = '🎯';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.toggle('active', b.dataset.emoji === '🎯'));

  if (goalId) {
    const g = state.goals.find(g => g.id === goalId);
    if (g) {
      document.getElementById('goalName').value = g.name;
      document.getElementById('goalTarget').value = g.target;
      document.getElementById('goalSaved').value = g.saved;
      selectedEmoji = g.emoji || '🎯';
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.toggle('active', b.dataset.emoji === g.emoji));
    }
  }

  backdrop.classList.add('visible');
  requestAnimationFrame(() => modal.classList.add('open'));
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const backdrop = document.getElementById('modalBackdrop');
  document.getElementById('settingsName').value = state.name || '';
  document.getElementById('settingsSavings').value = state.currentSavings || '';
  backdrop.classList.add('visible');
  requestAnimationFrame(() => modal.classList.add('open'));
}

// ── Transaction CRUD ───────────────────────────────────────────────────
let currentTxnType = 'income';

function saveTxn() {
  const id = document.getElementById('txnId').value;
  const desc = document.getElementById('txnDesc').value.trim();
  const amount = parseFloat(document.getElementById('txnAmount').value);
  const date = document.getElementById('txnDate').value;
  const category = document.getElementById('txnCategory').value;

  if (!desc) { showToast('Please add a description', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
  if (!date) { showToast('Please select a date', 'error'); return; }

  if (id) {
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx > -1) {
      state.transactions[idx] = { ...state.transactions[idx], description: desc, amount, date, category, type: currentTxnType };
      showToast('Transaction updated', 'success');
    }
  } else {
    state.transactions.push({ id: genId(), type: currentTxnType, description: desc, amount, date, category });
    showToast('Transaction added', 'success');
  }

  saveState();
  closeModal('txnModal');
  renderCurrentPage();
}

function openEditTxn(id) { openModal(null, id); }

function deleteTxn(id) {
  if (!confirm('Delete this transaction?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  showToast('Transaction deleted', 'info');
  renderCurrentPage();
}

// ── Goal CRUD ──────────────────────────────────────────────────────────
let selectedEmoji = '🎯';

function saveGoal() {
  const id = document.getElementById('goalId').value;
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const saved = parseFloat(document.getElementById('goalSaved').value) || 0;

  if (!name) { showToast('Please enter a goal name', 'error'); return; }
  if (!target || target <= 0) { showToast('Please enter a valid target amount', 'error'); return; }

  if (id) {
    const idx = state.goals.findIndex(g => g.id === id);
    if (idx > -1) {
      state.goals[idx] = { ...state.goals[idx], name, target, saved, emoji: selectedEmoji };
      showToast('Goal updated', 'success');
    }
  } else {
    state.goals.push({ id: genId(), name, target, saved, emoji: selectedEmoji });
    showToast('Goal created! 🎯', 'success');
  }

  saveState();
  closeModal('goalModal');
  renderGoals();
}

function openEditGoal(id) { openGoalModal(id); }

function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  state.goals = state.goals.filter(g => g.id !== id);
  saveState();
  showToast('Goal deleted', 'info');
  renderGoals();
}

// ── Settings ───────────────────────────────────────────────────────────
function saveSettings() {
  const name = document.getElementById('settingsName').value.trim();
  const savings = parseFloat(document.getElementById('settingsSavings').value) || 0;
  state.name = name || 'User';
  state.currentSavings = savings;

  // Update avatar initials
  const initials = name ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'JS';
  document.querySelector('.avatar-btn span').textContent = initials;

  saveState();
  closeModal('settingsModal');
  showToast('Settings saved', 'success');
  if (currentPage === 'home') renderDashboard();
}

// ── Helpers ────────────────────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderCurrentPage() {
  if (currentPage === 'home') renderDashboard();
  else if (currentPage === 'transactions') renderTransactions();
  else if (currentPage === 'analytics') renderAnalytics();
  else if (currentPage === 'goals') renderGoals();
  else if (currentPage === 'projection') renderProjection();
}

// ── Toast ─────────────────────────────────────────────────────────────
const toastIcons = { success: '✅', error: '❌', info: 'ℹ️' };

function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${toastIcons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Theme ─────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('floTheme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  setTheme(theme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('floTheme', theme);
  document.getElementById('iconSun').style.display = theme === 'dark' ? 'block' : 'none';
  document.getElementById('iconMoon').style.display = theme === 'dark' ? 'none' : 'block';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
  if (currentPage === 'analytics') setTimeout(renderAnalytics, 100);
  if (currentPage === 'projection') setTimeout(renderProjection, 100);
}

// ── Event Listeners ────────────────────────────────────────────────────
function initEvents() {
  // Theme
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // FAB
  document.getElementById('fabBtn').addEventListener('click', () => openModal('expense'));

  // Transaction modal
  document.getElementById('closeTxnModal').addEventListener('click', () => closeModal('txnModal'));
  document.getElementById('saveTxnBtn').addEventListener('click', saveTxn);

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTxnType = btn.dataset.type;
      document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b === btn));
      // Update default category
      document.getElementById('txnCategory').value = currentTxnType === 'income' ? 'Salary' : 'Food';
    });
  });

  // Goal modal
  document.getElementById('openGoalModal').addEventListener('click', () => openGoalModal());
  document.getElementById('closeGoalModal').addEventListener('click', () => closeModal('goalModal'));
  document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);

  // Emoji picker
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEmoji = btn.dataset.emoji;
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Settings
  document.getElementById('openSettings').addEventListener('click', openSettingsModal);
  document.getElementById('closeSettingsModal').addEventListener('click', () => closeModal('settingsModal'));
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (!confirm('Clear all data? This cannot be undone.')) return;
    state = { currentSavings: 0, name: 'User', transactions: [], goals: [] };
    saveState();
    closeModal('settingsModal');
    renderCurrentPage();
    showToast('All data cleared', 'info');
  });

  // Filter pills
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      currentFilter = pill.dataset.filter;
      document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p === pill));
      renderTransactions();
    });
  });

  // Backdrop
  document.getElementById('modalBackdrop').addEventListener('click', () => {
    closeModal('txnModal');
    closeModal('goalModal');
    closeModal('settingsModal');
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('txnModal');
      closeModal('goalModal');
      closeModal('settingsModal');
    }
  });
}

// ── Sample Data ───────────────────────────────────────────────────────
function seedSampleData() {
  if (state.transactions.length > 0 || state.goals.length > 0) return;

  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const d = (offset = 0) => {
    const dt = new Date(y, m, now.getDate() - offset);
    return dt.toISOString().split('T')[0];
  };

  state.currentSavings = 3200;

  state.transactions = [
    { id: genId(), type: 'income',  description: 'Monthly Salary',    amount: 5500,  date: d(0),  category: 'Salary' },
    { id: genId(), type: 'income',  description: 'Freelance Project',  amount: 850,   date: d(3),  category: 'Freelance' },
    { id: genId(), type: 'expense', description: 'Apartment Rent',     amount: 1400,  date: d(1),  category: 'Rent' },
    { id: genId(), type: 'expense', description: 'Grocery Shopping',   amount: 124,   date: d(2),  category: 'Food' },
    { id: genId(), type: 'expense', description: 'Netflix & Spotify',  amount: 28,    date: d(4),  category: 'Entertainment' },
    { id: genId(), type: 'expense', description: 'Uber Rides',         amount: 67,    date: d(5),  category: 'Transport' },
    { id: genId(), type: 'expense', description: 'Electric Bill',      amount: 95,    date: d(6),  category: 'Utilities' },
    { id: genId(), type: 'expense', description: 'New Sneakers',       amount: 149,   date: d(7),  category: 'Shopping' },
    { id: genId(), type: 'income',  description: 'Dividend Payout',    amount: 210,   date: d(8),  category: 'Investment' },
    { id: genId(), type: 'expense', description: 'Dinner out',         amount: 78,    date: d(9),  category: 'Food' },
  ];

  state.goals = [
    { id: genId(), name: 'Emergency Fund',  emoji: '🛡️', target: 10000, saved: 4200 },
    { id: genId(), name: 'Japan Trip ✈️',   emoji: '✈️', target: 3500,  saved: 1800 },
    { id: genId(), name: 'New MacBook',     emoji: '💻', target: 2500,  saved: 2500 },
  ];

  saveState();
}

// ── Init ───────────────────────────────────────────────────────────────
function init() {
  loadState();
  seedSampleData();
  initTheme();
  initEvents();

  // Set today's date default
  document.getElementById('txnDate').value = todayStr();

  // Kick off home
  renderDashboard();

  // Nav indicator init
  setTimeout(updateNavIndicator, 50);

  // Set avatar initials
  if (state.name) {
    const initials = state.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    document.querySelector('.avatar-btn span').textContent = initials;
  }
}

window.addEventListener('DOMContentLoaded', init);

// expose for inline onclick
window.openModal = openModal;
window.switchPage = switchPage;
