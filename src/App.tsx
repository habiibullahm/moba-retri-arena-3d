import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ArenaScene3D,
  CombatCommandQueue,
} from './components/ArenaScene3D';
import { MobaHud } from './components/MobaHud';
import {
  BOSS_MAX_HP,
  DifficultyMode,
  HERO_MAX_HP,
  HudSnapshot,
  SkillId,
} from './game/types';
import { combatSfx } from './game/soundFx';

export function App() {
  const [difficulty, setDifficulty] = useState<DifficultyMode>('normal');
  const [isMuted, setIsMuted] = useState(false);

  const [hud, setHud] = useState<HudSnapshot>({
    heroHp: HERO_MAX_HP,
    heroMaxHp: HERO_MAX_HP,
    shieldHp: 0,
    bossHp: BOSS_MAX_HP,
    bossMaxHp: BOSS_MAX_HP,
    bossEnraged: false,
    inRetriZone: false,
    cooldownsRemaining: {
      basic: 0,
      skill1: 0,
      skill2: 0,
      skill3: 0,
      ulti: 0,
      retri: 0,
    },
    comboCount: 0,
    dodgedCount: 0,
    announcerText: 'SERANG SENTINEL LORD & AMANKAN RETRI DI 2500 HP!',
    announcerColor: '#00f0ff',
    enemyJunglerWarning: false,
    roundStats: null,
  });

  // Combined movement vector from touch joystick OR keyboard WASD
  const joystickVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const keysPressedRef = useRef<Record<string, boolean>>({});
  const moveInputRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const commandQueueRef = useRef<CombatCommandQueue>({
    pendingSkills: [],
    resetRequested: false,
  });

  const syncCombinedMovement = useCallback(() => {
    const keys = keysPressedRef.current;
    let kx = 0;
    let ky = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) kx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) kx += 1;
    if (keys['KeyW'] || keys['ArrowUp']) ky -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) ky += 1;

    if (kx !== 0 || ky !== 0) {
      moveInputRef.current = { x: kx, y: ky };
    } else {
      moveInputRef.current = {
        x: joystickVecRef.current.x,
        y: joystickVecRef.current.y,
      };
    }
  }, []);

  const handleMoveJoystick = useCallback(
    (x: number, y: number) => {
      joystickVecRef.current = { x, y };
      syncCombinedMovement();
    },
    [syncCombinedMovement]
  );

  const handleTriggerSkill = useCallback((skillId: SkillId) => {
    commandQueueRef.current.pendingSkills.push(skillId);
  }, []);

  const handleResetRound = useCallback(() => {
    commandQueueRef.current.resetRequested = true;
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      combatSfx.setMuted(next);
      return next;
    });
  }, []);

  // Desktop Keyboard Controls (WASD / Arrow Keys + Space / Q / W / E / R / F)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // Movement keys
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
        ].includes(e.code)
      ) {
        keysPressedRef.current[e.code] = true;
        syncCombinedMovement();
      }

      // Skill hotkeys
      const upper = e.key.toUpperCase();
      if (e.code === 'Space') {
        e.preventDefault();
        handleTriggerSkill('basic');
      } else if (upper === 'Q' || upper === '1') {
        handleTriggerSkill('skill1');
      } else if (upper === '2' || e.code === 'ShiftLeft') {
        handleTriggerSkill('skill2');
      } else if (upper === 'E' || upper === '3') {
        handleTriggerSkill('skill3');
      } else if (upper === 'R' || upper === '4') {
        handleTriggerSkill('ulti');
      } else if (upper === 'F' || upper === '5') {
        handleTriggerSkill('retri');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keysPressedRef.current[e.code]) {
        delete keysPressedRef.current[e.code];
        syncCombinedMovement();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleTriggerSkill, syncCombinedMovement]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070a12] select-none touch-none">
      {/* Mobile & Desktop MOBA Overlay HUD */}
      <MobaHud
        hud={hud}
        difficulty={difficulty}
        onChangeDifficulty={setDifficulty}
        onTriggerSkill={handleTriggerSkill}
        onMoveJoystick={handleMoveJoystick}
        onResetRound={handleResetRound}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* 3D Isometric MOBA River Pit Canvas */}
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 11.4, 11.8], fov: 42 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#070a12']} />
        <fog attach="fog" args={['#070a12', 16, 34]} />

        {/* Arena Lighting */}
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[8, 16, 8]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight
          position={[0, 4.5, 0]}
          intensity={hud.inRetriZone ? 3.5 : 2.0}
          color={hud.inRetriZone ? '#ff2e4c' : '#00f0ff'}
          distance={14}
        />
        <pointLight
          position={[-6, 3, -4]}
          intensity={1.5}
          color="#a855f7"
          distance={16}
        />

        <ArenaScene3D
          moveInputRef={moveInputRef}
          commandQueueRef={commandQueueRef}
          difficulty={difficulty}
          onUpdateHud={setHud}
        />
      </Canvas>
    </div>
  );
}

export default App;
