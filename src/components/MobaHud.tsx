import React, { useRef, useState } from 'react';
import {
  Flame,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  Share2,
  Check,
} from 'lucide-react';
import {
  BOSS_MAX_HP,
  DifficultyMode,
  HudSnapshot,
  RETRI_THRESHOLD_HP,
  SKILL_METAS,
  SkillId,
} from '../game/types';

interface MobaHudProps {
  hud: HudSnapshot;
  difficulty: DifficultyMode;
  onChangeDifficulty: (mode: DifficultyMode) => void;
  onTriggerSkill: (skillId: SkillId) => void;
  onMoveJoystick: (x: number, y: number) => void;
  onResetRound: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const MobaHud: React.FC<MobaHudProps> = ({
  hud,
  difficulty,
  onChangeDifficulty,
  onTriggerSkill,
  onMoveJoystick,
  onResetRound,
  isMuted,
  onToggleMute,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [joystickActive, setJoystickActive] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const maxRadius = 44;

  const updateJoystickFromPoint = (clientX: number, clientY: number) => {
    const base = joystickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    setKnobPos({ x: kx, y: ky });
    onMoveJoystick(kx / maxRadius, ky / maxRadius);
  };

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setJoystickActive(true);
    updateJoystickFromPoint(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickActive) return;
    e.stopPropagation();
    updateJoystickFromPoint(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setJoystickActive(false);
    setKnobPos({ x: 0, y: 0 });
    onMoveJoystick(0, 0);
  };

  const bossHpPct = Math.max(0, Math.min(100, (hud.bossHp / BOSS_MAX_HP) * 100));
  const retriLinePct = (RETRI_THRESHOLD_HP / BOSS_MAX_HP) * 100;
  const heroHpPct = Math.max(
    0,
    Math.min(100, (hud.heroHp / hud.heroMaxHp) * 100)
  );

  const handleShareResult = () => {
    if (!hud.roundStats) return;
    const s = hud.roundStats;
    const rxText = s.retriReactionMs ? `${s.retriReactionMs}ms` : 'Gagal Retri';
    const text = `⚔️ SENTINEL LORD // 3D MOBA RETRI TEST\nRank Mekanik: [${s.grade}] ${s.titleIndo}\n⚡ Refleks Retri: ${rxText}\n🔥 Dodge AoE: ${s.dodgedCount}x | APM: ${s.apm}\nCoba tes mekanik Retri lu di: https://habiibullahm.github.io/moba-retri-arena-3d/`;
    navigator.clipboard?.writeText(text);
    setCopiedShare(true);
    window.setTimeout(() => setCopiedShare(false), 2000);
  };

  const renderSkillButton = (
    skillId: SkillId,
    sizeClass: string,
    extraClass = ''
  ) => {
    const meta = SKILL_METAS[skillId];
    const cd = hud.cooldownsRemaining[skillId] || 0;
    const isOnCd = cd > 0.05;
    const isRetri = skillId === 'retri';
    const highlightRetri = isRetri && hud.inRetriZone && !isOnCd;

    return (
      <button
        key={skillId}
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          onTriggerSkill(skillId);
        }}
        className={`relative flex flex-col items-center justify-center rounded-full border-2 font-mono transition active:scale-90 ${sizeClass} ${extraClass} ${
          highlightRetri
            ? 'animate-pulse border-white bg-[#ff2e4c] text-white shadow-[0_0_28px_#ff2e4c]'
            : isOnCd
            ? 'border-white/15 bg-slate-900/90 text-slate-500'
            : 'border-white/35 bg-slate-900/85 text-white shadow-lg backdrop-blur-md hover:border-white'
        }`}
        style={{
          boxShadow:
            !isOnCd && !highlightRetri
              ? `0 0 16px ${meta.color}40`
              : undefined,
          borderColor: !isOnCd && !highlightRetri ? meta.color : undefined,
        }}
      >
        {/* Skill Icon / Label */}
        <span className="text-[10px] font-extrabold tracking-tighter md:text-xs">
          {skillId === 'basic'
            ? 'ATK'
            : skillId === 'retri'
            ? 'RETRI'
            : skillId.toUpperCase()}
        </span>
        <span className="text-[8px] font-semibold opacity-75">
          [{meta.keybind}]
        </span>

        {/* Cooldown Overlay */}
        {isOnCd && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/75 font-mono text-xs font-extrabold text-amber-400">
            {cd.toFixed(1)}s
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 md:p-5">
      {/* =====================================================================
          TOP BAR: SENTINEL LORD HP BAR + RETRI THRESHOLD + MODE SWITCHER
      ===================================================================== */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Brand & Mode Selector */}
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0b101d]/90 p-1.5 backdrop-blur-xl">
            {(
              [
                { id: 'normal', label: 'RANKED' },
                { id: 'mythic', label: 'MYTHIC FAST-HAND' },
                { id: 'auto_demo', label: 'AI DEMO' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeDifficulty(m.id)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold transition md:text-xs ${
                  difficulty === m.id
                    ? 'bg-[#00f0ff] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Right Audio & Reset Buttons */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              onClick={onResetRound}
              className="flex items-center gap-1 rounded-xl border border-white/15 bg-[#0b101d]/90 px-2.5 py-1.5 font-mono text-[10px] font-bold text-slate-200 backdrop-blur-xl hover:border-white/30 md:text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#00f0ff]" />
              <span>ULANG</span>
            </button>

            <button
              onClick={onToggleMute}
              className="flex items-center justify-center rounded-xl border border-white/15 bg-[#0b101d]/90 p-1.5 text-slate-200 backdrop-blur-xl hover:border-white/30"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#00f0ff]" />
              )}
            </button>
          </div>
        </div>

        {/* BOSS HP BAR WITH 2500 RETRI THRESHOLD MARKER */}
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/15 bg-[#0b101d]/90 p-2.5 shadow-2xl backdrop-blur-xl">
          <div className="mb-1 flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-1.5 font-extrabold tracking-wide text-white">
              <Flame
                className={`h-4 w-4 ${
                  hud.inRetriZone
                    ? 'animate-bounce text-[#ff2e4c]'
                    : 'text-amber-400'
                }`}
              />
              <span>SENTINEL LORD</span>
              {hud.inRetriZone && (
                <span className="animate-pulse rounded bg-[#ff2e4c] px-1.5 py-0.5 text-[10px] text-white">
                  RETRI ZONE!
                </span>
              )}
            </div>
            <div className="font-mono text-xs font-extrabold">
              <span
                className={
                  hud.inRetriZone ? 'text-[#ff2e4c]' : 'text-amber-300'
                }
              >
                {hud.bossHp.toLocaleString()}
              </span>
              <span className="text-slate-500">
                {' '}
                / {BOSS_MAX_HP.toLocaleString()} HP
              </span>
            </div>
          </div>

          {/* HP Track */}
          <div className="relative h-4 w-full overflow-hidden rounded-lg bg-slate-900/95 p-0.5">
            <div
              className={`h-full rounded transition-all duration-75 ${
                hud.inRetriZone
                  ? 'bg-gradient-to-r from-[#ff2e4c] to-rose-400 shadow-[0_0_16px_#ff2e4c]'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
              }`}
              style={{ width: `${bossHpPct}%` }}
            />

            {/* 2500 HP Retribution Execute Threshold Line */}
            <div
              className="absolute top-0 bottom-0 z-10 w-0.5 bg-white shadow-[0_0_8px_#fff]"
              style={{ left: `${retriLinePct}%` }}
            />
            <div
              className="absolute -top-0.5 z-10 rounded bg-[#ff2e4c] px-1 font-mono text-[8px] font-extrabold text-white"
              style={{ left: `calc(${retriLinePct}% + 4px)` }}
            >
              2500 RETRI
            </div>
          </div>

          {/* Live Indonesian Announcer Callout */}
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold">
            <span
              className="truncate font-mono"
              style={{ color: hud.announcerColor }}
            >
              {hud.announcerText}
            </span>
            <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-slate-300">
              <span>DODGE: {hud.dodgedCount}x</span>
              <span>COMBO: {hud.comboCount}x</span>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          CENTER MODAL: POST-ROUND INDONESIAN MECHANIC SCORE CARD
      ===================================================================== */}
      {hud.roundStats && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-white/20 bg-[#0d1322] p-6 text-center shadow-2xl">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-amber-400/60 bg-amber-400/10 font-mono text-3xl font-black text-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              {hud.roundStats.grade}
            </div>

            <h2 className="font-sans text-lg font-extrabold tracking-tight text-white md:text-xl">
              {hud.roundStats.titleIndo}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {hud.roundStats.subtitleIndo}
            </p>

            {/* Telemetry Grid */}
            <div className="mt-4 grid w-full grid-cols-2 gap-2.5 rounded-2xl border border-white/10 bg-slate-900/70 p-3 font-mono text-xs">
              <div className="flex flex-col items-center rounded-xl bg-white/[0.03] p-2">
                <span className="text-[10px] text-slate-400">
                  REFLEKS RETRI
                </span>
                <span className="mt-0.5 text-sm font-extrabold text-[#00f0ff]">
                  {hud.roundStats.retriReactionMs
                    ? `${hud.roundStats.retriReactionMs} ms`
                    : 'GAGAL / KECEPATAN'}
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-white/[0.03] p-2">
                <span className="text-[10px] text-slate-400">
                  DODGE AOE MERAH
                </span>
                <span className="mt-0.5 text-sm font-extrabold text-emerald-400">
                  {hud.roundStats.dodgedCount}x Dodge
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-white/[0.03] p-2">
                <span className="text-[10px] text-slate-400">
                  KECEPATAN TANGAN
                </span>
                <span className="mt-0.5 text-sm font-extrabold text-amber-400">
                  {hud.roundStats.apm} APM
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-white/[0.03] p-2">
                <span className="text-[10px] text-slate-400">TOTAL DAMAGE</span>
                <span className="mt-0.5 text-sm font-extrabold text-rose-400">
                  {hud.roundStats.totalDamageDealt.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex w-full gap-2.5">
              <button
                onClick={handleShareResult}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 py-3 font-mono text-xs font-bold text-white transition hover:bg-white/15"
              >
                {copiedShare ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>TERSALIN BUAT THREADS!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 text-[#00f0ff]" />
                    <span>COPY HASIL SKOR</span>
                  </>
                )}
              </button>

              <button
                onClick={onResetRound}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ff2e4c] py-3 font-mono text-xs font-extrabold text-white shadow-lg shadow-[#ff2e4c]/30 transition hover:bg-rose-500"
              >
                <Trophy className="h-4 w-4" />
                <span>MAIN LAGI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          BOTTOM CONTROLS: LEFT VIRTUAL JOYSTICK + HERO HP + RIGHT MOBA SKILLS
      ===================================================================== */}
      <footer className="flex items-end justify-between gap-2 pb-1">
        {/* Left Thumb: Touch Virtual Analog Joystick */}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          <div
            ref={joystickBaseRef}
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            className="relative flex h-28 w-28 touch-none items-center justify-center rounded-full border-2 border-white/20 bg-slate-950/75 shadow-2xl backdrop-blur-md md:h-32 md:w-32"
          >
            {/* Crosshair lines */}
            <div className="h-full w-[1px] bg-white/10" />
            <div className="absolute h-[1px] w-full bg-white/10" />

            {/* Movable Analog Stick Thumb Cap */}
            <div
              className="absolute h-12 w-12 rounded-full border-2 border-[#00f0ff] bg-gradient-to-br from-[#00f0ff]/60 to-blue-600/80 shadow-[0_0_20px_#00f0ff]"
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              }}
            />
          </div>
          <span className="font-mono text-[9px] font-semibold text-slate-400">
            ANALOG / [WASD] GERAK
          </span>
        </div>

        {/* Center-Bottom: Hero HP & Shield Bar */}
        <div className="pointer-events-auto mb-2 hidden w-56 flex-col gap-1 rounded-xl border border-white/10 bg-[#0b101d]/85 p-2.5 backdrop-blur-xl sm:flex">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <Shield className="h-3 w-3" /> HERO HP
            </span>
            <span className="font-bold text-white">
              {hud.heroHp} / {hud.heroMaxHp}
              {hud.shieldHp > 0 ? ` (+${hud.shieldHp})` : ''}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-[#00f0ff] transition-all duration-75"
              style={{ width: `${heroHpPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[9px] text-slate-400">
            <span>[SHIFT] DASH KEBAL</span>
            <span>[F] RETRI 2500</span>
          </div>
        </div>

        {/* Right Thumb: Authentic Mobile MOBA Curved Skill Cluster */}
        <div className="pointer-events-auto relative h-44 w-48 md:h-48 md:w-56">
          {/* Spell: ICE RETRIBUTION (Top-Left of cluster, bright red glow in Retri Zone) */}
          <div className="absolute left-1 top-2">
            {renderSkillButton('retri', 'h-14 w-14 md:h-16 md:w-16')}
          </div>

          {/* Skill 1: Shuriken Poke (Bottom-Left of arc) */}
          <div className="absolute bottom-1 left-2">
            {renderSkillButton('skill1', 'h-12 w-12 md:h-14 md:w-14')}
          </div>

          {/* Skill 2: Shadow Dash Kebal (Middle-Left of arc) */}
          <div className="absolute bottom-16 left-14 md:bottom-20 md:left-16">
            {renderSkillButton('skill2', 'h-12 w-12 md:h-14 md:w-14')}
          </div>

          {/* Skill 3: Aegis Shield + Heal (Top-Center of arc) */}
          <div className="absolute right-14 top-2 md:right-16">
            {renderSkillButton('skill3', 'h-12 w-12 md:h-14 md:w-14')}
          </div>

          {/* Ultimate: Orbital Blade (Top-Right of arc) */}
          <div className="absolute right-0 top-6">
            {renderSkillButton('ulti', 'h-14 w-14 md:h-15 md:w-15')}
          </div>

          {/* Giant Basic Attack Button (Bottom-Right Corner) */}
          <div className="absolute bottom-1 right-1">
            {renderSkillButton(
              'basic',
              'h-20 w-20 md:h-24 md:w-24',
              'bg-sky-500/20'
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
