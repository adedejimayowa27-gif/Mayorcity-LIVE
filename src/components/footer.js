export function initFooter({ mountId = 'footer-root' } = {}) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const year = new Date().getFullYear();

  mount.innerHTML = `
    <footer class="footer">
      <div class="container footer-inner">
        <a class="navbar-logo" href="/" aria-label="Mayorcity LIVE home">
          <span class="dot" aria-hidden="true"></span>
          Mayorcity LIVE
        </a>

        <nav class="footer-links" aria-label="Footer">
          <a href="/#how-it-works">How it works</a>
          <a href="/events.html">Events</a>
          <a href="/signin.html">Sign in</a>
          <a href="/signup.html">Start broadcasting</a>
        </nav>

        <p class="footer-meta">&copy; ${year} Mayorcity LIVE. All rights reserved.</p>
      </div>
    </footer>
  `;
}
