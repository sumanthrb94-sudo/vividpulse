/*!
 * Shared page JS — Vivid Pulse sub-pages
 * Cursor glow, mobile nav, scroll reveal, smooth scroll
 */
import '/src/style.css';
import { initNavAuth } from '/src/nav-auth.js';
initNavAuth();

// Cursor glow
const cursorGlow = document.getElementById('cursor-glow');
if (cursorGlow) {
  document.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
  });
}

// Mobile nav
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const spans = navToggle.querySelectorAll('span');
    navLinks.classList.contains('open')
      ? (spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)',
         spans[1].style.opacity = '0',
         spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)')
      : (spans.forEach(s => (s.style.transform = '', s.style.opacity = '')));
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// Scroll reveal
const revealObserver = new IntersectionObserver(
  (entries) => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); }),
  { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
);
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
