/**
 * Workflow templates — define follow-up sequences per lead type.
 * Stored as static constants; only workflowId + workflowStep are persisted per lead.
 */

export const STAGES = ['new', 'contacted', 'proposal', 'won', 'lost'];

export const STAGE_META = {
  new:       { label: 'New',       color: '#22d3ee', bg: 'rgba(34,211,238,0.12)'  },
  contacted: { label: 'Contacted', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  proposal:  { label: 'Proposal',  color: '#a855f7', bg: 'rgba(168,85,247,0.12)'  },
  won:       { label: 'Won',       color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  lost:      { label: 'Lost',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};

export const WORKFLOWS = {
  'follow-up-7day': {
    label: '7-Day Follow-Up',
    description: 'Warm leads — structured 7-day nurture',
    steps: [
      { key: 'day0',  label: 'Add to pipeline',   offsetDays: 0,  actionType: 'note'  },
      { key: 'day1',  label: 'Initial call',       offsetDays: 1,  actionType: 'call'  },
      { key: 'day3',  label: 'Send proposal',      offsetDays: 3,  actionType: 'email' },
      { key: 'day7',  label: 'Follow-up call',     offsetDays: 7,  actionType: 'call'  },
      { key: 'day14', label: 'Decision check-in',  offsetDays: 14, actionType: 'note'  },
    ],
  },
  'quick-close': {
    label: 'Quick Close (3 Days)',
    description: 'Hot leads ready to buy now',
    steps: [
      { key: 'd0', label: 'Contact & qualify', offsetDays: 0, actionType: 'call'  },
      { key: 'd1', label: 'Send proposal',     offsetDays: 1, actionType: 'email' },
      { key: 'd3', label: 'Close or drop',     offsetDays: 3, actionType: 'call'  },
    ],
  },
  'nurture-30day': {
    label: '30-Day Nurture',
    description: 'Cold leads — gradual value-building',
    steps: [
      { key: 'n0',  label: 'First contact',     offsetDays: 0,  actionType: 'call'  },
      { key: 'n3',  label: 'Send value email',  offsetDays: 3,  actionType: 'email' },
      { key: 'n7',  label: 'Check in',          offsetDays: 7,  actionType: 'call'  },
      { key: 'n14', label: 'Send case study',   offsetDays: 14, actionType: 'email' },
      { key: 'n21', label: 'Proposal call',     offsetDays: 21, actionType: 'call'  },
      { key: 'n30', label: 'Decision',          offsetDays: 30, actionType: 'call'  },
    ],
  },
};

export const ACTION_ICON = {
  note:          '📝',
  call:          '📞',
  email:         '✉',
  whatsapp:      '💬',
  stage_change:  '🔄',
  workflow_step: '✅',
  created:       '🆕',
};
