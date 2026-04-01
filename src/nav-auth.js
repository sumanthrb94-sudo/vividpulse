/*!
 * nav-auth.js — Vivid Pulse
 * Watches Firebase auth state and updates the public navbar:
 *   - Logged OUT → "Sign In" button
 *   - Logged IN  → user avatar chip with dropdown (Dashboard, Sign Out)
 *
 * Imported by: main.js, page-shared.js, content.js
 */
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';
import { logout } from './auth.js';

export function initNavAuth() {
  const signinLink = document.getElementById('nav-signin');
  if (!signinLink) return; // not a public navbar page

  onAuthStateChanged(auth, (user) => {
    if (user) {
      _renderLoggedIn(signinLink, user);
    } else {
      _renderLoggedOut(signinLink);
    }
  });
}

function _renderLoggedOut(signinLink) {
  signinLink.outerHTML = `<a href="/login" class="btn btn-outline btn-sm" id="nav-signin">Sign In</a>`;
}

function _renderLoggedIn(signinLink, user) {
  const name   = user.displayName || user.email.split('@')[0];
  const avatar = user.photoURL
    ? `<img src="${user.photoURL}" alt="" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;" />`
    : `<span style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff;flex-shrink:0;">${name[0].toUpperCase()}</span>`;

  signinLink.outerHTML = `
    <div class="nav-user-menu" id="nav-user-menu">
      <button class="nav-user-chip" id="nav-user-chip" aria-haspopup="true" aria-expanded="false">
        ${avatar}
        <span class="nav-user-name">${name}</span>
        <span class="nav-user-chevron">▾</span>
      </button>
      <div class="nav-dropdown" id="nav-dropdown" role="menu">
        <div class="nav-dropdown-email">${user.email}</div>
        <a href="/dashboard" class="nav-dropdown-item" role="menuitem">
          <span class="material-icons" style="font-size:1rem;">dashboard</span> Dashboard
        </a>
        <a href="/crm" class="nav-dropdown-item" role="menuitem">
          <span class="material-icons" style="font-size:1rem;">view_kanban</span> CRM Pipeline
        </a>
        <a href="/content-studio" class="nav-dropdown-item" role="menuitem" id="nav-studio-item" style="display:none;">
          <span class="material-icons" style="font-size:1rem;">auto_awesome</span> AI Studio
        </a>
        <div class="nav-dropdown-divider"></div>
        <button class="nav-dropdown-item nav-dropdown-signout" id="nav-signout-btn" role="menuitem">
          <span class="material-icons" style="font-size:1rem;">logout</span> Sign Out
        </button>
      </div>
    </div>`;

  // Show AI Studio link for pro/all-access users
  const ALL_ACCESS = ['sumanthbolla97@gmail.com', 'sumanthrb94@gmail.com'];
  if (ALL_ACCESS.includes(user.email)) {
    const studioItem = document.getElementById('nav-studio-item');
    if (studioItem) studioItem.style.display = '';
  }

  // Toggle dropdown
  const chip     = document.getElementById('nav-user-chip');
  const dropdown = document.getElementById('nav-dropdown');
  const menu     = document.getElementById('nav-user-menu');

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('open');
    chip.setAttribute('aria-expanded', open);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) {
      dropdown.classList.remove('open');
      chip.setAttribute('aria-expanded', 'false');
    }
  });

  // Sign out
  document.getElementById('nav-signout-btn').addEventListener('click', () => {
    logout().then(() => { window.location.href = '/login'; });
  });
}
