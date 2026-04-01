/*!
 * Content Studio — Vivid Pulse
 * 3-step AI content creation: Claude (plan) → Human review → Gemini (generate)
 * Pro-only: sumanthrb94@gmail.com; daily video limit = 2
 */
import '/src/style.css';
import { requireAuth, logout } from '/src/auth.js';
import { db } from '/src/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

// ============================
// PRO ACCESS CONTROL
// ============================
const PRO_EMAILS = ['sumanthrb94@gmail.com'];
const VIDEO_TYPES = ['video', 'reel'];
const DAILY_VIDEO_LIMIT = 2;

// ============================
// STATE
// ============================
let currentUser   = null;
let currentPlan   = null;
let currentResult = null;
let inputSnapshot = {}; // { contentType, platform, brief }

// ============================
// AUTH GUARD
// ============================
requireAuth('/login').then(async (user) => {
  currentUser = user;

  // Pro gate
  if (!PRO_EMAILS.includes(user.email)) {
    document.querySelector('main').innerHTML = `
      <div style="text-align:center; padding:5rem 2rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">🔒</div>
        <h2 style="margin-bottom:0.75rem;">Pro Feature</h2>
        <p style="color:var(--text-dim); margin-bottom:1.5rem;">The AI Content Studio is available on the Pro plan.<br>Upgrade to unlock AI-powered content creation.</p>
        <a href="/dashboard" class="btn btn-primary">Back to Dashboard</a>
      </div>`;
    return;
  }

  // Navbar
  const emailEl   = document.getElementById('user-email');
  const logoutBtn = document.getElementById('logout-btn');
  if (emailEl)   { emailEl.textContent = user.email; emailEl.style.display = ''; }
  if (logoutBtn) {
    logoutBtn.style.display = '';
    logoutBtn.addEventListener('click', () =>
      logout().then(() => { window.location.href = '/login'; })
    );
  }

  // Load past content for history context + show usage
  await loadHistory();
  await checkUsageBanner();

  initPlanForm();
  initReviewStep();
  initMobileNav();
});

// ============================
// HISTORY (last 5 content pieces for Claude context)
// ============================
let contentHistory = [];

async function loadHistory() {
  try {
    const col = collection(db, 'users', currentUser.uid, 'contentItems');
    const q   = query(col, orderBy('createdAt', 'desc'), limit(5));
    const snap = await getDocs(q);
    contentHistory = snap.docs.map(d => {
      const data = d.data();
      return data.title || data.topic || data.platform || 'Untitled';
    });

    if (contentHistory.length > 0) {
      const histDiv  = document.getElementById('history-preview');
      const histList = document.getElementById('history-list');
      histDiv.style.display = '';
      histList.innerHTML = contentHistory.map((h, i) => `<div style="padding:0.2rem 0; opacity:0.8;">${i + 1}. ${h}</div>`).join('');
    }
  } catch (e) {
    // Non-critical
  }
}

// ============================
// USAGE TRACKING (videos per day)
// ============================
async function checkUsageBanner() {
  try {
    const usageRef = doc(db, 'users', currentUser.uid, 'meta', 'usage');
    const snap = await getDoc(usageRef);
    if (!snap.exists()) return;

    const data  = snap.data();
    const today = new Date().toISOString().split('T')[0];
    if (data.date !== today) return;

    const used = data.videosToday || 0;
    const banner = document.getElementById('usage-banner');
    if (used >= DAILY_VIDEO_LIMIT) {
      banner.style.display = '';
      banner.textContent = `⚠ You've used ${used}/${DAILY_VIDEO_LIMIT} video generations today. Video & Reel types are unavailable until tomorrow.`;
    } else if (used > 0) {
      banner.style.display = '';
      banner.textContent   = `📹 ${used}/${DAILY_VIDEO_LIMIT} video generations used today.`;
    }
  } catch (e) {
    // Non-critical
  }
}

async function incrementVideoUsage() {
  const usageRef = doc(db, 'users', currentUser.uid, 'meta', 'usage');
  const today    = new Date().toISOString().split('T')[0];

  try {
    const snap = await getDoc(usageRef);
    const data = snap.exists() ? snap.data() : {};

    const currentDate  = data.date || '';
    const currentCount = currentDate === today ? (data.videosToday || 0) : 0;

    await setDoc(usageRef, { date: today, videosToday: currentCount + 1 }, { merge: true });
  } catch (e) {
    console.error('Failed to track usage:', e);
  }
}

async function getVideoUsageToday() {
  try {
    const usageRef = doc(db, 'users', currentUser.uid, 'meta', 'usage');
    const snap     = await getDoc(usageRef);
    if (!snap.exists()) return 0;
    const data  = snap.data();
    const today = new Date().toISOString().split('T')[0];
    return data.date === today ? (data.videosToday || 0) : 0;
  } catch {
    return 0;
  }
}

// ============================
// STEP NAVIGATION
// ============================
function goToStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById('step-' + i).style.display = i === n ? '' : 'none';
    const dot = document.getElementById('dot-' + i);
    dot.classList.toggle('active', i <= n);
    dot.classList.toggle('done', i < n);
  });
  [1, 2].forEach(i => {
    const line = document.getElementById('line-' + i);
    if (line) line.classList.toggle('done', i < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================
// STEP 1: PLAN FORM
// ============================
function initPlanForm() {
  const form      = document.getElementById('plan-form');
  const briefEl   = document.getElementById('brief');
  const countEl   = document.getElementById('brief-count');

  briefEl.addEventListener('input', () => {
    countEl.textContent = briefEl.value.length + ' / 500';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const contentType = document.getElementById('content-type').value;
    const platform    = document.getElementById('platform').value;
    const brief       = briefEl.value.trim();

    // Check video limit
    if (VIDEO_TYPES.includes(contentType)) {
      const used = await getVideoUsageToday();
      if (used >= DAILY_VIDEO_LIMIT) {
        alert(`Daily limit reached: You can only generate ${DAILY_VIDEO_LIMIT} videos/reels per day. Remaining resets at midnight.`);
        return;
      }
    }

    inputSnapshot = { contentType, platform, brief };

    // Loading state
    document.getElementById('plan-btn-text').style.display    = 'none';
    document.getElementById('plan-btn-loading').style.display = '';
    document.getElementById('plan-btn').disabled              = true;

    try {
      const res = await fetch('/api/plan-content', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, platform, brief, history: contentHistory }),
      });

      const data = await res.json();

      if (!res.ok || !data.plan) {
        throw new Error(data.error || 'Planning failed');
      }

      currentPlan = data.plan;
      renderPlanReview(data.plan);
      goToStep(2);
    } catch (err) {
      alert('Planning failed: ' + err.message);
    } finally {
      document.getElementById('plan-btn-text').style.display    = '';
      document.getElementById('plan-btn-loading').style.display = 'none';
      document.getElementById('plan-btn').disabled              = false;
    }
  });
}

// ============================
// STEP 2: REVIEW & EDIT
// ============================
function renderPlanReview(plan) {
  const display = document.getElementById('plan-display');
  display.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div class="plan-field">
        <div class="plan-field-label">Title</div>
        <div class="plan-field-value" id="pf-title" contenteditable="true">${esc(plan.title)}</div>
      </div>
      <div class="plan-field">
        <div class="plan-field-label">Hook</div>
        <div class="plan-field-value" id="pf-hook" contenteditable="true">${esc(plan.hook)}</div>
      </div>
      <div class="plan-field">
        <div class="plan-field-label">Structure</div>
        <div class="plan-field-value" id="pf-structure" contenteditable="true">${(plan.structure || []).join('\n')}</div>
      </div>
      <div class="plan-field" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div>
          <div class="plan-field-label">Tone</div>
          <div class="plan-field-value" id="pf-tone" contenteditable="true">${esc(plan.tone)}</div>
        </div>
        <div>
          <div class="plan-field-label">Hashtags</div>
          <div class="plan-field-value" id="pf-hashtags" contenteditable="true">${(plan.hashtags || []).join(' ')}</div>
        </div>
      </div>
    </div>
  `;

  // Pre-fill editable prompt hints
  const hints = plan.promptHints || {};
  document.getElementById('edit-visual').value  = hints.visual  || '';
  document.getElementById('edit-caption').value = hints.caption || '';
  document.getElementById('edit-cta').value     = hints.cta     || '';
}

function getEditedPlan() {
  const structure = (document.getElementById('pf-structure')?.innerText || '').split('\n').filter(Boolean);
  const hashtags  = (document.getElementById('pf-hashtags')?.innerText  || '').split(/\s+/).filter(h => h.startsWith('#') || h.length > 0).map(h => h.startsWith('#') ? h : '#' + h);

  return {
    ...currentPlan,
    title:     document.getElementById('pf-title')?.innerText     || currentPlan.title,
    hook:      document.getElementById('pf-hook')?.innerText      || currentPlan.hook,
    structure,
    tone:      document.getElementById('pf-tone')?.innerText      || currentPlan.tone,
    hashtags,
  };
}

function initReviewStep() {
  document.getElementById('back-to-step1').addEventListener('click', () => goToStep(1));

  document.getElementById('generate-btn').addEventListener('click', async () => {
    const editedPlan = getEditedPlan();
    const editedPrompts = {
      visualPrompt:  document.getElementById('edit-visual').value.trim(),
      captionPrompt: document.getElementById('edit-caption').value.trim(),
      ctaPrompt:     document.getElementById('edit-cta').value.trim(),
    };

    document.getElementById('gen-btn-text').style.display    = 'none';
    document.getElementById('gen-btn-loading').style.display = '';
    document.getElementById('generate-btn').disabled         = true;

    try {
      const res = await fetch('/api/generate-content', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: inputSnapshot.contentType,
          platform:    inputSnapshot.platform,
          plan:        editedPlan,
          editedPrompts,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.result) {
        throw new Error(data.error || 'Generation failed');
      }

      currentResult = data.result;

      // Track video usage
      if (VIDEO_TYPES.includes(inputSnapshot.contentType)) {
        await incrementVideoUsage();
        await checkUsageBanner();
      }

      renderResult(data.result, editedPlan);
      goToStep(3);
    } catch (err) {
      alert('Generation failed: ' + err.message);
    } finally {
      document.getElementById('gen-btn-text').style.display    = '';
      document.getElementById('gen-btn-loading').style.display = 'none';
      document.getElementById('generate-btn').disabled         = false;
    }
  });
}

// ============================
// STEP 3: RESULT
// ============================
function renderResult(result, plan) {
  const display = document.getElementById('result-display');

  const scriptSection = result.script ? `
    <div class="result-section">
      <div class="result-section-label">Script / Narration</div>
      <div class="result-content" id="res-script">${esc(result.script).replace(/\n/g, '<br>')}</div>
      <button class="copy-btn" data-target="res-script">Copy Script</button>
    </div>` : '';

  display.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      ${scriptSection}
      <div class="result-section">
        <div class="result-section-label">Caption</div>
        <div class="result-content" id="res-caption">${esc(result.caption).replace(/\n/g, '<br>')}</div>
        <button class="copy-btn" data-target="res-caption">Copy Caption</button>
      </div>
      <div class="result-section">
        <div class="result-section-label">Hashtags</div>
        <div class="result-content" id="res-hashtags" style="display:flex; flex-wrap:wrap; gap:0.4rem;">
          ${(result.hashtags || []).map(h => `<span style="background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.2); border-radius:6px; padding:0.2rem 0.5rem; font-size:0.8rem;">${esc(h)}</span>`).join('')}
        </div>
        <button class="copy-btn" data-target="res-hashtags-text" data-text="${esc((result.hashtags || []).join(' '))}">Copy Hashtags</button>
      </div>
      <div class="result-section">
        <div class="result-section-label">Image Prompt (for DALL-E / Midjourney)</div>
        <div class="result-content" id="res-image-prompt">${esc(result.imagePrompt)}</div>
        <button class="copy-btn" data-target="res-image-prompt">Copy Prompt</button>
      </div>
      ${result.notes ? `
      <div class="result-section" style="background:rgba(16,185,129,0.04); border-color:rgba(16,185,129,0.15);">
        <div class="result-section-label" style="color:#10b981;">Production Notes</div>
        <div style="font-size:0.85rem; color:var(--text-dim); line-height:1.6;">${esc(result.notes).replace(/\n/g, '<br>')}</div>
      </div>` : ''}
    </div>
  `;

  // Copy buttons
  display.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text || document.getElementById(btn.dataset.target)?.innerText || '';
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      });
    });
  });

  // Save to engine handler
  document.getElementById('save-to-engine').onclick = async () => {
    await saveToContentEngine(plan, result);
  };

  // Start over
  document.getElementById('start-over').onclick = () => {
    currentPlan   = null;
    currentResult = null;
    inputSnapshot = {};
    document.getElementById('plan-form').reset();
    document.getElementById('brief-count').textContent = '0 / 500';
    goToStep(1);
  };
}

// ============================
// SAVE TO CONTENT ENGINE
// ============================
async function saveToContentEngine(plan, result) {
  try {
    const col  = collection(db, 'users', currentUser.uid, 'contentItems');
    const id   = 'cs_' + Date.now();
    const item = {
      title:       plan.title || 'AI-Generated Content',
      platform:    inputSnapshot.platform || 'instagram',
      topic:       inputSnapshot.brief    || '',
      status:      'draft',
      caption:     result.caption         || '',
      hashtags:    (result.hashtags || []).join(' '),
      imagePrompt: result.imagePrompt     || '',
      script:      result.script          || '',
      contentType: inputSnapshot.contentType || 'post',
      aiGenerated: true,
      createdAt:   serverTimestamp(),
      date:        new Date().toISOString().split('T')[0],
    };

    await setDoc(doc(col, id), item);

    const btn = document.getElementById('save-to-engine');
    btn.textContent = '✓ Saved!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = 'Save to Content Engine'; btn.disabled = false; }, 2000);
  } catch (err) {
    alert('Save failed: ' + err.message);
  }
}

// ============================
// UTILS
// ============================
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initMobileNav() {
  const toggle  = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  const overlay  = document.getElementById('nav-overlay');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    navLinks?.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    navLinks?.classList.remove('open');
    overlay?.classList.remove('open');
  });
}
