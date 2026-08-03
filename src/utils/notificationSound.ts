/**
 * Notification Sound Utility
 *
 * Plays a subtle notification sound using the Web Audio API.
 * No external audio files needed - generates a pleasant tone programmatically.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a notification sound (two-tone chime).
 * Uses Web Audio API - no files needed.
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 587.33; // D5
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Second tone (slightly higher, delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 783.99; // G5
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    gain2.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio not available - silently ignore
  }
}
