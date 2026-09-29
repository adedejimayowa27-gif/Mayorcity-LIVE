// Landscape helpers. Screen orientation lock works on Android Chrome (and
// most Android browsers), usually only while the page is fullscreen.
// iPhone Safari does not support it — there the user rotates the phone.

export async function lockLandscape() {
  try {
    await screen.orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  try {
    screen.orientation.unlock();
  } catch {
    /* not supported — nothing to undo */
  }
}
