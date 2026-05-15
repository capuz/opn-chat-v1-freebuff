const STORAGE_KEY = 'chat:sound:enabled';

export type SoundEvent = 'highlight' | 'join' | 'part' | 'privateMessage' | 'mention' | 'error' | 'success' | 'messageSent' | 'messageReceived';

// ── Equal temperament note frequencies (A4 = 440 Hz) ─────────────────────────
const N = {
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
  G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46,
  G5: 783.99, Ab5: 830.61, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98,
};

// ── Core synthesis ────────────────────────────────────────────────────────────

/** Single oscillator note with smooth ADSR envelope */
function osc(
  ctx: AudioContext,
  freq: number,
  t: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
  attack = 0.004,
): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.01);
}

/**
 * Bell timbre: fundamental sine + 2nd harmonic (half volume, 60% duration)
 * + 3rd harmonic (20% volume, 30% duration). Gives a warm chime quality.
 */
function bell(ctx: AudioContext, freq: number, t: number, dur: number, vol = 0.12): void {
  osc(ctx, freq,       t, dur,        vol,        'sine');
  osc(ctx, freq * 2,   t, dur * 0.55, vol * 0.28, 'sine');
  osc(ctx, freq * 3.1, t, dur * 0.28, vol * 0.10, 'sine');
}

/** Soft triangle note — warmer than sine, rounder than square */
function tri(ctx: AudioContext, freq: number, t: number, dur: number, vol = 0.12): void {
  osc(ctx, freq, t, dur, vol, 'triangle', 0.006);
}

/** Sawtooth note — bright/edgy, for error/warning character */
function saw(ctx: AudioContext, freq: number, t: number, dur: number, vol = 0.09): void {
  osc(ctx, freq, t, dur, vol, 'sawtooth', 0.002);
}

function withCtx(fn: (ctx: AudioContext, t: number) => void): void {
  try {
    const ctx = new AudioContext();
    fn(ctx, ctx.currentTime);
    const maxDur = 2.5;
    setTimeout(() => ctx.close().catch(() => {}), maxDur * 1000 + 200);
  } catch { /* AudioContext not available */ }
}

// ── Sound definitions ─────────────────────────────────────────────────────────

const sounds: Record<SoundEvent, () => void> = {

  /**
   * HIGHLIGHT — new message in active channel
   * One soft bell on G5. Non-intrusive, just "hey".
   */
  highlight: () => withCtx((ctx, t) => {
    bell(ctx, N.G5, t, 0.45, 0.10);
  }),

  /**
   * JOIN — user entered the channel
   * Ascending C major arpeggio: C5 → E5 → G5
   * Bright, welcoming "do-mi-sol".
   */
  join: () => withCtx((ctx, t) => {
    bell(ctx, N.C5, t,        0.35, 0.11);
    bell(ctx, N.E5, t + 0.10, 0.35, 0.11);
    bell(ctx, N.G5, t + 0.20, 0.50, 0.12);
  }),

  /**
   * PART — user left the channel
   * Descending G4 → E4 → C4. Same interval as join, reversed.
   * Lower register = "departure" feel.
   */
  part: () => withCtx((ctx, t) => {
    bell(ctx, N.G4, t,        0.30, 0.09);
    bell(ctx, N.E4, t + 0.10, 0.30, 0.09);
    bell(ctx, N.C4, t + 0.20, 0.45, 0.09);
  }),

  /**
   * PRIVATE MESSAGE — direct message received
   * Classic two-tone door bell: E5 → C5 (descending major third).
   * Distinct, intimate, immediately recognizable.
   */
  privateMessage: () => withCtx((ctx, t) => {
    bell(ctx, N.E5, t,        0.5, 0.14);
    bell(ctx, N.C5, t + 0.20, 0.6, 0.14);
  }),

  /**
   * MENTION — your nickname was said
   * Three-note urgent motif: A5 → A5 → C6 (unison + minor third leap up).
   * Triangle wave: cuts through without being harsh.
   */
  mention: () => withCtx((ctx, t) => {
    tri(ctx, N.A5, t,        0.09, 0.16);
    tri(ctx, N.A5, t + 0.11, 0.09, 0.16);
    tri(ctx, N.C6, t + 0.22, 0.18, 0.18);
  }),

  /**
   * ERROR — invalid command, action rejected
   * Chromatic descent: B4 → Bb4 → A4 with sawtooth (naturally dissonant).
   * Short, sharp, tells you "nope" unmistakably.
   */
  error: () => withCtx((ctx, t) => {
    saw(ctx, N.B4,  t,        0.10, 0.11);
    saw(ctx, N.Bb4, t + 0.09, 0.10, 0.10);
    saw(ctx, N.A4,  t + 0.18, 0.16, 0.09);
  }),

  /**
   * SUCCESS — command executed, nick changed, action confirmed
   * Full C major arpeggio up one octave: C5 → E5 → G5 → C6.
   * The classic "level up" chime. Satisfying and complete.
   */
  success: () => withCtx((ctx, t) => {
    bell(ctx, N.C5, t,        0.22, 0.11);
    bell(ctx, N.E5, t + 0.08, 0.22, 0.11);
    bell(ctx, N.G5, t + 0.16, 0.22, 0.12);
    bell(ctx, N.C6, t + 0.24, 0.45, 0.14);
  }),

  /**
   * MESSAGE SENT — you sent a message
   * Single very short sine tick on E6. Barely-there confirmation,
   * like a keyboard key landing softly. Volume kept very low.
   */
  messageSent: () => withCtx((ctx, t) => {
    osc(ctx, N.E6, t, 0.06, 0.055, 'sine', 0.003);
  }),

  /**
   * MESSAGE RECEIVED — someone else posted in the active channel
   * A soft sine on D5 — lower and quieter than highlight (G5),
   * so it doesn't compete with mentions. Just a gentle "blip".
   */
  messageReceived: () => withCtx((ctx, t) => {
    osc(ctx, N.D5, t, 0.12, 0.055, 'sine', 0.005);
  }),
};

// ── Public API ────────────────────────────────────────────────────────────────

let enabled = (() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === 'true';
})();

export const chatSounds = {
  play(event: SoundEvent): void {
    if (!enabled) return;
    sounds[event]?.();
  },

  setEnabled(value: boolean): void {
    enabled = value;
    localStorage.setItem(STORAGE_KEY, String(value));
  },

  loadSettings(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    enabled = stored === null ? true : stored === 'true';
  },

  isEnabled(): boolean {
    return enabled;
  },
};
