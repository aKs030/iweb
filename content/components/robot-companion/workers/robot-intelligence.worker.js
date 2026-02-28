const IDLE_THRESHOLD_MS = 60000;

const state = {
  lastMoveTime: Date.now(),
  lastMouseX: 0,
  lastMouseY: 0,
  lastScrollTime: Date.now(),
  lastScrollY: 0,
  lastScrollDirection: 'down',
  scrollBackAndForth: 0,
  scrollDecayTimer: null,
  lastInteractionTime: Date.now(),
  isIdle: false,
};

function markInteraction(now = Date.now()) {
  state.lastInteractionTime = now;
  if (!state.isIdle) return;
  state.isIdle = false;
  postMessage({ type: 'idle-reset' });
}

function handleMouseMove(payload) {
  const now = Number(payload?.now) || Date.now();
  markInteraction(now);

  const dt = now - state.lastMoveTime;
  if (dt <= 100) return;

  const x = Number(payload?.x) || 0;
  const y = Number(payload?.y) || 0;
  const dist = Math.hypot(x - state.lastMouseX, y - state.lastMouseY);
  const speed = dist / dt;

  state.lastMouseX = x;
  state.lastMouseY = y;
  state.lastMoveTime = now;

  if (speed > 3.5) {
    postMessage({ type: 'hectic' });
  }
}

function handleScroll(payload) {
  const now = Number(payload?.now) || Date.now();
  markInteraction(now);

  const scrollY = Number(payload?.scrollY) || 0;
  const dt = now - state.lastScrollTime;
  if (dt <= 100) return;

  const dist = Math.abs(scrollY - state.lastScrollY);
  const speed = dist / dt;
  const direction = scrollY > state.lastScrollY ? 'down' : 'up';

  if (direction !== state.lastScrollDirection) {
    state.scrollBackAndForth += 1;
    if (state.scrollBackAndForth >= 5) {
      state.scrollBackAndForth = 0;
      postMessage({ type: 'frustration' });
    }
  }

  state.lastScrollDirection = direction;
  state.lastScrollY = scrollY;
  state.lastScrollTime = now;

  if (speed > 5) {
    postMessage({ type: 'scroll-fast' });
  }

  if (state.scrollDecayTimer) clearTimeout(state.scrollDecayTimer);
  state.scrollDecayTimer = setTimeout(() => {
    if (state.scrollBackAndForth > 0) {
      state.scrollBackAndForth = Math.max(0, state.scrollBackAndForth - 1);
    }
    state.scrollDecayTimer = null;
  }, 3000);
}

function checkIdle(payload) {
  const now = Number(payload?.now) || Date.now();
  if (payload?.chatOpen) return;

  const idleTime = now - state.lastInteractionTime;
  if (idleTime <= IDLE_THRESHOLD_MS || state.isIdle) return;

  state.isIdle = true;
  postMessage({ type: 'idle' });
}

onmessage = (event) => {
  const payload = event?.data || {};
  const type = String(payload.type || '');

  switch (type) {
    case 'init':
      markInteraction(Number(payload.now) || Date.now());
      state.lastMoveTime = Number(payload.now) || Date.now();
      state.lastScrollTime = Number(payload.now) || Date.now();
      break;
    case 'activity':
      markInteraction(Number(payload.now) || Date.now());
      break;
    case 'mousemove':
      handleMouseMove(payload);
      break;
    case 'scroll':
      handleScroll(payload);
      break;
    case 'idle-check':
      checkIdle(payload);
      break;
    default:
      break;
  }
};
