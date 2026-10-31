/** A soft two-note chime for new alerts, made with Web Audio so there is no sound file to load. */
let ctx: AudioContext | null = null;

/** Browsers only allow audio after a click, so the sound toggle calls this first. */
export function unlockSound() {
  if (typeof window === "undefined") return;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

export function playChime(urgent: boolean) {
  if (!ctx || ctx.state !== "running") return;
  const notes = urgent ? [784, 1046.5] : [659.3, 880];
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    const t = ctx!.currentTime + i * 0.16;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}
