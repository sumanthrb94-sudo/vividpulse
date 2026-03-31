/*!
 * CRM Kanban Logic — Vivid Pulse
 * Full drag-and-drop pipeline with localStorage persistence
 */
import '/src/style.css';

// ============================
// SEED DATA
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
let leads = JSON.parse(localStorage.getItem('vp_crm_leads') || 'null') || SEED_LEADS;
let dragCard = null;
let dragLeadId = null;

function save() {
  localStorage.setItem('vp_crm_leads', JSON.stringify(leads));
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

    // Remove old cards (keep header)
    col.querySelectorAll('.kanban-card').forEach(c => c.remove());

    const stageleads = leads.filter(l => l.stage === stage);
    const countEl = document.getElementById('count-' + stage);
    if (countEl) countEl.textContent = stageleads.length;

    stageleads.forEach(lead => {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.draggable = true;
      card.dataset.id = lead.id;
      card.innerHTML = `
        <div class="kc-name">${lead.name}</div>
        <div class="kc-company">${lead.company || '—'}</div>
        <div class="kc-value">${formatCurrency(lead.value || 0)}</div>
        <div class="kc-date">Added ${formatDate(lead.date)}</div>
        <button class="delete-btn" data-id="${lead.id}" style="margin-top:0.6rem; background:none; border:none; color:rgba(239,68,68,0.6); font-size:0.75rem; cursor:pointer; padding:0; transition:color 0.2s;">✕ Remove</button>
      `;

      // Drag events
      card.addEventListener('dragstart', (e) => {
        dragCard = card;
        dragLeadId = lead.id;
        setTimeout(() => card.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
        dragCard = null;
        dragLeadId = null;
      });

      // Delete
      card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        leads = leads.filter(l => l.id !== lead.id);
        save();
        renderBoard();
        updateStats();
      });

      col.appendChild(card);
    });
  });

  // Update total in toolbar
  const totalEl = document.getElementById('total-leads');
  if (totalEl) totalEl.textContent = leads.length;
}

function updateStats() {
  const total = leads.length;
  const totalValue = leads.reduce((s, l) => s + (l.value || 0), 0);
  const wonLeads = leads.filter(l => l.stage === 'won');
  const wonValue = wonLeads.reduce((s, l) => s + (l.value || 0), 0);
  const closedTotal = leads.filter(l => l.stage === 'won' || l.stage === 'lost').length;
  const winRate = closedTotal > 0 ? Math.round((wonLeads.length / closedTotal) * 100) : 0;

  const el = (id) => document.getElementById(id);
  if (el('stat-total'))  el('stat-total').textContent = total;
  if (el('stat-value'))  el('stat-value').textContent = formatCurrency(totalValue);
  if (el('stat-won'))    el('stat-won').textContent = winRate + '%';
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

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const newStage = col.dataset.col;
      if (dragLeadId && newStage) {
        const lead = leads.find(l => l.id === dragLeadId);
        if (lead && lead.stage !== newStage) {
          lead.stage = newStage;
          save();
          renderBoard();
          updateStats();
        }
      }
    });
  });
}

// ============================
// ADD LEAD MODAL
// ============================
function initModal() {
  const btn    = document.getElementById('add-lead-btn');
  const modal  = document.getElementById('add-lead-modal');
  const close  = document.getElementById('modal-close');
  const form   = document.getElementById('add-lead-form');

  if (!btn || !modal) return;

  btn.addEventListener('click', () => modal.classList.add('open'));
  close.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('CRM: Form submitted');
    
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

    console.log('CRM: Adding lead', newLead);
    leads.unshift(newLead);
    save();
    renderBoard();
    updateStats();
    form.reset();
    modal.classList.remove('open');
  });
}

// ============================
// INIT
// ============================
document.addEventListener('DOMContentLoaded', () => {
  renderBoard();
  updateStats();
  initDragDrop();
  initModal();
});
