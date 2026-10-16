import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Ring, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {
  ARENA_RADIUS,
  BOSS_MAX_HP,
  DifficultyMode,
  FloatingDamageText,
  HERO_MAX_HP,
  HudSnapshot,
  RETRI_THRESHOLD_HP,
  RoundOutcome,
  RoundStats,
  SKILL_METAS,
  SkillId,
  SkillVfxInstance,
  TelegraphZone,
} from '../game/types';
import { combatSfx } from '../game/soundFx';

export interface CombatCommandQueue {
  pendingSkills: SkillId[];
  resetRequested: boolean;
}

interface ArenaScene3DProps {
  moveInputRef: React.MutableRefObject<{ x: number; y: number }>;
  commandQueueRef: React.MutableRefObject<CombatCommandQueue>;
  difficulty: DifficultyMode;
  onUpdateHud: (snapshot: HudSnapshot) => void;
}

let nextEntityId = 1;

export const ArenaScene3D: React.FC<ArenaScene3DProps> = ({
  moveInputRef,
  commandQueueRef,
  difficulty,
  onUpdateHud,
}) => {
  // 3D Object Refs for 60fps imperative transforms
  const heroGroupRef = useRef<THREE.Group>(null);
  const heroSwordRef = useRef<THREE.Group>(null);
  const heroShieldMeshRef = useRef<THREE.Mesh>(null);
  const bossGroupRef = useRef<THREE.Group>(null);
  const bossWeaponRef = useRef<THREE.Group>(null);
  const bossCoreRef = useRef<THREE.Mesh>(null);
  const enemyJunglerRef = useRef<THREE.Group>(null);
  const runeOuterRef = useRef<THREE.Mesh>(null);

  // React state for declarative VFX & floating texts (throttled cleanup)
  const [telegraphs, setTelegraphs] = useState<TelegraphZone[]>([]);
  const [vfxList, setVfxList] = useState<SkillVfxInstance[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingDamageText[]>([]);

  // Core mutable game state for 60fps loop without React re-render lag
  const gameRef = useRef({
    heroX: 0,
    heroZ: 4.8,
    heroAngle: Math.PI,
    heroHp: HERO_MAX_HP,
    shieldHp: 0,
    shieldUntil: 0,
    invulnerableUntil: 0,
    slashAnimUntil: 0,

    bossHp: BOSS_MAX_HP,
    bossAngle: 0,
    bossSlamAnimUntil: 0,
    bossNextAttackAt: 1800,
    bossPatternIndex: 0,
    retriWindowEnteredAt: null as number | null,
    retriReactionMs: null as number | null,

    enemyActive: false,
    enemyX: -6.8,
    enemyZ: -3.2,
    enemyAngle: 0,
    enemyStealAt: 0,

    cooldownReadyAt: {
      basic: 0,
      skill1: 0,
      skill2: 0,
      skill3: 0,
      ulti: 0,
      retri: 0,
    } as Record<SkillId, number>,

    comboCount: 0,
    dodgedCount: 0,
    hitTakenCount: 0,
    totalDamageDealt: 0,
    actionsPressed: 0,
    roundStartedAt: performance.now(),
    outcome: 'playing' as RoundOutcome,
    roundStats: null as RoundStats | null,

    announcerText: 'SERANG SENTINEL LORD & AMANKAN RETRI!',
    announcerColor: '#00f0ff',
    cameraShake: 0,
    lastHudSync: 0,
  });

  // Helper to spawn floating combat numbers
  const spawnFloatingText = (
    text: string,
    x: number,
    y: number,
    z: number,
    color: string,
    isBig = false,
    subtext?: string
  ) => {
    const id = nextEntityId++;
    setFloatingTexts((prev) => [
      ...prev.slice(-10),
      {
        id,
        text,
        subtext,
        x: x + (Math.random() - 0.5) * 0.6,
        y,
        z: z + (Math.random() - 0.5) * 0.6,
        color,
        isBig,
        createdAt: performance.now(),
      },
    ]);
  };

  // Helper to spawn 3D VFX
  const spawnVfx = (
    type: SkillVfxInstance['type'],
    x: number,
    z: number,
    angle: number,
    color: string,
    durationMs = 420,
    targetX?: number,
    targetZ?: number
  ) => {
    const id = nextEntityId++;
    setVfxList((prev) => [
      ...prev.slice(-12),
      {
        id,
        type,
        x,
        z,
        targetX,
        targetZ,
        angle,
        color,
        createdAt: performance.now(),
        durationMs,
      },
    ]);
  };

  // Reset Round function
  const resetRound = () => {
    const now = performance.now();
    const g = gameRef.current;
    g.heroX = 0;
    g.heroZ = 4.8;
    g.heroAngle = Math.PI;
    g.heroHp = HERO_MAX_HP;
    g.shieldHp = 0;
    g.shieldUntil = 0;
    g.invulnerableUntil = 0;
    g.slashAnimUntil = 0;

    g.bossHp = BOSS_MAX_HP;
    g.bossAngle = 0;
    g.bossSlamAnimUntil = 0;
    g.bossNextAttackAt = now + 1500;
    g.bossPatternIndex = 0;
    g.retriWindowEnteredAt = null;
    g.retriReactionMs = null;

    g.enemyActive = false;
    g.enemyX = -6.8;
    g.enemyZ = -3.2;
    g.enemyStealAt = 0;

    g.cooldownReadyAt = {
      basic: 0,
      skill1: 0,
      skill2: 0,
      skill3: 0,
      ulti: 0,
      retri: 0,
    };

    g.comboCount = 0;
    g.dodgedCount = 0;
    g.hitTakenCount = 0;
    g.totalDamageDealt = 0;
    g.actionsPressed = 0;
    g.roundStartedAt = now;
    g.outcome = 'playing';
    g.roundStats = null;
    g.announcerText =
      difficulty === 'mythic'
        ? 'MODE MYTHIC GLORY // AWAS JUNGLER MUSUH!'
        : 'SERANG LORD & SIAPKAN TIMING RETRIBUTION!';
    g.announcerColor = '#00f0ff';
    g.cameraShake = 0;

    setTelegraphs([]);
    setVfxList([]);
    setFloatingTexts([]);
  };

  useEffect(() => {
    resetRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  // Finalize Round & Compute Indonesian Mechanic Grade
  const finishRound = (outcome: RoundOutcome, now: number) => {
    const g = gameRef.current;
    if (g.outcome !== 'playing') return;
    g.outcome = outcome;

    const durationSec = Math.max(1, (now - g.roundStartedAt) / 1000);
    const apm = Math.round((g.actionsPressed / durationSec) * 60);

    let grade: RoundStats['grade'] = 'A';
    let titleIndo = 'VICTORY // LORD DIAMANKAN!';
    let subtitleIndo = 'Mekanik lu lumayan solid, siap push rank!';

    if (outcome === 'victory_retri') {
      const rx = g.retriReactionMs ?? 380;
      if (rx <= 280 && g.hitTakenCount <= 2) {
        grade = 'SSS';
        titleIndo = 'RAJA RETRI // TANGAN DEWA!';
        subtitleIndo = `Refleks Retri ${rx}ms! Jungler musuh langsung kena mental.`;
      } else if (rx <= 520) {
        grade = 'SS';
        titleIndo = 'RETRI MONTOON // FAST HAND!';
        subtitleIndo = `Timing Retri presisi (${rx}ms) + ${g.dodgedCount}x Dodge AoE Boss!`;
      } else {
        grade = 'S';
        titleIndo = 'OBJECTIVE SECURED!';
        subtitleIndo = `Lord berhasil diamankan dengan Retribution (${rx}ms).`;
      }
    } else if (outcome === 'victory_burst') {
      grade = 'S';
      titleIndo = 'LORD TUMBANG // FULL DAMAGE!';
      subtitleIndo = 'Lord hancur lebur bahkan tanpa perlu Retri!';
    } else if (outcome === 'stolen_indomaret') {
      grade = 'C';
      titleIndo = 'YAH... RETRI INDOMARET!';
      subtitleIndo =
        'Retri kepencet kecepatan sebelum darah Lord 2.500, langsung dicuri Jungler musuh!';
    } else if (outcome === 'stolen_late') {
      grade = 'B';
      titleIndo = 'KECOLONGAN LORD // TELAT RETRI!';
      subtitleIndo =
        'Darah Lord sudah di bawah 2.500 tapi telat pencet Retri, disambar Hyper lawan!';
    } else {
      grade = 'C';
      titleIndo = 'TUMBANG DI PIT LORD!';
      subtitleIndo =
        'Kebanyakan kena AoE merah Boss! Gunakan Skill 2 (Dash) & Skill 3 (Shield).';
    }

    g.roundStats = {
      outcome,
      grade,
      titleIndo,
      subtitleIndo,
      retriReactionMs: g.retriReactionMs,
      dodgedCount: g.dodgedCount,
      hitTakenCount: g.hitTakenCount,
      totalDamageDealt: g.totalDamageDealt,
      apm,
      durationSec: Math.round(durationSec * 10) / 10,
    };
  };

  // Apply damage to Boss and check Retri threshold
  const damageBoss = (
    amount: number,
    now: number,
    label: string,
    color: string,
    isBig = false,
    isRetri = false
  ) => {
    const g = gameRef.current;
    if (g.outcome !== 'playing') return;

    const prevHp = g.bossHp;
    g.bossHp = Math.max(0, g.bossHp - amount);
    g.totalDamageDealt += amount;
    g.comboCount += 1;

    spawnFloatingText(
      label,
      (Math.random() - 0.5) * 1.1,
      2.3 + Math.random() * 0.6,
      (Math.random() - 0.5) * 1.1,
      color,
      isBig
    );

    // Check if Boss just entered Retribution Threshold (<= 2500 HP)
    if (
      prevHp > RETRI_THRESHOLD_HP &&
      g.bossHp <= RETRI_THRESHOLD_HP &&
      g.bossHp > 0
    ) {
      g.retriWindowEnteredAt = now;
      g.announcerText = 'DARAH LORD < 2500! PENCET RETRI SEKARANG!';
      g.announcerColor = '#ff2e4c';

      // Enemy Jungler prepares to steal after a reaction window
      const stealWindowMs =
        difficulty === 'mythic' ? 880 : difficulty === 'auto_demo' ? 2500 : 1550;
      g.enemyStealAt = now + stealWindowMs;
    }

    // Spawn invading Enemy Jungler when Boss drops below 6500 HP
    if (!g.enemyActive && g.bossHp <= 6500 && g.bossHp > 0) {
      g.enemyActive = true;
      g.announcerText = 'AWAS! JUNGLER MUSUH MENDEKATI PIT LORD!';
      g.announcerColor = '#f59e0b';
    }

    if (g.bossHp <= 0) {
      if (isRetri) {
        const rx = g.retriWindowEnteredAt
          ? Math.max(45, Math.round(now - g.retriWindowEnteredAt))
          : 180;
        g.retriReactionMs = rx;
        g.announcerText = `SAVAGE! RETRI SEMPURNA (${rx}ms)!`;
        g.announcerColor = '#10b981';
        finishRound('victory_retri', now);
      } else {
        g.announcerText = 'LORD SLAIN // VICTORY!';
        g.announcerColor = '#10b981';
        finishRound('victory_burst', now);
      }
    }
  };

  // Execute a Hero Skill
  const executeSkill = (skillId: SkillId, now: number) => {
    const g = gameRef.current;
    if (g.outcome !== 'playing') return;
    if (now < g.cooldownReadyAt[skillId]) return;

    const meta = SKILL_METAS[skillId];
    g.cooldownReadyAt[skillId] = now + meta.cooldownSec * 1000;
    g.actionsPressed += 1;

    const distToBoss = Math.hypot(g.heroX, g.heroZ);
    const angleToBoss = Math.atan2(-g.heroX, -g.heroZ);

    if (skillId === 'basic') {
      g.heroAngle = angleToBoss;
      g.slashAnimUntil = now + 220;
      combatSfx.playSlash();

      spawnVfx('slash', g.heroX, g.heroZ, angleToBoss, '#38bdf8', 240);

      if (distToBoss <= 4.3) {
        const isCrit = Math.random() < 0.35;
        const dmg = isCrit
          ? 420 + Math.floor(Math.random() * 90)
          : 270 + Math.floor(Math.random() * 50);
        damageBoss(
          dmg,
          now,
          isCrit ? `CRIT ${dmg}!` : `${dmg}`,
          isCrit ? '#fbbf24' : '#e2e8f0',
          isCrit
        );
      } else {
        spawnFloatingText('MISS (KEJAUHAN)', g.heroX, 1.5, g.heroZ, '#94a3b8');
      }
    } else if (skillId === 'skill1') {
      // Shuriken Wave (Long-range triple energy projectile poke)
      g.heroAngle = angleToBoss;
      g.slashAnimUntil = now + 260;
      combatSfx.playShurikenSkill();

      spawnVfx(
        'shuriken',
        g.heroX,
        g.heroZ,
        angleToBoss,
        '#00f0ff',
        380,
        0,
        0
      );

      if (distToBoss <= 7.8) {
        const dmg = 980 + Math.floor(Math.random() * 140);
        damageBoss(dmg, now, `SKILL 1 // ${dmg}`, '#00f0ff', true);
        g.cameraShake = 0.14;
      }
    } else if (skillId === 'skill2') {
      // Shadow Dash (Blink + Brief I-Frame Invulnerability + Dash Strike)
      combatSfx.playDashBlink();
      const input = moveInputRef.current;
      let dirX = input.x;
      let dirZ = input.y;

      if (Math.hypot(dirX, dirZ) < 0.15) {
        // Default dash perpendicular/around the boss for stylish kiting
        const tangentAngle = angleToBoss + Math.PI * 0.42;
        dirX = Math.sin(tangentAngle);
        dirZ = Math.cos(tangentAngle);
      } else {
        const len = Math.hypot(dirX, dirZ);
        dirX /= len;
        dirZ /= len;
      }

      const startX = g.heroX;
      const startZ = g.heroZ;
      const dashDist = 3.1;
      let nextX = startX + dirX * dashDist;
      let nextZ = startZ + dirZ * dashDist;

      // Clamp inside arena pit and outside boss core collision
      const r = Math.hypot(nextX, nextZ);
      if (r > ARENA_RADIUS - 0.5) {
        nextX = (nextX / r) * (ARENA_RADIUS - 0.5);
        nextZ = (nextZ / r) * (ARENA_RADIUS - 0.5);
      }
      if (r < 1.85) {
        nextX = (nextX / (r || 1)) * 1.95;
        nextZ = (nextZ / (r || 1)) * 1.95;
      }

      g.heroX = nextX;
      g.heroZ = nextZ;
      g.heroAngle = Math.atan2(dirX, dirZ);
      g.invulnerableUntil = now + 650;

      spawnVfx(
        'dash_trail',
        startX,
        startZ,
        g.heroAngle,
        '#a855f7',
        420,
        nextX,
        nextZ
      );
      spawnFloatingText(
        'SHADOW DASH // KEBAL!',
        nextX,
        1.8,
        nextZ,
        '#c084fc',
        true
      );

      if (Math.hypot(nextX, nextZ) <= 5.2) {
        damageBoss(620, now, 'DASH STRIKE 620', '#c084fc');
      }
    } else if (skillId === 'skill3') {
      // Aegis Parry Shield + Heal
      combatSfx.playShieldParry();
      g.shieldHp = 1200;
      g.shieldUntil = now + 3200;
      g.heroHp = Math.min(HERO_MAX_HP, g.heroHp + 550);
      spawnFloatingText(
        '+550 HP & SHIELD!',
        g.heroX,
        1.9,
        g.heroZ,
        '#10b981',
        true
      );
    } else if (skillId === 'ulti') {
      // Orbital Blade Ultimate (Massive burst + brief immunity)
      combatSfx.playOrbitalUlti();
      g.invulnerableUntil = now + 550;
      g.cameraShake = 0.38;

      spawnVfx('orbital_ulti', 0, 0, 0, '#f59e0b', 680);
      const dmg = 2250 + Math.floor(Math.random() * 200);
      damageBoss(dmg, now, `ULTIMATE // ${dmg}!`, '#f59e0b', true);
      g.announcerText = 'ORBITAL BLADE ULTIMATE!';
      g.announcerColor = '#f59e0b';
    } else if (skillId === 'retri') {
      // Ice Retribution (2500 True Damage vs Boss)
      const isExecuteReady = g.bossHp <= RETRI_THRESHOLD_HP;
      combatSfx.playRetributionSmite(isExecuteReady);
      g.cameraShake = 0.48;

      spawnVfx('retri_smite', 0, 0, 0, '#ff2e4c', 650);

      if (isExecuteReady) {
        // Perfect Retri Execution!
        damageBoss(
          RETRI_THRESHOLD_HP + 999,
          now,
          `RETRIBUTION // 2500 TRUE DMG!`,
          '#ff2e4c',
          true,
          true
        );
      } else {
        // Early Retri ("Retri Indomaret")!
        const earlyDmg = 950;
        damageBoss(
          earlyDmg,
          now,
          'RETRI KECEPATAN! (950)',
          '#fb7185',
          true,
          false
        );
        g.announcerText =
          'WADUH RETRI INDOMARET! COOLDOWN 12 DETIK, AWAS DICURI MUSUH!';
        g.announcerColor = '#ff2e4c';

        // If Boss is now in or near steal range, Enemy Jungler immediately punishes within 1.1s
        if (g.bossHp <= RETRI_THRESHOLD_HP + 1400) {
          g.enemyActive = true;
          g.enemyStealAt = now + 950;
        }
      }
    }
  };

  // Main 60 FPS Game Loop
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    const g = gameRef.current;

    // 1. Process Reset & Queued Skill Commands from UI/Keyboard
    if (commandQueueRef.current.resetRequested) {
      commandQueueRef.current.resetRequested = false;
      resetRound();
    }

    while (commandQueueRef.current.pendingSkills.length > 0) {
      const skillId = commandQueueRef.current.pendingSkills.shift()!;
      executeSkill(skillId, now);
    }

    // 2. Auto-Demo AI Pilot (if user selects 'auto_demo' mode)
    if (difficulty === 'auto_demo' && g.outcome === 'playing') {
      // Orbit smoothly around Boss and dodge active telegraphs
      const orbitAngle = now * 0.0014;
      const desiredX = Math.sin(orbitAngle) * 3.5;
      const desiredZ = Math.cos(orbitAngle) * 3.5;
      moveInputRef.current.x = THREE.MathUtils.clamp(
        (desiredX - g.heroX) * 1.2,
        -1,
        1
      );
      moveInputRef.current.y = THREE.MathUtils.clamp(
        (desiredZ - g.heroZ) * 1.2,
        -1,
        1
      );

      if (g.bossHp <= RETRI_THRESHOLD_HP && now >= g.cooldownReadyAt.retri) {
        executeSkill('retri', now);
      } else if (
        g.bossHp > RETRI_THRESHOLD_HP + 2600 &&
        now >= g.cooldownReadyAt.ulti
      ) {
        executeSkill('ulti', now);
      } else if (now >= g.cooldownReadyAt.skill1) {
        executeSkill('skill1', now);
      } else if (now >= g.cooldownReadyAt.basic) {
        executeSkill('basic', now);
      }
    }

    // 3. Hero Movement & Arena Boundary Physics
    if (g.outcome === 'playing') {
      const moveX = moveInputRef.current.x;
      const moveZ = moveInputRef.current.y;
      const moveMag = Math.hypot(moveX, moveZ);

      if (moveMag > 0.06) {
        const normX = moveX / Math.max(1, moveMag);
        const normZ = moveZ / Math.max(1, moveMag);
        const moveSpeed = 5.6;

        let nextX = g.heroX + normX * moveSpeed * dt;
        let nextZ = g.heroZ + normZ * moveSpeed * dt;

        // Keep outside Boss inner pedestal (radius 1.85) and inside Arena Pit (radius 8.0)
        const distCenter = Math.hypot(nextX, nextZ);
        if (distCenter < 1.85) {
          nextX = (nextX / (distCenter || 1)) * 1.85;
          nextZ = (nextZ / (distCenter || 1)) * 1.85;
        } else if (distCenter > ARENA_RADIUS - 0.45) {
          nextX = (nextX / distCenter) * (ARENA_RADIUS - 0.45);
          nextZ = (nextZ / distCenter) * (ARENA_RADIUS - 0.45);
        }

        g.heroX = nextX;
        g.heroZ = nextZ;
        g.heroAngle = Math.atan2(normX, normZ);
      }
    }

    // Expire shield if duration ended
    if (g.shieldHp > 0 && now > g.shieldUntil) {
      g.shieldHp = 0;
    }

    // 4. Sentinel Lord Boss AI: Spawn Telegraphed Red AoE Attacks
    if (g.outcome === 'playing' && now >= g.bossNextAttackAt) {
      const isEnraged = g.bossHp <= BOSS_MAX_HP * 0.45;
      const cooldownMs =
        difficulty === 'mythic'
          ? isEnraged
            ? 1950
            : 2350
          : isEnraged
          ? 2400
          : 2900;
      g.bossNextAttackAt = now + cooldownMs;

      const pattern = g.bossPatternIndex % 3;
      g.bossPatternIndex += 1;

      if (pattern === 0) {
        // Pattern 1: Target Hero Knockup Slam Circle
        const newZone: TelegraphZone = {
          id: nextEntityId++,
          type: 'circle_slam',
          x: g.heroX,
          z: g.heroZ,
          radius: 2.35,
          angle: 0,
          createdAt: now,
          durationMs: difficulty === 'mythic' ? 1150 : 1400,
          damage: 920,
          label: 'LORD KNOCKUP SLAM!',
        };
        setTelegraphs((prev) => [...prev, newZone]);
        g.announcerText = 'AWAS LINGKARAN MERAH! HINDARI ATAU DASH (SKILL 2)!';
        g.announcerColor = '#fb7185';
      } else if (pattern === 1) {
        // Pattern 2: Inner Pit Thunder Shockwave around Boss
        const newZone: TelegraphZone = {
          id: nextEntityId++,
          type: 'circle_slam',
          x: 0,
          z: 0,
          radius: 4.25,
          angle: 0,
          createdAt: now,
          durationMs: difficulty === 'mythic' ? 1250 : 1500,
          damage: 1100,
          label: 'THUNDER SHOCKWAVE!',
        };
        setTelegraphs((prev) => [...prev, newZone]);
        g.announcerText = 'LORD THUNDER SLAM! MUNDUR DARI TENGAH PIT!';
        g.announcerColor = '#f59e0b';
      } else {
        // Pattern 3: Triple Meteor Strike
        const zones: TelegraphZone[] = [0, 1, 2].map((idx) => {
          const ang =
            Math.atan2(g.heroZ, g.heroX) + (idx - 1) * 0.85;
          const dist = idx === 1 ? Math.hypot(g.heroX, g.heroZ) : 4.2;
          return {
            id: nextEntityId++,
            type: 'meteor_ring',
            x: Math.cos(ang) * dist,
            z: Math.sin(ang) * dist,
            radius: 1.95,
            angle: 0,
            createdAt: now,
            durationMs: difficulty === 'mythic' ? 1200 : 1450,
            damage: 850,
            label: 'METEOR STRIKE',
          };
        });
        setTelegraphs((prev) => [...prev, ...zones]);
        g.announcerText = 'HUJAN METEOR LORD! JAGA POSISI!';
        g.announcerColor = '#fb7185';
      }
    }

    // 5. Evaluate Detonating Telegraphs
    setTelegraphs((prev) => {
      if (prev.length === 0) return prev;
      const remaining: TelegraphZone[] = [];

      for (const zone of prev) {
        const elapsed = now - zone.createdAt;
        if (elapsed < zone.durationMs) {
          remaining.push(zone);
        } else if (g.outcome === 'playing') {
          // Detonate!
          combatSfx.playBossSlam();
          g.bossSlamAnimUntil = now + 320;
          g.cameraShake = Math.max(g.cameraShake, 0.32);

          spawnVfx(
            'boss_blast',
            zone.x,
            zone.z,
            zone.radius,
            '#ff2e4c',
            380
          );

          const distHero = Math.hypot(g.heroX - zone.x, g.heroZ - zone.z);
          if (distHero <= zone.radius) {
            // Hero is inside the blast radius! Check I-frame or Shield
            if (now <= g.invulnerableUntil) {
              g.dodgedCount += 1;
              spawnFloatingText(
                'IMMUNE // FAST HAND!',
                g.heroX,
                2.0,
                g.heroZ,
                '#a855f7',
                true
              );
            } else if (g.shieldHp > 0) {
              const absorbed = Math.min(g.shieldHp, zone.damage);
              g.shieldHp -= absorbed;
              const leftover = zone.damage - absorbed;
              if (leftover > 0) {
                g.heroHp = Math.max(0, g.heroHp - leftover);
              }
              g.dodgedCount += 1;
              spawnFloatingText(
                'PARRIED BY SHIELD!',
                g.heroX,
                2.0,
                g.heroZ,
                '#10b981',
                true
              );
            } else {
              g.heroHp = Math.max(0, g.heroHp - zone.damage);
              g.hitTakenCount += 1;
              g.comboCount = 0;
              spawnFloatingText(
                `-${zone.damage} KENA SLAM!`,
                g.heroX,
                2.0,
                g.heroZ,
                '#ff2e4c',
                true
              );

              if (g.heroHp <= 0) {
                g.announcerText = 'HERO TUMBANG! LATIH LAGI TIMING DODGE LU!';
                g.announcerColor = '#ff2e4c';
                finishRound('hero_eliminated', now);
              }
            }
          } else if (distHero <= zone.radius + 2.4) {
            // Cleanly dodged nearby AoE!
            g.dodgedCount += 1;
            spawnFloatingText(
              'NICE DODGE!',
              g.heroX,
              1.7,
              g.heroZ,
              '#38bdf8'
            );
          }
        }
      }
      return remaining;
    });

    // 6. Enemy Jungler AI Contests & Steals Lord if Player Misses Retri Window
    if (g.outcome === 'playing' && g.enemyActive) {
      const orbitT = now * 0.0028;
      const targetRadius = g.bossHp <= RETRI_THRESHOLD_HP ? 2.5 : 5.6;
      g.enemyX = THREE.MathUtils.lerp(
        g.enemyX,
        Math.cos(orbitT) * targetRadius,
        dt * 4
      );
      g.enemyZ = THREE.MathUtils.lerp(
        g.enemyZ,
        Math.sin(orbitT) * targetRadius,
        dt * 4
      );
      g.enemyAngle = Math.atan2(-g.enemyX, -g.enemyZ);

      if (
        g.bossHp <= RETRI_THRESHOLD_HP &&
        g.enemyStealAt > 0 &&
        now >= g.enemyStealAt
      ) {
        // Enemy Jungler steals the Lord!
        combatSfx.playRetributionSmite(false);
        g.cameraShake = 0.5;
        g.bossHp = 0;
        spawnVfx('retri_smite', 0, 0, 0, '#a855f7', 700);
        spawnFloatingText(
          'DICURI JUNGLER MUSUH!',
          0,
          3.0,
          0,
          '#ff2e4c',
          true
        );

        const wasEarlyRetriOnCd = now < g.cooldownReadyAt.retri;
        g.announcerText = wasEarlyRetriOnCd
          ? 'LORD DICURI MUSUH GARA-GARA RETRI INDOMARET!'
          : 'TELAT PENCET RETRI! LORD DISAMBAR HYPER LAWAN!';
        g.announcerColor = '#ff2e4c';

        finishRound(
          wasEarlyRetriOnCd ? 'stolen_indomaret' : 'stolen_late',
          now
        );
      }
    }

    // 7. Clean up expired VFX and floating texts
    setVfxList((prev) =>
      prev.some((v) => now - v.createdAt > v.durationMs)
        ? prev.filter((v) => now - v.createdAt <= v.durationMs)
        : prev
    );
    setFloatingTexts((prev) =>
      prev.some((ft) => now - ft.createdAt > 850)
        ? prev.filter((ft) => now - ft.createdAt <= 850)
        : prev
    );

    // 8. Imperative 3D Mesh Animations (Hero, Boss, Runes, Camera Shake)
    if (heroGroupRef.current) {
      heroGroupRef.current.position.set(g.heroX, 0, g.heroZ);
      heroGroupRef.current.rotation.y = g.heroAngle;
    }
    if (heroSwordRef.current) {
      const isSlashing = now < g.slashAnimUntil;
      heroSwordRef.current.rotation.y = isSlashing
        ? Math.sin((g.slashAnimUntil - now) * 0.04) * 1.8
        : 0.25;
    }
    if (heroShieldMeshRef.current) {
      heroShieldMeshRef.current.visible = g.shieldHp > 0;
      heroShieldMeshRef.current.rotation.y = now * 0.002;
    }

    if (bossGroupRef.current) {
      const targetBossAngle = Math.atan2(g.heroX, g.heroZ);
      g.bossAngle = THREE.MathUtils.lerp(g.bossAngle, targetBossAngle, dt * 4);
      bossGroupRef.current.rotation.y = g.bossAngle;
      bossGroupRef.current.position.y =
        Math.sin(now * 0.003) * 0.12 +
        (now < g.bossSlamAnimUntil ? -0.25 : 0);
    }
    if (bossWeaponRef.current) {
      const isSlamming = now < g.bossSlamAnimUntil;
      bossWeaponRef.current.rotation.x = isSlamming
        ? 1.15
        : Math.sin(now * 0.004) * 0.22;
    }
    if (bossCoreRef.current) {
      const mat = bossCoreRef.current
        .material as THREE.MeshStandardMaterial;
      const inRetri = g.bossHp <= RETRI_THRESHOLD_HP;
      mat.emissive.set(inRetri ? '#ff1e42' : '#00f0ff');
      mat.emissiveIntensity = inRetri
        ? 2.8 + Math.sin(now * 0.025) * 1.2
        : 1.4;
    }

    if (enemyJunglerRef.current) {
      enemyJunglerRef.current.visible = g.enemyActive;
      enemyJunglerRef.current.position.set(g.enemyX, 0, g.enemyZ);
      enemyJunglerRef.current.rotation.y = g.enemyAngle;
    }

    if (runeOuterRef.current) {
      runeOuterRef.current.rotation.z = now * 0.00035;
    }

    // Dynamic Isometric MOBA Camera Tracking + Impact Shake
    g.cameraShake = Math.max(0, g.cameraShake - dt * 1.4);
    const shakeX = (Math.random() - 0.5) * g.cameraShake;
    const shakeY = (Math.random() - 0.5) * g.cameraShake;

    const camTargetX = g.heroX * 0.35 + shakeX;
    const camTargetZ = 10.6 + g.heroZ * 0.32;
    state.camera.position.lerp(
      new THREE.Vector3(camTargetX, 11.4 + shakeY, camTargetZ),
      dt * 6
    );
    state.camera.lookAt(g.heroX * 0.22, 0.6, g.heroZ * 0.2);

    // 9. Sync HUD State at ~20Hz so UI gauges & cooldowns stay ultra-responsive
    if (now - g.lastHudSync > 48) {
      g.lastHudSync = now;
      onUpdateHud({
        heroHp: g.heroHp,
        heroMaxHp: HERO_MAX_HP,
        shieldHp: g.shieldHp,
        bossHp: g.bossHp,
        bossMaxHp: BOSS_MAX_HP,
        bossEnraged: g.bossHp <= BOSS_MAX_HP * 0.45,
        inRetriZone: g.bossHp > 0 && g.bossHp <= RETRI_THRESHOLD_HP,
        cooldownsRemaining: {
          basic: Math.max(0, (g.cooldownReadyAt.basic - now) / 1000),
          skill1: Math.max(0, (g.cooldownReadyAt.skill1 - now) / 1000),
          skill2: Math.max(0, (g.cooldownReadyAt.skill2 - now) / 1000),
          skill3: Math.max(0, (g.cooldownReadyAt.skill3 - now) / 1000),
          ulti: Math.max(0, (g.cooldownReadyAt.ulti - now) / 1000),
          retri: Math.max(0, (g.cooldownReadyAt.retri - now) / 1000),
        },
        comboCount: g.comboCount,
        dodgedCount: g.dodgedCount,
        announcerText: g.announcerText,
        announcerColor: g.announcerColor,
        enemyJunglerWarning: g.enemyActive,
        roundStats: g.roundStats,
      });
    }
  });

  // 6 Ancient Stone Pillars around the River Lord Pit
  const pillarPositions = useMemo(() => {
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const ang = (i / 6) * Math.PI * 2 + 0.3;
      return [
        Math.cos(ang) * (ARENA_RADIUS + 0.55),
        Math.sin(ang) * (ARENA_RADIUS + 0.55),
      ] as [number, number];
    });
  }, []);

  const nowRender = performance.now();
  const inRetriZone =
    gameRef.current.bossHp > 0 &&
    gameRef.current.bossHp <= RETRI_THRESHOLD_HP;

  return (
    <group>
      {/* =====================================================================
          RIVER LORD PIT ENVIRONMENT
      ===================================================================== */}
      {/* Glowing Deep River Water Plane */}
      <mesh position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[42, 42]} />
        <meshStandardMaterial
          color="#051329"
          roughness={0.2}
          metalness={0.7}
        />
      </mesh>

      {/* Main Circular Stone Pit Platform */}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <cylinderGeometry args={[ARENA_RADIUS, ARENA_RADIUS + 0.6, 0.36, 48]} />
        <meshStandardMaterial
          color="#131926"
          roughness={0.65}
          metalness={0.25}
        />
      </mesh>

      {/* Outer Runic Gold/Cyan Sanctuary Rim */}
      <mesh
        ref={runeOuterRef}
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[ARENA_RADIUS - 0.35, ARENA_RADIUS - 0.08, 48]} />
        <meshBasicMaterial
          color={inRetriZone ? '#ff2e4c' : '#00f0ff'}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Inner Boss Sanctuary Pedestal Ring */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.75, 1.92, 36]} />
        <meshBasicMaterial
          color={inRetriZone ? '#ff2e4c' : '#f59e0b'}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* 6 Ancient Sanctuary Pillars with Glowing Crystals */}
      {pillarPositions.map(([px, pz], idx) => (
        <group key={idx} position={[px, 0, pz]}>
          <RoundedBox
            args={[0.9, 2.6, 0.9]}
            radius={0.08}
            position={[0, 1.1, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#1e2638"
              roughness={0.55}
              metalness={0.35}
            />
          </RoundedBox>
          <mesh position={[0, 2.75, 0]}>
            <octahedronGeometry args={[0.36, 0]} />
            <meshStandardMaterial
              color={inRetriZone ? '#ff2e4c' : '#00f0ff'}
              emissive={inRetriZone ? '#ff2e4c' : '#00f0ff'}
              emissiveIntensity={1.8}
            />
          </mesh>
        </group>
      ))}

      {/* =====================================================================
          TOWERING SENTINEL LORD BOSS (CENTER OF PIT)
      ===================================================================== */}
      <group ref={bossGroupRef} position={[0, 0, 0]}>
        {/* Heavy Armored Lower Base */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.95, 1.25, 1.7, 8]} />
          <meshStandardMaterial
            color="#1e2433"
            metalness={0.75}
            roughness={0.28}
          />
        </mesh>

        {/* Upper Titan Torso */}
        <RoundedBox
          args={[1.9, 1.45, 1.3]}
          radius={0.14}
          position={[0, 1.95, 0]}
          castShadow
        >
          <meshStandardMaterial
            color="#2a3142"
            metalness={0.82}
            roughness={0.22}
          />
        </RoundedBox>

        {/* Glowing Sentinel Core Heart */}
        <mesh ref={bossCoreRef} position={[0, 1.95, 0.62]}>
          <octahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial
            color="#00f0ff"
            emissive="#00f0ff"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>

        {/* Left & Right Floating Golden Pauldrons */}
        {[-1.35, 1.35].map((sx, i) => (
          <RoundedBox
            key={i}
            args={[0.72, 0.95, 1.1]}
            radius={0.1}
            position={[sx, 2.25, 0]}
            rotation={[0, 0, sx > 0 ? -0.25 : 0.25]}
            castShadow
          >
            <meshStandardMaterial
              color="#eab308"
              metalness={0.88}
              roughness={0.2}
            />
          </RoundedBox>
        ))}

        {/* Crowned Horned Lord Head */}
        <group position={[0, 3.05, 0]}>
          <RoundedBox args={[0.82, 0.72, 0.82]} radius={0.08} castShadow>
            <meshStandardMaterial
              color="#1f2430"
              metalness={0.85}
              roughness={0.22}
            />
          </RoundedBox>
          {/* Glowing Visor Eyes */}
          <mesh position={[0, 0.05, 0.42]}>
            <boxGeometry args={[0.56, 0.14, 0.04]} />
            <meshBasicMaterial
              color={inRetriZone ? '#ff2e4c' : '#fbbf24'}
            />
          </mesh>
          {/* Golden Horns */}
          {[-0.45, 0.45].map((hx, i) => (
            <mesh
              key={i}
              position={[hx, 0.45, 0]}
              rotation={[0, 0, hx > 0 ? -0.35 : 0.35]}
            >
              <coneGeometry args={[0.14, 0.75, 6]} />
              <meshStandardMaterial
                color="#f59e0b"
                metalness={0.92}
                roughness={0.15}
              />
            </mesh>
          ))}
        </group>

        {/* Giant Animated Plasma Great-Halberd */}
        <group ref={bossWeaponRef} position={[1.45, 1.9, 0.3]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 3.6, 12]} />
            <meshStandardMaterial
              color="#eab308"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 1.65, 0.28]}>
            <boxGeometry args={[0.12, 1.25, 0.65]} />
            <meshStandardMaterial
              color={inRetriZone ? '#ff2e4c' : '#00f0ff'}
              emissive={inRetriZone ? '#ff2e4c' : '#00f0ff'}
              emissiveIntensity={2.0}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* 3D Overhead RETRI EXECUTE Indicator when Boss HP <= 2500 */}
        {inRetriZone && (
          <Html position={[0, 4.35, 0]} center zIndexRange={[30, 0]}>
            <div className="pointer-events-none flex flex-col items-center animate-bounce">
              <div className="rounded-full border-2 border-white bg-[#ff2e4c] px-3 py-1 font-mono text-xs font-extrabold tracking-wider text-white shadow-[0_0_25px_#ff2e4c]">
                RETRI SEKARANG! [F]
              </div>
              <div className="h-3 w-0.5 bg-[#ff2e4c]" />
            </div>
          </Html>
        )}
      </group>

      {/* =====================================================================
          PLAYABLE CYBER-ASSASSIN HERO
      ===================================================================== */}
      <group ref={heroGroupRef} position={[0, 0, 4.8]}>
        {/* Foot Position Ring Indicator (Green/Cyan MOBA Selection Circle) */}
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.58, 0.72, 32]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.85} />
        </mesh>

        {/* Hero Armored Body */}
        <RoundedBox
          args={[0.62, 0.95, 0.46]}
          radius={0.1}
          position={[0, 0.65, 0]}
          castShadow
        >
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.7}
            roughness={0.25}
          />
        </RoundedBox>

        {/* Cyber Scarf / Energy Cape */}
        <mesh position={[0, 0.82, -0.32]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.52, 0.75, 0.06]} />
          <meshStandardMaterial
            color="#00f0ff"
            emissive="#00f0ff"
            emissiveIntensity={1.2}
          />
        </mesh>

        {/* Hero Head + Neon Visor */}
        <mesh position={[0, 1.32, 0]} castShadow>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial
            color="#1e293b"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 1.34, 0.22]}>
          <boxGeometry args={[0.34, 0.09, 0.08]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>

        {/* Glowing Energy Katana Arm */}
        <group ref={heroSwordRef} position={[0.42, 0.78, 0.15]}>
          <mesh position={[0, 0, 0.65]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.08, 1.35, 0.04]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#00f0ff"
              emissiveIntensity={2.4}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* Skill 3 Active Aegis Parry Shield Dome */}
        <mesh ref={heroShieldMeshRef} position={[0, 0.78, 0]} visible={false}>
          <icosahedronGeometry args={[1.05, 1]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={1.2}
            transparent
            opacity={0.38}
            wireframe
          />
        </mesh>
      </group>

      {/* =====================================================================
          INVADING ENEMY JUNGLER AI ("HYPER LAWAN PENGINCAR RETRI")
      ===================================================================== */}
      <group ref={enemyJunglerRef} position={[-6.8, 0, -3.2]} visible={false}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.58, 0.74, 32]} />
          <meshBasicMaterial color="#ff2e4c" transparent opacity={0.9} />
        </mesh>
        <RoundedBox
          args={[0.6, 0.95, 0.46]}
          radius={0.1}
          position={[0, 0.65, 0]}
          castShadow
        >
          <meshStandardMaterial
            color="#3b0714"
            metalness={0.75}
            roughness={0.25}
          />
        </RoundedBox>
        <mesh position={[0, 1.32, 0]}>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshStandardMaterial color="#1f1224" />
        </mesh>
        {/* Crimson Dual Blades */}
        <mesh position={[0.45, 0.75, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.08, 1.1, 0.04]} />
          <meshBasicMaterial color="#ff2e4c" />
        </mesh>
        <Html position={[0, 1.95, 0]} center zIndexRange={[15, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded border border-red-500/60 bg-black/80 px-2 py-0.5 font-mono text-[10px] font-bold text-red-400">
            JUNGLER LAWAN (SIAP CURIAN RETRI)
          </div>
        </Html>
      </group>

      {/* =====================================================================
          TELEGRAPHED RED AOE DANGER ZONES ON FLOOR
      ===================================================================== */}
      {telegraphs.map((zone) => {
        const progress = Math.min(
          1,
          (nowRender - zone.createdAt) / zone.durationMs
        );
        return (
          <group key={zone.id} position={[zone.x, 0.03, zone.z]}>
            {/* Outer Red Danger Boundary Ring */}
            <Ring
              args={[zone.radius - 0.1, zone.radius, 40]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <meshBasicMaterial
                color="#ff2e4c"
                transparent
                opacity={0.9}
                side={THREE.DoubleSide}
              />
            </Ring>

            {/* Translucent Red Danger Base Fill */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[zone.radius, 40]} />
              <meshBasicMaterial
                color="#ff2e4c"
                transparent
                opacity={0.18 + progress * 0.25}
              />
            </mesh>

            {/* Expanding Inner Charge-Up Indicator Disc */}
            <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[zone.radius * progress, 40]} />
              <meshBasicMaterial
                color="#ff4d6d"
                transparent
                opacity={0.48}
              />
            </mesh>
          </group>
        );
      })}

      {/* =====================================================================
          ACTIVE 3D SKILL VFX & LIGHTNING SMITES
      ===================================================================== */}
      {vfxList.map((vfx) => {
        const progress = Math.min(
          1,
          (nowRender - vfx.createdAt) / vfx.durationMs
        );

        if (vfx.type === 'slash') {
          return (
            <group
              key={vfx.id}
              position={[vfx.x, 0.75, vfx.z]}
              rotation={[0, vfx.angle, 0]}
            >
              <Ring
                args={[0.9, 1.55, 24, 1, -Math.PI * 0.45, Math.PI * 0.9]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <meshBasicMaterial
                  color={vfx.color}
                  transparent
                  opacity={1 - progress}
                  side={THREE.DoubleSide}
                />
              </Ring>
            </group>
          );
        }

        if (vfx.type === 'shuriken') {
          const curX = THREE.MathUtils.lerp(
            vfx.x,
            vfx.targetX ?? 0,
            progress
          );
          const curZ = THREE.MathUtils.lerp(
            vfx.z,
            vfx.targetZ ?? 0,
            progress
          );
          return (
            <group
              key={vfx.id}
              position={[curX, 0.95, curZ]}
              rotation={[0, progress * 18, 0]}
            >
              <Ring args={[0.35, 0.85, 6]} rotation={[-Math.PI / 2, 0, 0]}>
                <meshBasicMaterial
                  color="#00f0ff"
                  side={THREE.DoubleSide}
                />
              </Ring>
            </group>
          );
        }

        if (vfx.type === 'dash_trail') {
          return (
            <mesh
              key={vfx.id}
              position={[vfx.x, 0.7, vfx.z]}
              rotation={[0, vfx.angle, 0]}
            >
              <boxGeometry args={[0.5, 0.9, 0.5]} />
              <meshBasicMaterial
                color="#a855f7"
                transparent
                opacity={(1 - progress) * 0.65}
                wireframe
              />
            </mesh>
          );
        }

        if (vfx.type === 'orbital_ulti' || vfx.type === 'retri_smite') {
          const isRetri = vfx.type === 'retri_smite';
          const beamRadius = (isRetri ? 0.85 : 1.45) * (1 - progress * 0.45);
          return (
            <group key={vfx.id} position={[vfx.x, 0, vfx.z]}>
              {/* Vertical Sky Pillar Beam */}
              <mesh position={[0, 4.5, 0]}>
                <cylinderGeometry args={[beamRadius, beamRadius, 9, 24]} />
                <meshBasicMaterial
                  color={vfx.color}
                  transparent
                  opacity={(1 - progress) * 0.85}
                />
              </mesh>
              {/* Expanding Ground Shockwave Ring */}
              <Ring
                args={[progress * 3.8, progress * 4.3 + 0.25, 36]}
                position={[0, 0.06, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <meshBasicMaterial
                  color={vfx.color}
                  transparent
                  opacity={1 - progress}
                  side={THREE.DoubleSide}
                />
              </Ring>
            </group>
          );
        }

        // Boss Blast Shockwave
        return (
          <Ring
            key={vfx.id}
            args={[
              vfx.angle * progress * 0.8,
              vfx.angle * (0.7 + progress * 0.35),
              36,
            ]}
            position={[vfx.x, 0.08, vfx.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshBasicMaterial
              color={vfx.color}
              transparent
              opacity={(1 - progress) * 0.9}
              side={THREE.DoubleSide}
            />
          </Ring>
        );
      })}

      {/* =====================================================================
          3D FLOATING DAMAGE & MECHANIC CALLOUT TEXTS
      ===================================================================== */}
      {floatingTexts.map((ft) => (
        <Html
          key={ft.id}
          position={[ft.x, ft.y, ft.z]}
          center
          zIndexRange={[25, 0]}
        >
          <div
            className={`pointer-events-none animate-float-up whitespace-nowrap font-mono font-extrabold tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] ${
              ft.isBig ? 'text-sm md:text-base' : 'text-xs'
            }`}
            style={{ color: ft.color }}
          >
            {ft.text}
          </div>
        </Html>
      ))}
    </group>
  );
};
