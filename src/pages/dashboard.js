/*!
 * Dashboard — Vivid Pulse
 * CRM Pipeline + Content Engine (fully functional)
 * Website Projects (demo/read-only)
 * sumanthbolla97@gmail.com → auto-seeded demo account
 */
import '/src/style.css';
import { requireAuth, logout } from '/src/auth.js';
import { db } from '/src/firebase.js';
import {
  collection, doc, setDoc, deleteDoc, getDoc,
  onSnapshot, query, orderBy, writeBatch,
} from 'firebase/firestore';

const DEMO_EMAIL  = 'sumanthbolla97@gmail.com';
const PRO_EMAILS  = ['sumanthrb94@gmail.com'];

// ── Demo seed data ────────────────────────────────────────────────────────────
const DEMO_LEADS = [
  { id: 'l1', name: 'Ankit Verma',    company: 'GrowFast Inc',   value: 75000,  stage: 'new',       date: '2026-03-28', dueDate: '2026-04-02' },
  { id: 'l2', name: 'Pooja Singh',    company: 'Bloom Studio',   value: 35000,  stage: 'contacted', date: '2026-03-25', dueDate: '2026-04-01' },
  { id: 'l3', name: 'Rajesh Nair',    company: 'TechMinds',      value: 120000, stage: 'proposal',  date: '2026-03-20', dueDate: '2026-03-30' },
  { id: 'l4', name: 'Divya Patel',    company: 'ShopKart',       value: 55000,  stage: 'won',       date: '2026-03-15' },
  { id: 'l5', name: 'Farhan Qureshi', company: 'MediaPeak',      value: 90000,  stage: 'contacted', date: '2026-03-22', dueDate: '2026-04-03' },
  { id: 'l6', name: 'Sneha Reddy',    company: 'DesignSync',     value: 42000,  stage: 'new',       date: '2026-03-30' },
  { id: 'l7', name: 'Vikram Goel',    company: 'RealEdge Homes', value: 200000, stage: 'proposal',  date: '2026-03-18', dueDate: '2026-03-28' },
  { id: 'l8', name: 'Aarav Khanna',   company: 'SwiftHire',      value: 28000,  stage: 'lost',      date: '2026-03-10' },
];

const DEMO_PROJECTS = [
  { id: 'p1', name: 'GrowFast Inc',   type: 'Business Website', status: 'completed',   progress: 100, value: 29999, dueDate: '2026-03-15' },
  { id: 'p2', name: 'Bloom Studio',   type: 'Landing Page',     status: 'in_progress', progress: 65,  value: 12999, dueDate: '2026-04-05' },
  { id: 'p3', name: 'ShopKart',       type: 'E-commerce Store', status: 'revision',    progress: 85,  value: 64999, dueDate: '2026-04-20' },
  { id: 'p4', name: 'RealEdge Homes', type: 'Landing Page',     status: 'pending',     progress: 10,  value: 12999, dueDate: '2026-05-01' },
];

const DEMO_CONTENT_ITEMS = [
  { id: 'c1', title: '5 CRM Mistakes Small Businesses Make', platform: 'youtube', type: 'video',   status: 'published', date: '2026-03-20' },
  { id: 'c2', title: 'How We 3x\'d a Client\'s Leads in 30 Days', platform: 'instagram', type: 'reel', status: 'published', date: '2026-03-25' },
  { id: 'c3', title: 'Website vs Landing Page — Which Do You Need?', platform: 'both', type: 'reel', status: 'editing', date: '2026-04-02' },
  { id: 'c4', title: 'Client Onboarding Process Walkthrough', platform: 'youtube', type: 'video', status: 'production', date: '2026-04-05' },
  { id: 'c5', title: 'Behind the Scenes — Agency Life', platform: 'instagram', type: 'story', status: 'planned', date: '2026-04-08' },
];

const DEMO_STATS = {
  instagram: { followers: 12400, postsThisMonth: 12, scheduled: 4, growth: '+8.3%' },
  youtube:   { subscribers: 3200, videosThisMonth: 3, views: 48000, growth: '+12.1%' },
};

// ── Auth guard ────────────────────────────────────────────────────────────────
requireAuth('/login').then(async (user) => {
  const isDemo = user.email === DEMO_EMAIL;
  const isPro  = PRO_EMAILS.includes(user.email);

  // User info
  const emailEl = document.getElementById('sidebar-email');
  if (emailEl) emailEl.textContent = user.email || user.displayName || 'User';

  const greeting = document.getElementById('dash-greeting');
  if (greeting) {
    const name = user.displayName || user.email.split('@')[0];
    greeting.textContent = `Welcome back, ${name}`;
  }

  if (isDemo) {
    const badge = document.createElement('span');
    badge.textContent = 'Demo';
    badge.style.cssText = 'font-size:0.65rem;font-weight:700;padding:0.18rem 0.55rem;border-radius:99px;background:rgba(168,85,247,0.15);color:var(--secondary);border:1px solid rgba(168,85,247,0.3);margin-left:0.5rem;vertical-align:middle;';
    document.querySelector('.dash-title').appendChild(badge);
  }

  // Pro badge + Content Studio button
  if (isPro) {
    const titleEl = document.querySelector('.dash-title');
    if (titleEl) {
      const badge = document.createElement('span');
      badge.textContent = 'Pro';
      badge.style.cssText = 'font-size:0.65rem;font-weight:700;padding:0.18rem 0.55rem;border-radius:99px;background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);margin-left:0.5rem;vertical-align:middle;';
      titleEl.appendChild(badge);
    }
    const studioBtn = document.getElementById('studio-btn');
    if (studioBtn) studioBtn.style.display = '';
  }

  // Logout
  ['sidebar-logout', 'topbar-logout'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () =>
      logout().then(() => { window.location.href = '/login'; })
    );
  });

  // Mobile sidebar
  const sidebar   = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggleBtn)
        sidebar.classList.remove('open');
    });
  }

  // Firestore refs
  const leadsCol       = collection(db, 'users', user.uid, 'leads');
  const projectsCol    = collection(db, 'users', user.uid, 'projects');
  const contentItemsCol = collection(db, 'users', user.uid, 'contentItems');
  const statsRef       = doc(db, 'users', user.uid, 'meta', 'platformStats');

  // Seed demo on first visit
  if (isDemo) await seedDemoUser(user.uid, leadsCol, projectsCol, contentItemsCol, statsRef);

  // ── Live listeners ──────────────────────────────────────────────────────────

  // CRM leads
  onSnapshot(query(leadsCol, orderBy('date', 'desc')), snap => {
    const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats(leads);
    renderPipeline(leads);
    renderRecentLeads(leads);
    renderRevenueBars(leads);
    renderOverdueAlert(leads);
    // wire CSV export
    document.getElementById('export-csv-btn').onclick = () => exportCSV(leads);
  });

  // Website projects
  onSnapshot(projectsCol, snap => {
    const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProjects(projects);
  });

  // Content items
  onSnapshot(query(contentItemsCol, orderBy('date', 'desc')), snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderContentItems(items);
  });

  // Platform stats
  onSnapshot(statsRef, snap => {
    if (snap.exists()) renderStatsSummary(snap.data());
  });

  // Embed section
  initEmbedSection(user.uid);

  // Add Lead modal
  initAddLeadModal(leadsCol);

  // Content modals
  initContentModal(contentItemsCol);
  initStatsModal(statsRef);

  // Project modal
  initProjectModal(projectsCol);
});

// ── Demo seeding ──────────────────────────────────────────────────────────────
async function seedDemoUser(uid, leadsCol, projectsCol, contentItemsCol, statsRef) {
  const sentinel = doc(db, 'users', uid, 'meta', 'seeded_v2');
  const snap = await getDoc(sentinel);
  if (snap.exists()) return;

  const batch = writeBatch(db);
  DEMO_LEADS.forEach(({ id, ...d }) => batch.set(doc(leadsCol, id), d));
  DEMO_PROJECTS.forEach(({ id, ...d }) => batch.set(doc(projectsCol, id), d));
  DEMO_CONTENT_ITEMS.forEach(({ id, ...d }) => batch.set(doc(contentItemsCol, id), d));
  batch.set(statsRef, DEMO_STATS);
  batch.set(sentinel, { at: new Date().toISOString() });
  await batch.commit();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

function fmt(n) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(0) + 'k';
  return '₹' + n;
}

function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STAGE_META = {
  new:       { label: 'New',      color: '#22d3ee', bg: 'rgba(34,211,238,0.12)'  },
  contacted: { label: 'Contacted',color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  proposal:  { label: 'Proposal', color: '#a855f7', bg: 'rgba(168,85,247,0.12)'  },
  won:       { label: 'Won',      color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  lost:      { label: 'Lost',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};

const CONTENT_STATUS = {
  planned:    { label: 'Planned',       color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  scripting:  { label: 'Scripting',     color: '#22d3ee', bg: 'rgba(34,211,238,0.12)'  },
  production: { label: 'In Production', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  editing:    { label: 'Editing',       color: '#a855f7', bg: 'rgba(168,85,247,0.12)'  },
  published:  { label: 'Published',     color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
};

const PLATFORM_ICON = { instagram: '📸', youtube: '▶', both: '🎯' };

// ── Stats row ─────────────────────────────────────────────────────────────────
function renderStats(leads) {
  const total    = leads.length;
  const pipeline = leads.filter(l => l.stage !== 'lost').reduce((s, l) => s + (l.value || 0), 0);
  const wonLeads = leads.filter(l => l.stage === 'won');
  const closed   = leads.filter(l => l.stage === 'won' || l.stage === 'lost').length;
  const winRate  = closed > 0 ? Math.round((wonLeads.length / closed) * 100) : 0;
  const revenue  = wonLeads.reduce((s, l) => s + (l.value || 0), 0);
  document.getElementById('ds-total').textContent    = total;
  document.getElementById('ds-pipeline').textContent = fmt(pipeline);
  document.getElementById('ds-winrate').textContent  = winRate + '%';
  document.getElementById('ds-closed').textContent   = fmt(revenue);

  // New leads badge on CRM card
  const newCount = leads.filter(l => l.stage === 'new').length;
  const badge    = document.getElementById('new-leads-badge');
  if (badge) {
    if (newCount > 0) {
      badge.textContent  = newCount + ' new';
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

// ── Overdue alert ─────────────────────────────────────────────────────────────
function renderOverdueAlert(leads) {
  const alert    = document.getElementById('overdue-alert');
  const alertTxt = document.getElementById('overdue-text');
  const overdue  = leads.filter(l => l.dueDate && l.dueDate < TODAY && l.stage !== 'won' && l.stage !== 'lost');
  const dueToday = leads.filter(l => l.dueDate === TODAY && l.stage !== 'won' && l.stage !== 'lost');
  if (!alert) return;
  if (overdue.length || dueToday.length) {
    const parts = [];
    if (overdue.length)  parts.push(`⚠ ${overdue.length} lead${overdue.length > 1 ? 's' : ''} overdue`);
    if (dueToday.length) parts.push(`📅 ${dueToday.length} due today`);
    alertTxt.textContent = parts.join(' · ');
    alert.style.display = 'flex';
  } else {
    alert.style.display = 'none';
  }
}

// ── Pipeline overview ─────────────────────────────────────────────────────────
function renderPipeline(leads) {
  const el = document.getElementById('pipeline-stages');
  if (!el) return;
  const total = leads.length || 1;
  el.innerHTML = Object.entries(STAGE_META).map(([key, m]) => {
    const count = leads.filter(l => l.stage === key).length;
    const pct   = Math.round((count / total) * 100);
    return `<div class="pipeline-stage-row">
      <div class="pipeline-stage-meta">
        <span class="pipeline-stage-name">${m.label}</span>
        <span class="pipeline-stage-count">${count} · ${pct}%</span>
      </div>
      <div class="pipeline-bar-track">
        <div class="pipeline-bar-fill" style="width:${pct}%;background:${m.color};"></div>
      </div>
    </div>`;
  }).join('');
}

// ── Recent leads ──────────────────────────────────────────────────────────────
function renderRecentLeads(leads) {
  const el = document.getElementById('recent-leads');
  if (!el) return;
  const recent = leads.slice(0, 5);
  if (!recent.length) { el.innerHTML = `<div class="dash-empty">No leads yet.</div>`; return; }
  el.innerHTML = recent.map(l => {
    const m   = STAGE_META[l.stage] || STAGE_META.new;
    const isOverdue = l.dueDate && l.dueDate < TODAY && l.stage !== 'won' && l.stage !== 'lost';
    return `<div class="recent-lead-row">
      <div>
        <div class="recent-lead-name">${l.name}${isOverdue ? ' <span style="color:#ef4444;font-size:0.7rem;">⚠</span>' : ''}</div>
        <div class="recent-lead-company">${l.company || '—'}${l.dueDate ? ' · Due ' + fmtDate(l.dueDate) : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">
        <span class="recent-lead-value">${fmt(l.value || 0)}</span>
        <span class="stage-badge" style="background:${m.bg};color:${m.color};">${m.label}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Revenue bars ──────────────────────────────────────────────────────────────
function renderRevenueBars(leads) {
  const el = document.getElementById('revenue-bars');
  if (!el) return;
  const vals   = Object.entries(STAGE_META).map(([k, m]) => ({ m, v: leads.filter(l => l.stage === k).reduce((s, l) => s + (l.value || 0), 0) }));
  const maxVal = Math.max(...vals.map(x => x.v), 1);
  el.innerHTML = vals.map(({ m, v }) => `
    <div class="rev-bar-col">
      <div class="rev-bar-value">${v > 0 ? fmt(v) : '—'}</div>
      <div class="rev-bar-fill" style="height:${Math.round((v/maxVal)*100)}%;background:${m.color};opacity:0.75;"></div>
      <div class="rev-bar-label">${m.label}</div>
    </div>`).join('');
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(leads) {
  const headers = ['Name', 'Company', 'Value (₹)', 'Stage', 'Added Date', 'Due Date', 'Notes'];
  const rows    = leads.map(l => [
    l.name, l.company || '', l.value || 0, l.stage,
    l.date, l.dueDate || '',
    (l.notes || []).map(n => n.text).join(' | '),
  ]);
  const csv  = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `vivid-pulse-leads-${TODAY}.csv`;
  a.click();
}

// ── Website projects ──────────────────────────────────────────────────────────
function renderProjects(projects) {
  const el = document.getElementById('projects-list');
  if (!el) return;
  if (!projects.length) {
    el.innerHTML = `<div class="dash-empty">No projects yet.<br><span style="color:var(--text-dim);">Click "+ Add" to track a project.</span></div>`;
    return;
  }
  const labels = { completed: 'Completed', in_progress: 'In Progress', revision: 'Revision', pending: 'Pending', on_hold: 'On Hold' };
  el.innerHTML = projects.map(p => `
    <div class="project-item">
      <div class="project-meta">
        <div>
          <div class="project-name">${p.name}</div>
          <div class="project-type">${p.type}${p.value ? ' · ' + fmt(p.value) : ''}${p.dueDate ? ' · Due ' + fmtDate(p.dueDate) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">
          <span class="project-status status-${p.status}">${labels[p.status] || p.status}</span>
          <button class="proj-edit-btn" data-id="${p.id}" title="Update progress" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.78rem;padding:0.1rem 0.3rem;" >✎</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.4rem;">
        <div class="project-progress-track" style="flex:1;">
          <div class="project-progress-fill" style="width:${p.progress || 0}%;"></div>
        </div>
        <span style="font-size:0.72rem;color:var(--text-dim);flex-shrink:0;min-width:2rem;text-align:right;">${p.progress || 0}%</span>
      </div>
      ${p.notes ? `<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.35rem;padding-top:0.35rem;border-top:1px solid var(--glass-border);">${p.notes}</div>` : ''}
    </div>`).join('');

  // wire edit buttons
  el.querySelectorAll('.proj-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = projects.find(x => x.id === btn.dataset.id);
      if (p) window._openProjectModal && window._openProjectModal(p);
    });
  });
}

// ── Platform stats summary ────────────────────────────────────────────────────
function renderStatsSummary(stats) {
  const el = document.getElementById('content-stats-summary');
  if (!el || !stats) return;
  const ig = stats.instagram || {};
  const yt = stats.youtube   || {};
  el.style.display = '';
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
      <div style="background:rgba(236,72,153,0.06);border:1px solid rgba(236,72,153,0.2);border-radius:var(--radius-sm);padding:0.75rem;text-align:center;">
        <div style="font-size:0.65rem;color:var(--ig-pink);font-weight:700;margin-bottom:0.35rem;">📸 INSTAGRAM</div>
        <div style="font-family:var(--font-heading);font-size:1.3rem;font-weight:700;color:var(--ig-pink);">${fmtNum(ig.followers || 0)}</div>
        <div style="font-size:0.65rem;color:var(--text-dim);">followers</div>
        <div style="font-size:0.72rem;color:var(--web-green);margin-top:0.25rem;font-weight:600;">${ig.growth || ''}</div>
      </div>
      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-sm);padding:0.75rem;text-align:center;">
        <div style="font-size:0.65rem;color:var(--yt-red);font-weight:700;margin-bottom:0.35rem;">▶ YOUTUBE</div>
        <div style="font-family:var(--font-heading);font-size:1.3rem;font-weight:700;color:var(--yt-red);">${fmtNum(yt.subscribers || 0)}</div>
        <div style="font-size:0.65rem;color:var(--text-dim);">subscribers · ${fmtNum(yt.views || 0)} views</div>
        <div style="font-size:0.72rem;color:var(--web-green);margin-top:0.25rem;font-weight:600;">${yt.growth || ''}</div>
      </div>
    </div>`;
}

// ── Content items list ────────────────────────────────────────────────────────
function renderContentItems(items) {
  const el = document.getElementById('content-items-list');
  if (!el) return;

  // Pipeline counts
  const countsEl = document.getElementById('content-pipeline-counts');
  if (countsEl && items.length > 0) {
    const counts = {};
    items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    countsEl.innerHTML = Object.entries(CONTENT_STATUS).map(([key, meta]) => {
      const n = counts[key] || 0;
      if (!n) return '';
      return `<span style="background:${meta.bg};color:${meta.color};font-size:0.68rem;font-weight:600;padding:0.2rem 0.5rem;border-radius:99px;border:1px solid ${meta.color}33;">${meta.label} ${n}</span>`;
    }).join('');
  } else if (countsEl) {
    countsEl.innerHTML = '';
  }

  if (!items.length) {
    el.innerHTML = `<div class="dash-empty">No content pieces yet.<br><span style="color:var(--text-dim);">Click "+ Add" to track your first piece.</span></div>`;
    return;
  }
  el.innerHTML = items.map(item => {
    const s = CONTENT_STATUS[item.status] || CONTENT_STATUS.planned;
    return `<div class="content-item-row" data-id="${item.id}">
      <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
        <span style="font-size:1rem;flex-shrink:0;">${PLATFORM_ICON[item.platform] || '🎬'}</span>
        <div style="min-width:0;">
          <div class="content-item-title">${item.title}</div>
          <div class="content-item-meta">${item.type || ''}${item.date ? ' · ' + fmtDate(item.date) : ''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">
        <span class="stage-badge" style="background:${s.bg};color:${s.color};">${s.label}</span>
        <button class="content-edit-btn" data-id="${item.id}" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.75rem;padding:0.1rem 0.3rem;" title="Edit">✎</button>
        <button class="content-del-btn" data-id="${item.id}" style="background:none;border:none;color:rgba(239,68,68,0.5);cursor:pointer;font-size:0.75rem;padding:0.1rem 0.3rem;" title="Delete">✕</button>
      </div>
    </div>`;
  }).join('');

  // Wire edit/delete buttons — they need access to items array
  el.querySelectorAll('.content-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      window._deleteContentItem && window._deleteContentItem(id);
    });
  });
  el.querySelectorAll('.content-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items.find(i => i.id === btn.dataset.id);
      if (item) window._openContentModal && window._openContentModal(item);
    });
  });
}

// ── Content modal (Add / Edit) ────────────────────────────────────────────────
function initContentModal(contentItemsCol) {
  const modal   = document.getElementById('add-content-modal');
  const closeBtn = document.getElementById('content-modal-close');
  const form    = document.getElementById('add-content-form');
  const addBtn  = document.getElementById('add-content-btn');
  if (!modal) return;

  function openModal(item = null) {
    document.getElementById('content-modal-title').textContent = item ? '✎ Edit Content' : '🎬 Add Content Piece';
    document.getElementById('content-edit-id').value    = item?.id || '';
    document.getElementById('c-title').value            = item?.title || '';
    document.getElementById('c-platform').value         = item?.platform || 'instagram';
    document.getElementById('c-type').value             = item?.type || 'reel';
    document.getElementById('c-status').value           = item?.status || 'planned';
    document.getElementById('c-date').value             = item?.date || '';
    document.getElementById('c-notes').value            = item?.notes || '';
    modal.classList.add('open');
  }

  window._openContentModal = openModal;
  addBtn.addEventListener('click', () => openModal());
  closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('content-edit-id').value;
    const id     = editId || 'ci' + Date.now();
    await setDoc(doc(contentItemsCol, id), {
      title:    document.getElementById('c-title').value.trim(),
      platform: document.getElementById('c-platform').value,
      type:     document.getElementById('c-type').value,
      status:   document.getElementById('c-status').value,
      date:     document.getElementById('c-date').value || new Date().toISOString().split('T')[0],
      notes:    document.getElementById('c-notes').value.trim(),
    });
    modal.classList.remove('open');
    form.reset();
  });

  window._deleteContentItem = async (id) => {
    await deleteDoc(doc(contentItemsCol, id));
  };
}

// ── Platform stats modal ──────────────────────────────────────────────────────
function initStatsModal(statsRef) {
  const modal     = document.getElementById('stats-modal');
  const closeBtn  = document.getElementById('stats-modal-close');
  const form      = document.getElementById('stats-form');
  const updateBtn = document.getElementById('update-stats-btn');
  if (!modal) return;

  updateBtn.addEventListener('click', () => modal.classList.add('open'));
  closeBtn.addEventListener('click',  () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    await setDoc(statsRef, {
      instagram: {
        followers:      parseInt(document.getElementById('s-ig-followers').value) || 0,
        postsThisMonth: parseInt(document.getElementById('s-ig-posts').value) || 0,
        growth:         document.getElementById('s-ig-growth').value.trim(),
      },
      youtube: {
        subscribers:     parseInt(document.getElementById('s-yt-subs').value) || 0,
        videosThisMonth: parseInt(document.getElementById('s-yt-videos').value) || 0,
        views:           parseInt(document.getElementById('s-yt-views').value) || 0,
        growth:          document.getElementById('s-yt-growth').value.trim(),
      },
    });
    modal.classList.remove('open');
  });
}

// ── Project modal (Add / Edit) ────────────────────────────────────────────────
function initProjectModal(projectsCol) {
  const modal    = document.getElementById('project-modal');
  const closeBtn = document.getElementById('project-modal-close');
  const cancelBtn = document.getElementById('proj-cancel-btn');
  const form     = document.getElementById('project-form');
  const addBtn   = document.getElementById('add-project-btn');
  const slider   = document.getElementById('proj-progress');
  const sliderVal = document.getElementById('proj-progress-val');
  if (!modal) return;

  slider?.addEventListener('input', () => { sliderVal.textContent = slider.value; });

  function openModal(project = null) {
    document.getElementById('project-modal-title').textContent = project ? '✎ Update Project' : '🌐 Add Project';
    document.getElementById('project-edit-id').value  = project?.id  || '';
    document.getElementById('proj-name').value        = project?.name || '';
    document.getElementById('proj-type').value        = project?.type || 'Landing Page';
    document.getElementById('proj-status').value      = project?.status || 'pending';
    document.getElementById('proj-value').value       = project?.value || '';
    document.getElementById('proj-due').value         = project?.dueDate || '';
    document.getElementById('proj-notes').value       = project?.notes || '';
    const prog = project?.progress || 0;
    slider.value        = prog;
    sliderVal.textContent = prog;
    modal.classList.add('open');
  }

  window._openProjectModal = openModal;
  addBtn?.addEventListener('click', () => openModal());
  closeBtn?.addEventListener('click', () => modal.classList.remove('open'));
  cancelBtn?.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = document.getElementById('project-edit-id').value;
    const data = {
      name:     document.getElementById('proj-name').value.trim(),
      type:     document.getElementById('proj-type').value,
      status:   document.getElementById('proj-status').value,
      progress: Number(slider.value),
      value:    Number(document.getElementById('proj-value').value) || 0,
      dueDate:  document.getElementById('proj-due').value,
      notes:    document.getElementById('proj-notes').value.trim(),
    };

    const saveBtn = document.getElementById('proj-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      const docRef = id ? doc(projectsCol, id) : doc(projectsCol);
      await setDoc(docRef, data, { merge: true });
      modal.classList.remove('open');
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Project';
    }
  });
}

// ── Lead capture form embed ───────────────────────────────────────────────────
function initEmbedSection(uid) {
  const base      = window.location.origin;
  const formUrl   = `${base}/form?u=${uid}`;
  const embedCode = `<iframe src="${formUrl}" width="100%" height="640" style="border:none;border-radius:16px;" loading="lazy"></iframe>`;
  const linkInput  = document.getElementById('form-link');
  const embedInput = document.getElementById('embed-code');
  const openBtn    = document.getElementById('open-form-btn');
  const copyLink   = document.getElementById('copy-link-btn');
  const copyEmbed  = document.getElementById('copy-embed-btn');
  if (linkInput)  linkInput.value = formUrl;
  if (embedInput) embedInput.value = embedCode;
  if (openBtn)    openBtn.href = formUrl;
  function cp(text, btn, label) {
    navigator.clipboard.writeText(text).then(() => { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = label; }, 2000); });
  }
  if (copyLink)  copyLink.addEventListener('click',  () => cp(formUrl,   copyLink,  'Copy Link'));
  if (copyEmbed) copyEmbed.addEventListener('click', () => cp(embedCode, copyEmbed, 'Copy Code'));
}

// ── Add Lead modal ────────────────────────────────────────────────────────────
function initAddLeadModal(leadsCol) {
  const addBtn = document.getElementById('dash-add-lead');
  const modal  = document.getElementById('add-lead-modal');
  const close  = document.getElementById('modal-close');
  const form   = document.getElementById('add-lead-form');
  if (!addBtn || !modal) return;
  addBtn.addEventListener('click', () => modal.classList.add('open'));
  close.addEventListener('click',  () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name    = document.getElementById('lead-name').value.trim();
    const company = document.getElementById('lead-company').value.trim();
    const value   = parseInt(document.getElementById('lead-value').value) || 0;
    const stage   = document.getElementById('lead-stage').value;
    if (!name) return;
    await setDoc(doc(leadsCol, 'l' + Date.now()), {
      name, company: company || 'Unknown', value, stage,
      date: new Date().toISOString().split('T')[0],
    });
    form.reset();
    modal.classList.remove('open');
  });
}
