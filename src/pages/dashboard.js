/*!
 * Dashboard — Vivid Pulse CRM
 * Shows all 3 services: CRM Pipeline, Website Projects, Content Engine.
 * sumanthbolla97@gmail.com is the demo account — auto-seeded with rich data.
 */
import '/src/style.css';
import { requireAuth, logout } from '/src/auth.js';
import { db } from '/src/firebase.js';
import {
  collection, doc, setDoc, getDoc, onSnapshot,
  query, orderBy, writeBatch,
} from 'firebase/firestore';

const DEMO_EMAIL = 'sumanthbolla97@gmail.com';

// ── Demo seed data ────────────────────────────────────────────────────────────
const DEMO_LEADS = [
  { id: 'l1', name: 'Ankit Verma',    company: 'GrowFast Inc',   value: 75000,  stage: 'new',       date: '2026-03-28' },
  { id: 'l2', name: 'Pooja Singh',    company: 'Bloom Studio',   value: 35000,  stage: 'contacted', date: '2026-03-25' },
  { id: 'l3', name: 'Rajesh Nair',    company: 'TechMinds',      value: 120000, stage: 'proposal',  date: '2026-03-20' },
  { id: 'l4', name: 'Divya Patel',    company: 'ShopKart',       value: 55000,  stage: 'won',       date: '2026-03-15' },
  { id: 'l5', name: 'Farhan Qureshi', company: 'MediaPeak',      value: 90000,  stage: 'contacted', date: '2026-03-22' },
  { id: 'l6', name: 'Sneha Reddy',    company: 'DesignSync',     value: 42000,  stage: 'new',       date: '2026-03-30' },
  { id: 'l7', name: 'Vikram Goel',    company: 'RealEdge Homes', value: 200000, stage: 'proposal',  date: '2026-03-18' },
  { id: 'l8', name: 'Aarav Khanna',   company: 'SwiftHire',      value: 28000,  stage: 'lost',      date: '2026-03-10' },
];

const DEMO_PROJECTS = [
  { id: 'p1', name: 'GrowFast Inc',   type: 'Business Website', status: 'completed',   progress: 100, value: 29999, dueDate: '2026-03-15' },
  { id: 'p2', name: 'Bloom Studio',   type: 'Landing Page',     status: 'in_progress', progress: 65,  value: 12999, dueDate: '2026-04-05' },
  { id: 'p3', name: 'ShopKart',       type: 'E-commerce Store', status: 'revision',    progress: 85,  value: 64999, dueDate: '2026-04-20' },
  { id: 'p4', name: 'RealEdge Homes', type: 'Landing Page',     status: 'pending',     progress: 10,  value: 12999, dueDate: '2026-05-01' },
];

const DEMO_CONTENT = {
  instagram: { followers: 12400, postsThisMonth: 12, scheduled: 4, growth: '+8.3%' },
  youtube:   { subscribers: 3200, videosThisMonth: 3, views: 48000, growth: '+12.1%' },
  published: 11, inDraft: 4, totalPieces: 15,
};

// ── Auth guard ────────────────────────────────────────────────────────────────
requireAuth('/login').then(async (user) => {
  const isDemo = user.email === DEMO_EMAIL;

  // Sidebar / topbar user info
  const emailEl = document.getElementById('sidebar-email');
  if (emailEl) emailEl.textContent = user.email || user.displayName || 'User';

  const greeting = document.getElementById('dash-greeting');
  if (greeting) {
    const name = user.displayName || user.email.split('@')[0];
    greeting.textContent = `Welcome back, ${name}`;
  }

  // Demo badge
  if (isDemo) {
    const badge = document.createElement('span');
    badge.textContent = 'Demo Account';
    badge.style.cssText = 'font-size:0.65rem;font-weight:700;padding:0.18rem 0.55rem;border-radius:99px;background:rgba(168,85,247,0.15);color:var(--secondary);border:1px solid rgba(168,85,247,0.3);margin-left:0.5rem;';
    document.querySelector('.dash-title').appendChild(badge);
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
  const leadsCol    = collection(db, 'users', user.uid, 'leads');
  const projectsCol = collection(db, 'users', user.uid, 'projects');
  const contentRef  = doc(db, 'users', user.uid, 'meta', 'content');

  // Seed demo user on first visit
  if (isDemo) await seedDemoUser(user.uid, leadsCol, projectsCol, contentRef);

  // Live CRM leads
  onSnapshot(query(leadsCol, orderBy('date', 'desc')), snap => {
    const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStats(leads);
    renderPipeline(leads);
    renderRecentLeads(leads);
    renderRevenueBars(leads);
  });

  // Live website projects
  onSnapshot(projectsCol, snap => {
    const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProjects(projects);
  });

  // Content stats (one-time read + live)
  onSnapshot(contentRef, snap => {
    if (snap.exists()) renderContent(snap.data());
  });

  // Plan accordion
  document.querySelectorAll('.plan-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = document.getElementById(btn.dataset.target);
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      btn.classList.toggle('open', !open);
    });
  });

  // Embed section
  initEmbedSection(user.uid);

  // Add Lead modal
  initAddLeadModal(leadsCol);
});

// ── Demo seeding ──────────────────────────────────────────────────────────────
async function seedDemoUser(uid, leadsCol, projectsCol, contentRef) {
  // Check if already seeded
  const sentinel = doc(db, 'users', uid, 'meta', 'seeded');
  const snap = await getDoc(sentinel);
  if (snap.exists()) return;

  const batch = writeBatch(db);

  // Leads
  DEMO_LEADS.forEach(l => {
    const { id, ...data } = l;
    batch.set(doc(leadsCol, id), data);
  });

  // Projects
  DEMO_PROJECTS.forEach(p => {
    const { id, ...data } = p;
    batch.set(doc(projectsCol, id), data);
  });

  // Content stats
  batch.set(contentRef, DEMO_CONTENT);

  // Sentinel
  batch.set(sentinel, { at: new Date().toISOString() });

  await batch.commit();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(0) + 'k';
  return '₹' + n;
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n;
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
}

// ── Pipeline overview ─────────────────────────────────────────────────────────
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
          <span class="pipeline-stage-count">${count} · ${pct}%</span>
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
  const recent = leads.slice(0, 5);
  if (!recent.length) {
    container.innerHTML = `<div class="dash-empty">No leads yet.</div>`;
    return;
  }
  container.innerHTML = recent.map(lead => {
    const m = STAGE_META[lead.stage] || STAGE_META.new;
    return `
      <div class="recent-lead-row">
        <div>
          <div class="recent-lead-name">${lead.name}</div>
          <div class="recent-lead-company">${lead.company || '—'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">
          <span class="recent-lead-value">${fmt(lead.value || 0)}</span>
          <span class="stage-badge" style="background:${m.badge};color:${m.text};">${m.label}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Revenue bars ──────────────────────────────────────────────────────────────
function renderRevenueBars(leads) {
  const container = document.getElementById('revenue-bars');
  if (!container) return;
  const stageValues = Object.entries(STAGE_META).map(([key, meta]) => ({
    meta, value: leads.filter(l => l.stage === key).reduce((s, l) => s + (l.value || 0), 0),
  }));
  const maxVal = Math.max(...stageValues.map(s => s.value), 1);
  container.innerHTML = stageValues.map(({ meta, value }) => {
    const h = Math.round((value / maxVal) * 100);
    return `
      <div class="rev-bar-col">
        <div class="rev-bar-value">${value > 0 ? fmt(value) : '—'}</div>
        <div class="rev-bar-fill" style="height:${h}%; background:${meta.color}; opacity:0.75;"></div>
        <div class="rev-bar-label">${meta.label}</div>
      </div>`;
  }).join('');
}

// ── Website projects ──────────────────────────────────────────────────────────
function renderProjects(projects) {
  const container = document.getElementById('projects-list');
  if (!container) return;

  if (!projects.length) {
    container.innerHTML = `<div class="dash-empty">No projects yet.<br><a href="https://wa.me/917799934943" target="_blank" style="color:var(--web-green);">Start your first project →</a></div>`;
    return;
  }

  const statusLabel = { completed: 'Completed', in_progress: 'In Progress', revision: 'Revision', pending: 'Pending' };

  container.innerHTML = projects.map(p => `
    <div class="project-item">
      <div class="project-meta">
        <div>
          <div class="project-name">${p.name}</div>
          <div class="project-type">${p.type} · ${fmt(p.value || 0)} · Due ${fmtDate(p.dueDate)}</div>
        </div>
        <span class="project-status status-${p.status}">${statusLabel[p.status] || p.status}</span>
      </div>
      <div class="project-progress-track">
        <div class="project-progress-fill" style="width:${p.progress || 0}%;"></div>
      </div>
    </div>`).join('');
}

// ── Content overview ──────────────────────────────────────────────────────────
function renderContent(data) {
  const container = document.getElementById('content-overview');
  if (!container || !data) return;

  const ig = data.instagram || {};
  const yt = data.youtube   || {};

  container.innerHTML = `
    <!-- Instagram -->
    <div class="content-platform">
      <div class="content-platform-header">
        <div class="content-platform-name">
          <span style="color:var(--ig-pink); font-size:1.1rem;">📸</span> Instagram
        </div>
        <span class="content-growth">${ig.growth || '—'} this month</span>
      </div>
      <div class="content-stats-row">
        <div class="content-stat">
          <div class="content-stat-val" style="color:var(--ig-pink);">${fmtNum(ig.followers || 0)}</div>
          <div class="content-stat-lbl">Followers</div>
        </div>
        <div class="content-stat">
          <div class="content-stat-val">${ig.postsThisMonth || 0}</div>
          <div class="content-stat-lbl">Posts/mo</div>
        </div>
        <div class="content-stat">
          <div class="content-stat-val" style="color:var(--web-green);">${ig.scheduled || 0}</div>
          <div class="content-stat-lbl">Scheduled</div>
        </div>
      </div>
    </div>

    <!-- YouTube -->
    <div class="content-platform">
      <div class="content-platform-header">
        <div class="content-platform-name">
          <span style="color:var(--yt-red); font-size:1.1rem;">▶</span> YouTube
        </div>
        <span class="content-growth">${yt.growth || '—'} this month</span>
      </div>
      <div class="content-stats-row">
        <div class="content-stat">
          <div class="content-stat-val" style="color:var(--yt-red);">${fmtNum(yt.subscribers || 0)}</div>
          <div class="content-stat-lbl">Subscribers</div>
        </div>
        <div class="content-stat">
          <div class="content-stat-val">${yt.videosThisMonth || 0}</div>
          <div class="content-stat-lbl">Videos/mo</div>
        </div>
        <div class="content-stat">
          <div class="content-stat-val" style="color:var(--primary);">${fmtNum(yt.views || 0)}</div>
          <div class="content-stat-lbl">Views</div>
        </div>
      </div>
    </div>

    <!-- This month -->
    <div class="content-month-row">
      <span class="content-month-label">This month's content</span>
      <div style="display:flex;gap:0.4rem;">
        <span class="content-pill" style="background:rgba(16,185,129,0.12);color:var(--web-green);">✓ ${data.published || 0} Published</span>
        <span class="content-pill" style="background:rgba(245,158,11,0.12);color:#f59e0b;">${data.inDraft || 0} In Draft</span>
      </div>
    </div>`;
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
  if (openBtn)    openBtn.href     = formUrl;

  function copyText(text, btn, label) {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = label; }, 2000);
    });
  }

  if (copyLink)  copyLink.addEventListener('click',  () => copyText(formUrl,   copyLink,  'Copy Link'));
  if (copyEmbed) copyEmbed.addEventListener('click', () => copyText(embedCode, copyEmbed, 'Copy Code'));
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
