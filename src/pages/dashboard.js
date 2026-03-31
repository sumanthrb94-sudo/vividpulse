/*!
 * Dashboard — Vivid Pulse CRM
 * Command centre: stats, pipeline overview, recent leads, revenue breakdown.
 * Protected by Firebase Auth. Data from Cloud Firestore.
 */
import '/src/style.css';
import { requireAuth, logout } from '/src/auth.js';
import { db } from '/src/firebase.js';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';

// ── Auth guard ────────────────────────────────────────────────────────────────
requireAuth('/login').then((user) => {
  // User info
  const emailEl = document.getElementById('sidebar-email');
  if (emailEl) emailEl.textContent = user.email || user.displayName || 'User';

  const greeting = document.getElementById('dash-greeting');
  if (greeting) {
    const name = user.displayName || user.email.split('@')[0];
    greeting.textContent = `Welcome back, ${name}`;
  }

  // Logout buttons
  ['sidebar-logout', 'topbar-logout'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () =>
      logout().then(() => { window.location.href = '/login'; })
    );
  });

  // Mobile sidebar toggle
  const sidebar      = document.getElementById('sidebar');
  const toggleBtn    = document.getElementById('sidebar-toggle');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) && e.target !== toggleBtn) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Subscribe to leads
  const leadsCol = collection(db, 'users', user.uid, 'leads');
  const q        = query(leadsCol, orderBy('date', 'desc'));
  onSnapshot(q, (snap) => {
    const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats(leads);
    renderPipeline(leads);
    renderRecentLeads(leads);
    renderRevenueBars(leads);
  });

  // Add lead modal
  initAddLeadModal(user.uid, leadsCol);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(0) + 'k';
  return '₹' + n;
}

function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STAGE_META = {
  new:       { label: 'New Lead',      color: '#22d3ee', badge: 'rgba(34,211,238,0.12)',  text: '#22d3ee' },
  contacted: { label: 'Contacted',     color: '#f59e0b', badge: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },
  proposal:  { label: 'Proposal Sent', color: '#a855f7', badge: 'rgba(168,85,247,0.12)',  text: '#a855f7' },
  won:       { label: 'Won',           color: '#10b981', badge: 'rgba(16,185,129,0.12)',   text: '#10b981' },
  lost:      { label: 'Lost',          color: '#ef4444', badge: 'rgba(239,68,68,0.12)',    text: '#ef4444' },
};

// ── Stats row ─────────────────────────────────────────────────────────────────
function renderStats(leads) {
  const total      = leads.length;
  const pipeline   = leads.filter(l => l.stage !== 'lost').reduce((s, l) => s + (l.value || 0), 0);
  const wonLeads   = leads.filter(l => l.stage === 'won');
  const closed     = leads.filter(l => l.stage === 'won' || l.stage === 'lost').length;
  const winRate    = closed > 0 ? Math.round((wonLeads.length / closed) * 100) : 0;
  const revenue    = wonLeads.reduce((s, l) => s + (l.value || 0), 0);

  document.getElementById('ds-total').textContent    = total;
  document.getElementById('ds-pipeline').textContent = fmt(pipeline);
  document.getElementById('ds-winrate').textContent  = winRate + '%';
  document.getElementById('ds-closed').textContent   = fmt(revenue);
}

// ── Pipeline overview bars ────────────────────────────────────────────────────
function renderPipeline(leads) {
  const container = document.getElementById('pipeline-stages');
  if (!container) return;

  const total = leads.length || 1;

  container.innerHTML = Object.entries(STAGE_META).map(([key, meta]) => {
    const count = leads.filter(l => l.stage === key).length;
    const pct   = Math.round((count / total) * 100);
    return `
      <div class="pipeline-stage-row">
        <div class="pipeline-stage-meta">
          <span class="pipeline-stage-name">${meta.label}</span>
          <span class="pipeline-stage-count">${count} lead${count !== 1 ? 's' : ''} · ${pct}%</span>
        </div>
        <div class="pipeline-bar-track">
          <div class="pipeline-bar-fill" style="width:${pct}%; background:${meta.color};"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Recent leads ──────────────────────────────────────────────────────────────
function renderRecentLeads(leads) {
  const container = document.getElementById('recent-leads');
  if (!container) return;

  const recent = leads.slice(0, 8);
  if (!recent.length) {
    container.innerHTML = `<p style="color:var(--text-dim); font-size:0.875rem; text-align:center; padding:1rem 0;">No leads yet. Add your first lead!</p>`;
    return;
  }

  container.innerHTML = recent.map(lead => {
    const m = STAGE_META[lead.stage] || STAGE_META.new;
    return `
      <div class="recent-lead-row">
        <div>
          <div class="recent-lead-name">${lead.name}</div>
          <div class="recent-lead-company">${lead.company || '—'} · ${fmtDate(lead.date)}</div>
        </div>
        <div style="display:flex; align-items:center; gap:0.6rem; flex-shrink:0;">
          <span class="recent-lead-value">${fmt(lead.value || 0)}</span>
          <span class="stage-badge" style="background:${m.badge}; color:${m.text};">${m.label}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Revenue breakdown bars ────────────────────────────────────────────────────
function renderRevenueBars(leads) {
  const container = document.getElementById('revenue-bars');
  if (!container) return;

  const stageValues = Object.entries(STAGE_META).map(([key, meta]) => ({
    key, meta,
    value: leads.filter(l => l.stage === key).reduce((s, l) => s + (l.value || 0), 0),
  }));

  const maxVal = Math.max(...stageValues.map(s => s.value), 1);

  container.innerHTML = stageValues.map(({ meta, value }) => {
    const heightPct = Math.round((value / maxVal) * 100);
    return `
      <div class="rev-bar-col">
        <div class="rev-bar-value">${value > 0 ? fmt(value) : '—'}</div>
        <div class="rev-bar-fill" style="height:${heightPct}%; background:${meta.color}; opacity:0.75;"></div>
        <div class="rev-bar-label">${meta.label}</div>
      </div>`;
  }).join('');
}

// ── Add Lead modal ────────────────────────────────────────────────────────────
function initAddLeadModal(uid, leadsCol) {
  const addBtn = document.getElementById('dash-add-lead');
  const modal  = document.getElementById('add-lead-modal');
  const close  = document.getElementById('modal-close');
  const form   = document.getElementById('add-lead-form');

  if (!addBtn || !modal) return;

  addBtn.addEventListener('click', () => modal.classList.add('open'));
  close.addEventListener('click',  () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = document.getElementById('lead-name').value.trim();
    const company = document.getElementById('lead-company').value.trim();
    const value   = parseInt(document.getElementById('lead-value').value) || 0;
    const stage   = document.getElementById('lead-stage').value;
    if (!name) return;

    const id = 'l' + Date.now();
    await setDoc(doc(leadsCol, id), {
      name, company: company || 'Unknown', value, stage,
      date: new Date().toISOString().split('T')[0],
    });
    form.reset();
    modal.classList.remove('open');
  });
}
