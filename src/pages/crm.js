/*!
 * CRM Kanban Logic — Vivid Pulse
 * Protected by Firebase Auth (GCP).
 * Lead data is persisted to Cloud Firestore (per-user collection).
 */
import '/src/style.css';
import { requireAuth, logout } from '/src/auth.js';
import { db } from '/src/firebase.js';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';

// ============================
// SEED DATA (used only on first sign-in when collection is empty)
// ============================
const SEED_LEADS = [
  { id: 'l1', name: 'Ankit Verma',    company: 'GrowFast Inc',    value: 75000,  stage: 'new',       date: '2026-03-28' },
  { id: 'l2', name: 'Pooja Singh',    company: 'Bloom Studio',    value: 35000,  stage: 'contacted', date: '2026-03-25' },
  { id: 'l3', name: 'Rajesh Nair',    company: 'TechMinds',       value: 120000, stage: 'proposal',  date: '2026-03-20' },
  { id: 'l4', name: 'Divya Patel',    company: 'ShopKart',        value: 55000,  stage: 'won',       date: '2026-03-15' },
  { id: 'l5', name: 'Farhan Qureshi', company: 'MediaPeak',       value: 90000,  stage: 'contacted', date: '2026-03-22' },
  { id: 'l6', name: 'Sneha Reddy',    company: 'DesignSync',      value: 42000,  stage: 'new',       date: '2026-03-30' },
  { id: 'l7', name: 'Vikram Goel',    company: 'RealEdge Homes',  value: 200000, stage: 'proposal',  date: '2026-03-18' },
  { id: 'l8', name: 'Aarav Khanna',   company: 'SwiftHire',       value: 28000,  stage: 'lost',      date: '2026-03-10' },
];

// ============================
// STATE
// ============================
let leads       = [];
let currentUser = null;
let leadsColRef = null;
let dragLeadId  = null;

// ============================
// AUTH GUARD — resolves with the authenticated user or redirects to /login
// ============================
requireAuth('/login').then((user) => {
  currentUser = user;
  leadsColRef = collection(db, 'users', user.uid, 'leads');

  // Show user email + logout button in navbar
  const emailEl  = document.getElementById('user-email');
  const logoutBtn = document.getElementById('logout-btn');
  if (emailEl) {
    emailEl.textContent = user.email || user.displayName || 'Signed in';
    emailEl.style.display = '';
  }
  if (logoutBtn) {
    logoutBtn.style.display = '';
    logoutBtn.addEventListener('click', () =>
      logout().then(() => { window.location.href = '/login'; })
    );
  }

  // Subscribe to real-time Firestore updates
  const q = query(leadsColRef, orderBy('date', 'desc'));
  onSnapshot(q, async (snapshot) => {
    if (snapshot.empty && leads.length === 0) {
      // First sign-in: seed the collection
      await seedLeads();
      return;
    }
    leads = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBoard();
    updateStats();
  });

  initDragDrop();
  initModal();
  initLeadPanel();
});

// ============================
// FIRESTORE HELPERS
// ============================
async function seedLeads() {
  const batch = writeBatch(db);
  SEED_LEADS.forEach(lead => {
    const ref = doc(leadsColRef, lead.id);
    batch.set(ref, { name: lead.name, company: lead.company, value: lead.value, stage: lead.stage, date: lead.date });
  });
  await batch.commit();
}

async function saveLead(lead) {
  const { id, ...data } = lead;
  await setDoc(doc(leadsColRef, id), data);
}

async function removeLead(id) {
  await deleteDoc(doc(leadsColRef, id));
}

// ============================
// RENDER
// ============================
function formatCurrency(n) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'k';
  return '₹' + n;
}

function formatDate(str) {
  const d = new Date(str);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STAGES = ['new', 'contacted', 'proposal', 'won', 'lost'];

function renderBoard() {
  STAGES.forEach(stage => {
    const col = document.getElementById('col-' + stage);
    if (!col) return;

    col.querySelectorAll('.kanban-card').forEach(c => c.remove());

    const stageLeads = leads.filter(l => l.stage === stage);
    const countEl    = document.getElementById('count-' + stage);
    if (countEl) countEl.textContent = stageLeads.length;

    stageLeads.forEach(lead => {
      const card = document.createElement('div');
      card.className  = 'kanban-card';
      card.draggable  = true;
      card.dataset.id = lead.id;
      const noteCount = (lead.notes || []).length;
      card.innerHTML  = `
        <div class="kc-name" style="cursor:pointer; text-decoration:underline; text-underline-offset:3px; text-decoration-color:rgba(255,255,255,0.2);" data-open="${lead.id}">${lead.name}</div>
        <div class="kc-company">${lead.company || '—'}</div>
        <div class="kc-value">${formatCurrency(lead.value || 0)}</div>
        <div class="kc-date">Added ${formatDate(lead.date)}${noteCount ? ` · 📝 ${noteCount}` : ''}</div>
        <button class="delete-btn" data-id="${lead.id}" style="margin-top:0.6rem; background:none; border:none; color:rgba(239,68,68,0.6); font-size:0.75rem; cursor:pointer; padding:0; transition:color 0.2s;">✕ Remove</button>
      `;

      // Open detail panel on name click
      card.querySelector('[data-open]').addEventListener('click', () => {
        if (window._openLeadPanel) window._openLeadPanel(lead);
      });

      card.addEventListener('dragstart', (e) => {
        dragLeadId = lead.id;
        setTimeout(() => card.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
        dragLeadId = null;
      });

      card.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await removeLead(lead.id);
        // onSnapshot will re-render automatically
      });

      col.appendChild(card);
    });
  });

  const totalEl = document.getElementById('total-leads');
  if (totalEl) totalEl.textContent = leads.length;
}

function updateStats() {
  const total      = leads.length;
  const totalValue = leads.reduce((s, l) => s + (l.value || 0), 0);
  const wonLeads   = leads.filter(l => l.stage === 'won');
  const wonValue   = wonLeads.reduce((s, l) => s + (l.value || 0), 0);
  const closed     = leads.filter(l => l.stage === 'won' || l.stage === 'lost').length;
  const winRate    = closed > 0 ? Math.round((wonLeads.length / closed) * 100) : 0;

  const el = (id) => document.getElementById(id);
  if (el('stat-total'))  el('stat-total').textContent  = total;
  if (el('stat-value'))  el('stat-value').textContent  = formatCurrency(totalValue);
  if (el('stat-won'))    el('stat-won').textContent    = winRate + '%';
  if (el('stat-closed')) el('stat-closed').textContent = formatCurrency(wonValue);
  if (el('total-leads')) el('total-leads').textContent = total;
}

// ============================
// DRAG & DROP ON COLUMNS
// ============================
function initDragDrop() {
  document.querySelectorAll('.kanban-col').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));

    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const newStage = col.dataset.col;
      if (dragLeadId && newStage) {
        const lead = leads.find(l => l.id === dragLeadId);
        if (lead && lead.stage !== newStage) {
          await saveLead({ ...lead, stage: newStage });
          // onSnapshot re-renders automatically
        }
      }
    });
  });
}

// ============================
// LEAD DETAIL PANEL
// ============================
function initLeadPanel() {
  const overlay  = document.getElementById('lead-panel-overlay');
  const panel    = document.getElementById('lead-panel');
  const closeBtn = document.getElementById('lead-panel-close');
  const editForm = document.getElementById('lead-edit-form');
  const noteForm = document.getElementById('note-form');
  const noteInput = document.getElementById('note-input');
  const notesList = document.getElementById('notes-list');

  if (!panel) return;

  function openPanel(lead) {
    document.getElementById('edit-name').value    = lead.name || '';
    document.getElementById('edit-company').value = lead.company || '';
    document.getElementById('edit-value').value   = lead.value || 0;
    document.getElementById('edit-stage').value   = lead.stage || 'new';
    editForm.dataset.leadId = lead.id;

    // Render notes
    const notes = lead.notes || [];
    notesList.innerHTML = notes.length
      ? notes.slice().reverse().map(n => `
          <div class="note-item">
            <div class="note-item-text">${n.text}</div>
            <div class="note-item-time">${new Date(n.at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
          </div>`).join('')
      : '<p style="color:var(--text-dim);font-size:0.8rem;">No notes yet.</p>';

    panel.classList.add('open');
    overlay.classList.add('open');
  }

  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  }

  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);

  // Save edits
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id      = editForm.dataset.leadId;
    const lead    = leads.find(l => l.id === id);
    if (!lead) return;
    await saveLead({
      ...lead,
      name:    document.getElementById('edit-name').value.trim(),
      company: document.getElementById('edit-company').value.trim() || 'Unknown',
      value:   parseInt(document.getElementById('edit-value').value) || 0,
      stage:   document.getElementById('edit-stage').value,
    });
    closePanel();
  });

  // Add note
  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = noteInput.value.trim();
    if (!text) return;
    const id = editForm.dataset.leadId;
    await updateDoc(doc(leadsColRef, id), {
      notes: arrayUnion({ text, at: new Date().toISOString() }),
    });
    noteInput.value = '';
    // Re-open with updated lead
    const updated = leads.find(l => l.id === id);
    if (updated) openPanel(updated);
  });

  // Expose openPanel so cards can call it
  window._openLeadPanel = openPanel;
}

// ============================
// ADD LEAD MODAL
// ============================
function initModal() {
  const btn   = document.getElementById('add-lead-btn');
  const modal = document.getElementById('add-lead-modal');
  const close = document.getElementById('modal-close');
  const form  = document.getElementById('add-lead-form');

  if (!btn || !modal) return;

  btn.addEventListener('click', () => modal.classList.add('open'));
  close.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name    = document.getElementById('lead-name').value.trim();
    const company = document.getElementById('lead-company').value.trim();
    const value   = parseInt(document.getElementById('lead-value').value) || 0;
    const stage   = document.getElementById('lead-stage').value;

    if (!name) return;

    const newLead = {
      id:      'l' + Date.now(),
      name,
      company: company || 'Unknown',
      value,
      stage,
      date:    new Date().toISOString().split('T')[0],
    };

    await saveLead(newLead);
    // onSnapshot re-renders automatically
    form.reset();
    modal.classList.remove('open');
  });
}
