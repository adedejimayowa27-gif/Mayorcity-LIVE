// Renders the public-site navbar + its mobile menu into #navbar-root.
// Authenticated dashboard navigation (Batch 2+) replaces this component
// entirely rather than extending it — public and dashboard are meant to
// have two different visual personalities (see project brief).

const NAV_LINKS = [
  { href: '/#how-it-works', label: 'Home' },
  { href: '/#live-preview', label: 'Live' },
  { href: '/#use-cases', label: 'Events' },
  { href: '/#why', label: 'About' }
];

export function initNavbar({ mountId = 'navbar-root' } = {}) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  mount.innerHTML = `
    <header class="navbar">
      <div class="container navbar-inner">
        <a class="navbar-logo" href="/" aria-label="Broadcast home">
          <span class="dot" aria-hidden="true"></span>
          Broadcast
        </a>

        <nav class="navbar-links" aria-label="Primary">
          ${NAV_LINKS.map((link) => `<a href="${link.href}">${link.label}</a>`).join('')}
        </nav>

        <div class="navbar-actions">
          <a class="btn btn-ghost" href="/signin.html">Sign in</a>
          <a class="btn btn-primary" href="/signup.html">Start broadcasting</a>
        </div>

        <button
          class="navbar-menu-btn"
          id="mobile-menu-open"
          aria-haspopup="true"
          aria-expanded="false"
          aria-controls="mobile-menu"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M2.5 5h15M2.5 10h15M2.5 15h15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </header>

    <div class="mobile-menu" id="mobile-menu" data-open="false" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="mobile-menu-header">
        <a class="navbar-logo" href="/" aria-label="Broadcast home">
          <span class="dot" aria-hidden="true"></span>
          Broadcast
        </a>
        <button class="navbar-menu-btn" id="mobile-menu-close" aria-label="Close menu">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <nav class="mobile-menu-links" aria-label="Primary">
        ${NAV_LINKS.map((link) => `<a href="${link.href}">${link.label}</a>`).join('')}
      </nav>

      <div class="mobile-menu-actions">
        <a class="btn btn-secondary btn-block" href="/signin.html">Sign in</a>
        <a class="btn btn-primary btn-block" href="/signup.html">Start broadcasting</a>
      </div>
    </div>
  `;

  const menu = document.getElementById('mobile-menu');
  const openBtn = document.getElementById('mobile-menu-open');
  const closeBtn = document.getElementById('mobile-menu-close');

  function openMenu() {
    menu.dataset.open = 'true';
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeMenu() {
    menu.dataset.open = 'false';
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    openBtn.focus();
  }

  openBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);

  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.dataset.open === 'true') closeMenu();
  });
}
