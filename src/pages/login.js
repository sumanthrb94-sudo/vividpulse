/*!
 * Login / Register Page Logic — Vivid Pulse
 * Handles: Google Sign-In (GCP OAuth), email/password sign-in, registration.
 * On success, redirects to the CRM dashboard.
 */
import '/src/style.css';
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  redirectIfAuthenticated,
} from '/src/auth.js';

// ── Redirect authenticated users straight to CRM ─────────────────────────────
redirectIfAuthenticated('/crm');

// ── DOM refs ──────────────────────────────────────────────────────────────────
const tabBtns        = document.querySelectorAll('.auth-tab');
const loginForm      = document.getElementById('login-form');
const registerForm   = document.getElementById('register-form');
const btnGoogle      = document.getElementById('btn-google');
const errorBox       = document.getElementById('auth-error');
const successBox     = document.getElementById('auth-success');
const authHeading    = document.getElementById('auth-heading');
const authSub        = document.getElementById('auth-sub');

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
  successBox.style.display = 'none';
}

function showSuccess(msg) {
  successBox.textContent = msg;
  successBox.style.display = 'block';
  errorBox.style.display = 'none';
}

function clearMessages() {
  errorBox.style.display   = 'none';
  successBox.style.display = 'none';
}

function setLoading(btn, loading) {
  btn.disabled    = loading;
  btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
}

function friendlyError(code) {
  const map = {
    'auth/invalid-email':             'Please enter a valid email address.',
    'auth/user-not-found':            'No account found with this email.',
    'auth/wrong-password':            'Incorrect password. Please try again.',
    'auth/invalid-credential':        'Invalid email or password.',
    'auth/email-already-in-use':      'An account with this email already exists.',
    'auth/weak-password':             'Password must be at least 6 characters.',
    'auth/too-many-requests':         'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user':      'Sign-in popup was closed. Please try again.',
    'auth/network-request-failed':    'Network error. Check your connection.',
    'auth/cancelled-popup-request':   'Only one sign-in popup at a time.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Tab switching ─────────────────────────────────────────────────────────────
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    clearMessages();
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    if (tab === 'login') {
      loginForm.style.display    = '';
      registerForm.style.display = 'none';
      authHeading.textContent    = 'Welcome back';
      authSub.textContent        = 'Sign in to access your CRM dashboard';
    } else {
      loginForm.style.display    = 'none';
      registerForm.style.display = '';
      authHeading.textContent    = 'Create account';
      authSub.textContent        = 'Get started with Vivid Pulse CRM';
    }
  });
});

// ── Google Sign-In (GCP OAuth) ────────────────────────────────────────────────
btnGoogle.dataset.label = 'Continue with Google';
btnGoogle.addEventListener('click', async () => {
  clearMessages();
  setLoading(btnGoogle, true);
  try {
    await signInWithGoogle();
    showSuccess('Signed in! Redirecting…');
    window.location.href = '/dashboard';
  } catch (err) {
    showError(friendlyError(err.code));
    setLoading(btnGoogle, false);
    // Restore Google button text with icon (re-render workaround)
    btnGoogle.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google`;
  }
});

// ── Email/Password Sign-In ────────────────────────────────────────────────────
const loginSubmit = document.getElementById('login-submit');
loginSubmit.dataset.label = 'Sign In →';

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();
  setLoading(loginSubmit, true);

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    await signInWithEmail(email, password);
    showSuccess('Signed in! Redirecting…');
    window.location.href = '/dashboard';
  } catch (err) {
    showError(friendlyError(err.code));
    setLoading(loginSubmit, false);
  }
});

// ── Registration ──────────────────────────────────────────────────────────────
const registerSubmit = document.getElementById('register-submit');
registerSubmit.dataset.label = 'Create Account →';

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;

  if (password !== confirm) {
    showError('Passwords do not match.');
    return;
  }

  setLoading(registerSubmit, true);
  try {
    await registerWithEmail(email, password);
    showSuccess('Account created! Redirecting…');
    window.location.href = '/dashboard';
  } catch (err) {
    showError(friendlyError(err.code));
    setLoading(registerSubmit, false);
  }
});

// ── Cursor glow (matches other pages) ────────────────────────────────────────
const glow = document.getElementById('cursor-glow');
if (glow) {
  document.addEventListener('mousemove', (e) => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
  });
}
