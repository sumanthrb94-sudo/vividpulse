/*!
 * Minimal CRM — Vivid Pulse
 * Simple lead tracker: follow-ups, stages, quick actions.
 */
import '/src/style.css';
import { requireAuth } from '/src/auth.js';
import { initNavAuth } from '/src/nav-auth.js';
initNavAuth();
import { db } from '/src/firebase.js';
import {
  collection, doc, setDoc, deleteDoc, updateDoc,
  onSnapshot, writeBatch, query, orderBy, arrayUnion,
} from 'firebase/firestore';

// ── Seed data for first sign-in ───────────────────────────────────────────────
const SEED = [
  { name: 'Ankit Verma',    company: 'GrowFast Inc',   phone: '+91 98765 43210', email: 'ankit@growfast.in',   value: 75000,  stage: 'new',       source: 'instagram', dueDate: '2026-04-05' },
  { name: 'Pooja Singh',    company: 'Bloom Studio',   phone: '+91 97654 32109', email: 'pooja@bloomstudio.in', value: 35000,  stage: 'contacted', source: 'referral',  dueDate: '2026-04-02' },
  { name: 'Rajesh Nair',    company: 'TechMinds',      phone: '+91 96543 21098', email: 'rajesh@techminds.in',  value: 120000, stage: 'proposal',  source: 'website',   dueDate: '2026-03-30' },
  { name: 'Divya Patel',    company: 'ShopKart',       phone: '+91 95432 10987', email: 'divya@shopkart.in',   value: 55000,  stage: 'won',       source: 'cold-call'  },
  { name: 'Farhan Qureshi', company: 'MediaPeak',      phone: '+91 94321 09876', email: 'farhan@mediapeak.in', value: 90000,  stage: 'contacted', source: 'linkedin',  dueDate: '2026-04-06' },
  { name: 'Sneha Reddy',    company: 'DesignSync',     phone: '+91 93210 98765', email: 'sneha@designsync.in', value: 42000,  stage: 'new',       source: 'instagram'  },
  { name: 'Vikram Goel',    company: 'RealEdge Homes', phone: '+91 92109 87654', email: 'vikram@realedge.in',  value: 200000, stage: 'proposal',  source: 'referral',  dueDate: '2026-04-08' },
  { name: 'Aarav Khanna',   company: 'SwiftHire',      phone: '+91 91098 76543', email: 'aarav@swifthire.in',  value: 28000,  stage: 'lost',      source: 'event'      },
];

const STAGE_META = {
  new:       { label: 'New',       color: '#22d3ee' },
  contacted: { label: 'Contacted', color: '#f59e0b' },
  proposal:  { label: 'Proposal',  color: '#a855f7' },
  won:       { label: 'Won',       color: '#10b981' },
  lost:      { label: 'Lost',      color: '#ef4444' },
};

// ── State ─────────────────────────────────────────────────────────────────────
let _leads    = [];
let _col      = null;
let _panelId  = null;
let _tabStage = '';
let _search   = '';

// ── Entry ─────────────────────────────────────────────────────────────────────
requireAuth('/login').then((user) => {
  _col = collection(db, 'users', user.uid, 'leads');

  const q = query(_col, orderBy('createdAt', 'desc'));
  onSnapshot(q, async (snap) => {
    if (snap.empty && _leads.length === 0) { await seed(); return; }
    _leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
    if (_panelId) {
      const lead = _leads.find(l => l.id === _panelId);
      if (lead) populatePanel(lead);
    }
  });

  initAddModal();
  initPanel();
  initTabs();
  initSearch();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

function fmtCurrency(n) {
  n = Number(n) || 0;
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(0) + 'k';
  return n ? '₹' + n : '—';
}

function fmtDate(str) {
  if (!str) return null;
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dueStatus(lead) {
  if (!lead.dueDate || lead.stage === 'won' || lead.stage === 'lost') return null;
  const t = today();
  if (lead.dueDate < t)  return { label: 'Overdue',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (lead.dueDate === t) return { label: 'Due today', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return { label: fmtDate(lead.dueDate), color: 'var(--text-dim)', bg: 'transparent' };
}

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = ['#22d3ee','#a855f7','#f59e0b','#10b981','#3b82f6','#ef4444','#ec4899'];
function avatarColor(name) {
  let h = 0;
  for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  const batch = writeBatch(db);
  SEED.forEach((lead, i) => {
    batch.set(doc(_col, 'seed-' + i), {
      ...lead,
      notes: [],
      createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
    });
  });
  await batch.commit();
}

// ── Render ────────────────────────────────────────────────────────────────────
function getFiltered() {
  let list = [..._leads];
  if (_tabStage) list = list.filter(l => l.stage === _tabStage);
  if (_search) {
    const q = _search.toLowerCase();
    list = list.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.company || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q)
    );
  }
  return list;
}

function renderAll() {
  updateKPIs();
  updateTabCounts();
  renderLeads();
}

function updateKPIs() {
  const t = today();
  const overdue = _leads.filter(l =>
    l.dueDate && l.dueDate < t && l.stage !== 'won' && l.stage !== 'lost'
  ).length;
  const won = _leads.filter(l => l.stage === 'won').length;

  const el = id => document.getElementById(id);
  if (el('kpi-total'))   el('kpi-total').textContent   = _leads.length;
  if (el('kpi-overdue')) el('kpi-overdue').textContent = overdue;
  if (el('kpi-won'))     el('kpi-won').textContent     = won;

  const sub = el('ca-subtitle');
  if (sub) {
    sub.textContent = overdue > 0
      ? `${_leads.length} leads · ⚠ ${overdue} overdue`
      : `${_leads.length} leads`;
    sub.style.color = overdue > 0 ? '#ef4444' : 'var(--text-dim)';
  }
}

function updateTabCounts() {
  document.querySelectorAll('.ca-tab[data-stage]').forEach(btn => {
    const stage = btn.dataset.stage;
    const count = stage
      ? _leads.filter(l => l.stage === stage).length
      : _leads.length;
    // Remove old count badge
    btn.textContent = btn.textContent.replace(/\s*\(\d+\)$/, '');
    if (count > 0) btn.textContent += ` (${count})`;
  });
}

function renderLeads() {
  const list   = document.getElementById('leads-list');
  const empty  = document.getElementById('leads-empty');
  if (!list) return;

  const filtered = getFiltered();
  list.innerHTML = '';

  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(lead => {
    const due    = dueStatus(lead);
    const sm     = STAGE_META[lead.stage] || STAGE_META.new;
    const color  = avatarColor(lead.name);
    const notes  = (lead.notes || []).length;

    const card = document.createElement('div');
    card.className  = 'lc-card';
    card.dataset.id = lead.id;
    card.style.setProperty('--stage-color', sm.color);

    card.innerHTML = `
      <div class="lc-avatar" style="background:${color}22;color:${color};">${initials(lead.name)}</div>
      <div class="lc-body">
        <div class="lc-row1">
          <span class="lc-name">${lead.name}</span>
          <span class="lc-stage" style="color:${sm.color};background:${sm.color}18;">${sm.label}</span>
        </div>
        <div class="lc-row2">
          ${lead.company ? `<span class="lc-company">${lead.company}</span>` : ''}
          ${lead.value   ? `<span class="lc-value">${fmtCurrency(lead.value)}</span>` : ''}
          ${notes        ? `<span class="lc-notes-count">📝 ${notes}</span>` : ''}
        </div>
        ${due ? `<div class="lc-due" style="color:${due.color};background:${due.bg};">${due.label === 'Overdue' ? '⚠ ' : ''}${due.label}</div>` : ''}
      </div>
      <div class="lc-actions">
        ${lead.phone ? `<a href="tel:${lead.phone}" class="lc-btn" title="Call" onclick="event.stopPropagation()">📞</a>` : ''}
        ${lead.phone ? `<a href="https://wa.me/${(lead.phone||'').replace(/[^0-9]/g,'')}" target="_blank" class="lc-btn" title="WhatsApp" onclick="event.stopPropagation()">💬</a>` : ''}
        ${lead.email ? `<a href="mailto:${lead.email}" class="lc-btn" title="Email" onclick="event.stopPropagation()">✉</a>` : ''}
      </div>
    `;

    card.addEventListener('click', () => openPanel(lead.id));
    list.appendChild(card);
  });
}

// ── Lead Panel ────────────────────────────────────────────────────────────────
function openPanel(id) {
  _panelId = id;
  const lead = _leads.find(l => l.id === id);
  if (!lead) return;
  populatePanel(lead);
  document.getElementById('lead-panel')?.classList.add('open');
  document.getElementById('lead-panel-overlay')?.classList.add('open');
}

function closePanel() {
  _panelId = null;
  document.getElementById('lead-panel')?.classList.remove('open');
  document.getElementById('lead-panel-overlay')?.classList.remove('open');
}

function populatePanel(lead) {
  const el = id => document.getElementById(id);

  if (el('lp-name'))        el('lp-name').textContent        = lead.name;
  if (el('lp-company-sub')) el('lp-company-sub').textContent = lead.company || '';
  if (el('lp-phone'))       el('lp-phone').textContent       = lead.phone || '—';
  if (el('lp-email'))       el('lp-email').textContent       = lead.email || '—';
  if (el('lp-value'))       el('lp-value').textContent       = fmtCurrency(lead.value);
  if (el('lp-source'))      el('lp-source').textContent      = lead.source || '—';
  if (el('lp-due-input'))   el('lp-due-input').value         = lead.dueDate || '';

  // Stage pills
  el('lp-stage-pills')?.querySelectorAll('.lp-stage-pill').forEach(btn => {
    const active = btn.dataset.stage === lead.stage;
    btn.className = 'lp-stage-pill' + (active ? ' active' : '');
    const m = STAGE_META[btn.dataset.stage];
    if (m) btn.style.setProperty('--pill-color', m.color);
  });

  // Quick actions
  const qa = el('lp-quick-actions');
  if (qa) {
    qa.innerHTML = '';
    if (lead.phone) {
      const wa = (lead.phone || '').replace(/[^0-9]/g, '');
      qa.innerHTML += `<a href="tel:${lead.phone}" class="lp-qa-btn lp-qa-call">📞 Call</a>`;
      qa.innerHTML += `<a href="https://wa.me/${wa}" target="_blank" class="lp-qa-btn lp-qa-wa">💬 WhatsApp</a>`;
    }
    if (lead.email) {
      qa.innerHTML += `<a href="mailto:${lead.email}" class="lp-qa-btn lp-qa-email">✉ Email</a>`;
    }
  }

  // Edit form pre-fill
  if (el('lp-lead-id'))      el('lp-lead-id').value      = lead.id;
  if (el('lp-edit-name'))    el('lp-edit-name').value    = lead.name || '';
  if (el('lp-edit-company')) el('lp-edit-company').value = lead.company || '';
  if (el('lp-edit-phone'))   el('lp-edit-phone').value   = lead.phone || '';
  if (el('lp-edit-email'))   el('lp-edit-email').value   = lead.email || '';
  if (el('lp-edit-value'))   el('lp-edit-value').value   = lead.value || '';

  // Timeline / notes
  const tl = el('lp-timeline');
  if (tl) {
    const notes = (lead.notes || []).slice().reverse();
    tl.innerHTML = notes.length
      ? notes.map(n => `
          <div class="lp-timeline-item">
            <div class="lp-tl-icon">📝</div>
            <div class="lp-tl-content">
              <div class="lp-tl-text">${n.text || n}</div>
              <div class="lp-tl-time">${n.at ? new Date(n.at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}</div>
            </div>
          </div>`).join('')
      : '<div style="color:var(--text-dim);font-size:0.82rem;padding:0.25rem 0;">No notes yet.</div>';
  }
}

function initPanel() {
  const overlay    = document.getElementById('lead-panel-overlay');
  const closeBtn   = document.getElementById('lead-panel-close');
  const editToggle = document.getElementById('lp-edit-toggle');
  const editForm   = document.getElementById('lp-edit-form');
  const editArrow  = document.getElementById('lp-edit-arrow');
  const deleteBtn  = document.getElementById('lp-delete-btn');
  const noteForm   = document.getElementById('lp-note-form');
  const noteInput  = document.getElementById('lp-note-input');
  const saveDue    = document.getElementById('lp-save-due');
  const dueInput   = document.getElementById('lp-due-input');

  closeBtn?.addEventListener('click', closePanel);
  overlay?.addEventListener('click', closePanel);

  // Stage pills
  document.querySelectorAll('.lp-stage-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!_panelId) return;
      await updateDoc(doc(_col, _panelId), { stage: btn.dataset.stage });
    });
  });

  // Edit toggle
  editToggle?.addEventListener('click', () => {
    const open = editForm?.style.display !== 'none';
    if (editForm) editForm.style.display = open ? 'none' : 'block';
    if (editArrow) editArrow.textContent = open ? '▶' : '▼';
  });

  // Save edits
  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('lp-lead-id')?.value;
    if (!id) return;
    await updateDoc(doc(_col, id), {
      name:    document.getElementById('lp-edit-name')?.value.trim()    || '',
      company: document.getElementById('lp-edit-company')?.value.trim() || '',
      phone:   document.getElementById('lp-edit-phone')?.value.trim()   || '',
      email:   document.getElementById('lp-edit-email')?.value.trim()   || '',
      value:   parseInt(document.getElementById('lp-edit-value')?.value) || 0,
    });
    if (editForm) editForm.style.display = 'none';
    if (editArrow) editArrow.textContent = '▶';
  });

  // Delete
  deleteBtn?.addEventListener('click', async () => {
    if (!_panelId || !confirm('Delete this lead?')) return;
    await deleteDoc(doc(_col, _panelId));
    closePanel();
  });

  // Follow-up date
  saveDue?.addEventListener('click', async () => {
    if (!_panelId || !dueInput) return;
    await updateDoc(doc(_col, _panelId), { dueDate: dueInput.value || null });
  });

  // Add note
  noteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = noteInput?.value.trim();
    if (!text || !_panelId) return;
    await updateDoc(doc(_col, _panelId), {
      notes: arrayUnion({ text, at: new Date().toISOString() }),
    });
    if (noteInput) noteInput.value = '';
  });

  // Expose globally (for dashboard deep-link)
  window._openLeadPanel = (lead) => openPanel(lead.id || lead);
}

// ── Add Lead Panel ────────────────────────────────────────────────────────────
function initAddModal() {
  const btn     = document.getElementById('add-lead-btn');
  const panel   = document.getElementById('add-lead-panel');
  const overlay = document.getElementById('add-panel-overlay');
  const close   = document.getElementById('add-panel-close');
  const form    = document.getElementById('add-lead-form');

  function open() {
    panel?.classList.add('open');
    overlay?.classList.add('open');
    closePanel(); // close detail panel if open
    setTimeout(() => document.getElementById('lead-name')?.focus(), 80);
  }

  function shut() {
    panel?.classList.remove('open');
    overlay?.classList.remove('open');
    form?.reset();
    // Reset stage picker
    document.querySelectorAll('.al-stage-opt').forEach(b => b.classList.remove('active'));
    document.querySelector('.al-stage-opt[data-stage="new"]')?.classList.add('active');
    const stageInput = document.getElementById('lead-stage');
    if (stageInput) stageInput.value = 'new';
    // Always reset submit button
    const submitBtn = form?.querySelector('.al-submit-btn');
    if (submitBtn) { submitBtn.textContent = 'Add Lead to Pipeline'; submitBtn.disabled = false; }
  }

  btn?.addEventListener('click', open);
  close?.addEventListener('click', shut);
  overlay?.addEventListener('click', shut);

  // Keyboard: Escape closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel?.classList.contains('open')) shut();
  });

  // Stage picker
  document.querySelectorAll('.al-stage-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.al-stage-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const stageInput = document.getElementById('lead-stage');
      if (stageInput) stageInput.value = btn.dataset.stage;
    });
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('lead-name')?.value.trim();
    if (!name) {
      document.getElementById('lead-name')?.focus();
      return;
    }
    const submitBtn = form.querySelector('.al-submit-btn');
    if (submitBtn) { submitBtn.textContent = 'Adding…'; submitBtn.disabled = true; }

    const noteText = document.getElementById('lead-note')?.value.trim();
    try {
      await setDoc(doc(_col, 'l' + Date.now()), {
        name,
        company:   document.getElementById('lead-company')?.value.trim() || '',
        phone:     document.getElementById('lead-phone')?.value.trim()   || '',
        email:     document.getElementById('lead-email')?.value.trim()   || '',
        value:     parseInt(document.getElementById('lead-value')?.value) || 0,
        source:    document.getElementById('lead-source')?.value || '',
        dueDate:   document.getElementById('lead-due')?.value || null,
        stage:     document.getElementById('lead-stage')?.value || 'new',
        notes:     noteText ? [{ text: noteText, at: new Date().toISOString() }] : [],
        createdAt: new Date().toISOString(),
      });
      shut();
    } catch (err) {
      console.error('Failed to add lead:', err);
      if (submitBtn) { submitBtn.textContent = 'Add Lead to Pipeline'; submitBtn.disabled = false; }
    }
  });
}

// ── Stage tabs ────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.ca-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ca-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _tabStage = btn.dataset.stage;
      renderLeads();
    });
  });
}

// ── Search ────────────────────────────────────────────────────────────────────
function initSearch() {
  document.getElementById('ca-search')?.addEventListener('input', e => {
    _search = e.target.value.trim();
    renderLeads();
  });
}
