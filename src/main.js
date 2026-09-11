import { initNavbar } from './components/navbar.js';
import { initFooter } from './components/footer.js';
import { initToastRegion } from './components/toast.js';

initNavbar();
initFooter();
initToastRegion();

// One deliberate entrance moment on the hero, not a fade-up on every
// section — kept off entirely for reduced-motion users.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  const heroCopy = document.querySelector('.hero-copy');
  const heroMonitor = document.querySelector('.hero-monitor');

  [heroCopy, heroMonitor].forEach((el, index) => {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'opacity 500ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    el.style.transitionDelay = `${index * 90}ms`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  });
}
