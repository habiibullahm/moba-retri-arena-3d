/**
 * Pure WebAudio procedural combat SFX synthesizer (non-musical action game SFX)
 * Generates sword slashes, dash whooshes, shield parries, boss ground impacts,
 * lightning Retribution thunder, and announcer stingers.
 */
class CombatSoundFx {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.65;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.65,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playSlash(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    // High-velocity blade whoosh + metallic ting
    this.playNoiseBurst(ctx, now, 0.08, 1800, 4200, 0.25);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playShurikenSkill(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    [0, 0.055].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920 + idx * 240, now + offset);
      osc.frequency.exponentialRampToValueAtTime(260, now + offset + 0.13);

      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  }

  public playDashBlink(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    this.playNoiseBurst(ctx, now, 0.14, 900, 3200, 0.28);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playShieldParry(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(1040, now + 0.18);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playOrbitalUlti(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    // Deep orbital beam drop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.42);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.46);

    this.playNoiseBurst(ctx, now, 0.35, 300, 2200, 0.32);
  }

  public playRetributionSmite(isSuccess: boolean): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    // Thunder crack noise
    this.playNoiseBurst(ctx, now, 0.38, 400, 4800, 0.45);

    // Sharp electric zap descent
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isSuccess ? 1480 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(isSuccess ? 65 : 110, now + 0.35);

    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playBossSlam(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    // Sub-bass seismic thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.36);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);

    this.playNoiseBurst(ctx, now, 0.22, 120, 900, 0.3);
  }

  private playNoiseBurst(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    minFreq: number,
    maxFreq: number,
    volume: number
  ): void {
    if (!this.masterGain) return;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime((minFreq + maxFreq) * 0.5, startTime);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(startTime);
  }
}

export const combatSfx = new CombatSoundFx();
