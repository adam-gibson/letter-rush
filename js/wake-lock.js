// Keeps the screen on (Screen Wake Lock API). The browser releases the lock when
// the tab is hidden, so it is re-acquired when the page becomes visible again.
let sentinel = null;
let wanted = false;

export const supported = 'wakeLock' in navigator;

async function acquire() {
  if (!supported || sentinel) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch {
    sentinel = null; // e.g. low battery or permission refused
  }
}

export async function requestWakeLock() {
  wanted = true;
  await acquire();
}

export async function releaseWakeLock() {
  wanted = false;
  await sentinel?.release();
  sentinel = null;
}

document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') acquire();
});
