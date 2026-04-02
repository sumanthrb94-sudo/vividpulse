/*!
 * Public Lead Capture Form — Vivid Pulse
 * No authentication required.
 * Reads ?u=USER_ID from the URL and writes the submission to
 * Firestore: users/{userId}/leads/{newLeadId}
 * Firestore rules allow unauthenticated create-only on this path.
 */
import '/src/style.css';
import { db } from '/src/firebase.js';
import { collection, doc, setDoc } from 'firebase/firestore';

// ── Parse user ID from query string ──────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const userId = params.get('u');

const show = (id) => {
  ['state-loading', 'state-error', 'state-success', 'state-form'].forEach(s => {
    document.getElementById(s).style.display = s === id ? '' : 'none';
  });
};

if (!userId) {
  show('state-error');
} else {
  show('state-form');
}

// ── Form submission ───────────────────────────────────────────────────────────
const form      = document.getElementById('lead-form');
const submitBtn = document.getElementById('form-submit');
const errorBox  = document.getElementById('form-error');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';

    const name    = document.getElementById('f-name').value.trim();
    const company = document.getElementById('f-company').value.trim();
    const phone   = document.getElementById('f-phone').value.trim();
    const email   = document.getElementById('f-email').value.trim();
    const budget  = parseInt(document.getElementById('f-budget').value) || 0;
    const message = document.getElementById('f-message').value.trim();

    if (!name) {
      errorBox.textContent = 'Please enter your name.';
      errorBox.style.display = 'block';
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending…';

    try {
      const id  = 'form-' + Date.now();
      const ref = doc(collection(db, 'users', userId, 'leads'), id);

      await setDoc(ref, {
        name,
        company:  company || 'Unknown',
        phone:    phone   || '',
        email:    email   || '',
        message:  message || '',
        value:    budget,
        stage:    'new',
        source:   'form',
        date:     new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
      });

      show('state-success');
    } catch (err) {
      console.error('Form submit error:', err);
      errorBox.textContent = 'Something went wrong. Please try again.';
      errorBox.style.display = 'block';
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send Enquiry →';
    }
  });
}

// ── Cursor glow ───────────────────────────────────────────────────────────────
const glow = document.getElementById('cursor-glow');
if (glow) {
  document.addEventListener('mousemove', (e) => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
  });
}
