/**
 * CRM Core — shared business logic for dashboard and CRM pages.
 * No UI code — pure data transforms and Firestore write helpers.
 */
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { STAGES, STAGE_META, WORKFLOWS, ACTION_ICON } from './workflows.js';

export { STAGES, STAGE_META, WORKFLOWS, ACTION_ICON };

// ── Format helpers ────────────────────────────────────────────────────────────
export function formatCurrency(n) {
  n = Number(n) || 0;
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)     return '₹' + (n / 1000).toFixed(0) + 'k';
  return '₹' + n;
}

export function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatDateTime(str) {
  if (!str) return '';
  return new Date(str).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const today = () => new Date().toISOString().split('T')[0];

// ── Health checks ─────────────────────────────────────────────────────────────
export function isOverdue(lead) {
  const t = today();
  return lead.dueDate && lead.dueDate < t
    && lead.stage !== 'won' && lead.stage !== 'lost';
}

export function isDueToday(lead) {
  return lead.dueDate === today()
    && lead.stage !== 'won' && lead.stage !== 'lost';
}

export function isStale(lead) {
  if (lead.stage === 'won' || lead.stage === 'lost') return false;
  const lastAt = lead.lastActivityAt || lead.date;
  if (!lastAt) return false;
  return (Date.now() - new Date(lastAt).getTime()) / 86400000 >= 7;
}

export function healthTag(lead) {
  if (isOverdue(lead))  return { label: 'Overdue',  color: '#ef4444' };
  if (isDueToday(lead)) return { label: 'Due Today', color: '#f59e0b' };
  if (isStale(lead))    return { label: 'Stale 7d+', color: '#94a3b8' };
  return null;
}

// ── Lead migration — normalizes old docs to new activity schema ───────────────
export function migrateLead(id, data) {
  const lead = { id, ...data };

  // Migrate old flat notes[] → activity[]
  if (!lead.activity) {
    lead.activity = (lead.notes || []).map(n => ({
      type: 'note',
      text: typeof n === 'string' ? n : (n.text || ''),
      at: n.at || lead.date || new Date().toISOString(),
    }));
    if (lead.activity.length === 0 && lead.date) {
      lead.activity = [{ type: 'created', text: 'Lead added to pipeline', at: lead.date }];
    }
  }

  // lastActivityAt fallback
  if (!lead.lastActivityAt) {
    const last = lead.activity[lead.activity.length - 1];
    lead.lastActivityAt = last?.at || lead.date || new Date().toISOString();
  }

  // isNew — true until any manual activity logged
  if (lead.isNew === undefined) {
    lead.isNew = !lead.activity.some(a => a.type !== 'created');
  }

  // workflowStep fallback
  if (lead.workflowStep === undefined) lead.workflowStep = 0;

  return lead;
}

// ── Write helpers ─────────────────────────────────────────────────────────────
export async function addActivity(leadsColRef, leadId, entry) {
  const now = new Date().toISOString();
  const full = { ...entry, at: now };
  await updateDoc(doc(leadsColRef, leadId), {
    activity: arrayUnion(full),
    lastActivityAt: now,
    isNew: false,
  });
  return full;
}

export async function advanceWorkflow(leadsColRef, lead) {
  const wf = WORKFLOWS[lead.workflowId];
  if (!wf) return;
  const nextIdx = (lead.workflowStep || 0) + 1;
  if (nextIdx >= wf.steps.length) return;

  const step = wf.steps[nextIdx];
  const createdDate = new Date(lead.date || Date.now());
  const dueDate = new Date(createdDate.getTime() + step.offsetDays * 86400000)
    .toISOString().split('T')[0];

  const now = new Date().toISOString();
  await updateDoc(doc(leadsColRef, lead.id), {
    workflowStep: nextIdx,
    dueDate,
    activity: arrayUnion({
      type: 'workflow_step',
      text: `Workflow: ${wf.steps[nextIdx - 1]?.label || 'Step'} → ${step.label}`,
      at: now,
    }),
    lastActivityAt: now,
  });
}

// ── Build today's task queue (for dashboard + CRM) ────────────────────────────
export function buildTodayTasks(leads) {
  const t = today();
  const tasks = [];
  const active = leads.filter(l => l.stage !== 'won' && l.stage !== 'lost');

  // P1: Overdue
  active.filter(isOverdue).forEach(lead => {
    tasks.push({ priority: 1, type: 'overdue', lead,
      action: 'Follow up — overdue', emoji: '⚠', color: '#ef4444' });
  });

  // P2: Workflow step due today
  active.filter(l => l.workflowId && l.dueDate === t).forEach(lead => {
    const wf = WORKFLOWS[lead.workflowId];
    const step = wf?.steps[lead.workflowStep || 0];
    if (!step) return;
    const icon = step.actionType === 'call' ? '📞' : step.actionType === 'email' ? '✉' : '📝';
    tasks.push({ priority: 2, type: 'workflow_step', lead,
      action: step.label, emoji: icon, color: '#a855f7', step });
  });

  // P3: Due today (non-workflow)
  active.filter(l => l.dueDate === t && !l.workflowId).forEach(lead => {
    tasks.push({ priority: 3, type: 'due_today', lead,
      action: 'Follow-up due today', emoji: '📅', color: '#f59e0b' });
  });

  // P4: New uncontacted leads
  active.filter(l => l.stage === 'new' && l.isNew !== false).forEach(lead => {
    if (tasks.some(x => x.lead.id === lead.id)) return;
    tasks.push({ priority: 4, type: 'new_lead', lead,
      action: 'Contact new lead', emoji: '🆕', color: '#22d3ee' });
  });

  // P5: Stale
  active.filter(isStale).forEach(lead => {
    if (tasks.some(x => x.lead.id === lead.id)) return;
    tasks.push({ priority: 5, type: 'stale', lead,
      action: 'Re-engage — stale 7d+', emoji: '💤', color: '#94a3b8' });
  });

  tasks.sort((a, b) =>
    a.priority !== b.priority
      ? a.priority - b.priority
      : (b.lead.value || 0) - (a.lead.value || 0)
  );

  return tasks.slice(0, 8);
}
