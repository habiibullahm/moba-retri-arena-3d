export type DifficultyMode = 'normal' | 'mythic' | 'auto_demo';

export type SkillId = 'basic' | 'skill1' | 'skill2' | 'skill3' | 'ulti' | 'retri';

export interface SkillMeta {
  id: SkillId;
  name: string;
  indoSubtitle: string;
  keybind: string;
  cooldownSec: number;
  color: string;
}

export const SKILL_METAS: Record<SkillId, SkillMeta> = {
  basic: {
    id: 'basic',
    name: 'PLASMA SLASH',
    indoSubtitle: 'Basic Attack',
    keybind: 'SPACE',
    cooldownSec: 0.38,
    color: '#38bdf8',
  },
  skill1: {
    id: 'skill1',
    name: 'SHURIKEN WAVE',
    indoSubtitle: 'Skill 1 // Poke',
    keybind: 'Q',
    cooldownSec: 3.0,
    color: '#00f0ff',
  },
  skill2: {
    id: 'skill2',
    name: 'SHADOW DASH',
    indoSubtitle: 'Skill 2 // Kebal',
    keybind: 'SHIFT',
    cooldownSec: 4.2,
    color: '#a855f7',
  },
  skill3: {
    id: 'skill3',
    name: 'AEGIS PARRY',
    indoSubtitle: 'Skill 3 // Shield+Heal',
    keybind: 'E',
    cooldownSec: 6.5,
    color: '#10b981',
  },
  ulti: {
    id: 'ulti',
    name: 'ORBITAL BLADE',
    indoSubtitle: 'Ultimate // Burst',
    keybind: 'R',
    cooldownSec: 10.0,
    color: '#f59e0b',
  },
  retri: {
    id: 'retri',
    name: 'ICE RETRIBUTION',
    indoSubtitle: '2500 True DMG',
    keybind: 'F',
    cooldownSec: 12.0,
    color: '#ff2e4c',
  },
};

export const BOSS_MAX_HP = 18000;
export const RETRI_THRESHOLD_HP = 2500;
export const HERO_MAX_HP = 4500;
export const ARENA_RADIUS = 8.4;

export type BossTelegraphType = 'circle_slam' | 'meteor_ring' | 'laser_sweep';

export interface TelegraphZone {
  id: number;
  type: BossTelegraphType;
  x: number;
  z: number;
  radius: number;
  angle: number;
  createdAt: number;
  durationMs: number;
  damage: number;
  label: string;
}

export interface SkillVfxInstance {
  id: number;
  type: 'slash' | 'shuriken' | 'dash_trail' | 'orbital_ulti' | 'retri_smite' | 'boss_blast';
  x: number;
  z: number;
  targetX?: number;
  targetZ?: number;
  angle: number;
  createdAt: number;
  durationMs: number;
  color: string;
}

export interface FloatingDamageText {
  id: number;
  text: string;
  subtext?: string;
  x: number;
  y: number;
  z: number;
  color: string;
  isBig?: boolean;
  createdAt: number;
}

export type RoundOutcome =
  | 'playing'
  | 'victory_retri'
  | 'victory_burst'
  | 'stolen_indomaret'
  | 'stolen_late'
  | 'hero_eliminated';

export interface RoundStats {
  outcome: RoundOutcome;
  grade: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C';
  titleIndo: string;
  subtitleIndo: string;
  retriReactionMs: number | null;
  dodgedCount: number;
  hitTakenCount: number;
  totalDamageDealt: number;
  apm: number;
  durationSec: number;
}

export interface HudSnapshot {
  heroHp: number;
  heroMaxHp: number;
  shieldHp: number;
  bossHp: number;
  bossMaxHp: number;
  bossEnraged: boolean;
  inRetriZone: boolean;
  cooldownsRemaining: Record<SkillId, number>;
  comboCount: number;
  dodgedCount: number;
  announcerText: string;
  announcerColor: string;
  enemyJunglerWarning: boolean;
  roundStats: RoundStats | null;
}
