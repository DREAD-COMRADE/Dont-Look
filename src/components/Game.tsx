import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PointerLockControls, Stars } from '@react-three/drei';
import { useGame } from '../GameProvider';
import { PlayerController } from './PlayerController';
import { Watcher } from './Watcher';
import { PlayerState, GamePhase } from '../types';
import * as THREE from 'three';

// Wall AABB definitions — must match the Box positions/sizes below
// Format: [minX, maxX, minZ, maxZ]
export const WALL_BOUNDS: [number, number, number, number][] = [
  [-5,  5,   9.5, 10.5],  // north wall
  [-5,  5,  -10.5, -9.5], // south wall
  [ 4.5, 5.5, -10, 10],   // east wall
  [-5.5, -4.5, -10, 10],  // west wall
];

const OtherPlayer = ({ data }: { data: any }) => (
  <group position={data.position}>
    <mesh position={[0, 0.9, 0]}>
      <capsuleGeometry args={[0.4, 1.0, 4, 8]} />
      <meshStandardMaterial color="#334" />
    </mesh>
    <mesh position={[0, 1.75, -0.35]}>
      <coneGeometry args={[0.08, 0.25, 4]} />
      <meshStandardMaterial color="#aaa" emissive="#888" emissiveIntensity={0.5} />
    </mesh>
  </group>
);

// Animated ritual ring — pulses when ritual is available
const RitualCircle = ({ available }: { available: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = available
        ? 1.5 + Math.sin(clock.getElapsedTime() * 3) * 0.8
        : 0.3;
    }
  });
  return (
    <group>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.8, 3.0, 64]} />
        <meshStandardMaterial
          color="red"
          emissive="red"
          emissiveIntensity={0.3}
          transparent
          opacity={available ? 0.9 : 0.3}
        />
      </mesh>
      {available && (
        <pointLight position={[0, 1, 0]} intensity={1.5} color="red" distance={6} />
      )}
    </group>
  );
};

// Exit arch — visible when exit is unlocked (no one trapped in Realm)
const ExitArch = ({ unlocked }: { unlocked: boolean }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.intensity = unlocked
        ? 2 + Math.sin(clock.getElapsedTime() * 2) * 0.5
        : 0.2;
    }
  });
  return (
    <group position={[0, 0, -9]}>
      {/* Arch posts */}
      <mesh position={[-1, 2, 0]}>
        <boxGeometry args={[0.3, 4, 0.3]} />
        <meshStandardMaterial
          color={unlocked ? "#00ff88" : "#1a1a1a"}
          emissive={unlocked ? "#00ff88" : "#000"}
          emissiveIntensity={unlocked ? 0.8 : 0}
        />
      </mesh>
      <mesh position={[1, 2, 0]}>
        <boxGeometry args={[0.3, 4, 0.3]} />
        <meshStandardMaterial
          color={unlocked ? "#00ff88" : "#1a1a1a"}
          emissive={unlocked ? "#00ff88" : "#000"}
          emissiveIntensity={unlocked ? 0.8 : 0}
        />
      </mesh>
      {/* Arch lintel */}
      <mesh position={[0, 4.15, 0]}>
        <boxGeometry args={[2.3, 0.3, 0.3]} />
        <meshStandardMaterial
          color={unlocked ? "#00ff88" : "#1a1a1a"}
          emissive={unlocked ? "#00ff88" : "#000"}
          emissiveIntensity={unlocked ? 0.8 : 0}
        />
      </mesh>
      <pointLight ref={lightRef} position={[0, 2, 0]} color="#00ff88" distance={8} />
    </group>
  );
};

// Secret path door — only visible in Final Act
const SecretPathDoor = ({ visible, onUse }: { visible: boolean; onUse: () => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.visible = visible;
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 4) * 0.4;
    }
  });
  return (
    <mesh
      ref={meshRef}
      position={[4.5, 1.5, 0]}
      visible={visible}
      onClick={onUse}
    >
      <boxGeometry args={[0.1, 3, 1.5]} />
      <meshStandardMaterial
        color="#8800ff"
        emissive="#8800ff"
        emissiveIntensity={0.5}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
};

const Environment = ({ ritualAvailable, exitUnlocked, secretPathVisible, onSecretPath }: {
  ritualAvailable: boolean;
  exitUnlocked: boolean;
  secretPathVisible: boolean;
  onSecretPath: () => void;
}) => (
  <group>
    <ambientLight intensity={0.06} />
    <pointLight position={[0, 5, 0]} intensity={0.8} color="#c8b89a" distance={20} />

    {/* Floor */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[11, 21]} />
      <meshStandardMaterial color="#111614" />
    </mesh>

    {/* Ceiling */}
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
      <planeGeometry args={[11, 21]} />
      <meshStandardMaterial color="#0a0c0a" />
    </mesh>

    {/* Walls — positions must match WALL_BOUNDS above */}
    <mesh position={[0, 2, 10]}>
      <boxGeometry args={[10, 4, 1]} />
      <meshStandardMaterial color="#1e201e" />
    </mesh>
    <mesh position={[0, 2, -10]}>
      <boxGeometry args={[10, 4, 1]} />
      <meshStandardMaterial color="#1e201e" />
    </mesh>
    <mesh position={[5, 2, 0]}>
      <boxGeometry args={[1, 4, 21]} />
      <meshStandardMaterial color="#1e201e" />
    </mesh>
    <mesh position={[-5, 2, 0]}>
      <boxGeometry args={[1, 4, 21]} />
      <meshStandardMaterial color="#1e201e" />
    </mesh>

    {/* Interior pillars for cover */}
    <mesh position={[-3, 2, 4]}>
      <boxGeometry args={[0.6, 4, 0.6]} />
      <meshStandardMaterial color="#252825" />
    </mesh>
    <mesh position={[3, 2, 4]}>
      <boxGeometry args={[0.6, 4, 0.6]} />
      <meshStandardMaterial color="#252825" />
    </mesh>
    <mesh position={[-3, 2, -4]}>
      <boxGeometry args={[0.6, 4, 0.6]} />
      <meshStandardMaterial color="#252825" />
    </mesh>
    <mesh position={[3, 2, -4]}>
      <boxGeometry args={[0.6, 4, 0.6]} />
      <meshStandardMaterial color="#252825" />
    </mesh>

    <RitualCircle available={ritualAvailable} />
    <ExitArch unlocked={exitUnlocked} />
    <SecretPathDoor visible={secretPathVisible} onUse={onSecretPath} />

    <Stars radius={60} depth={30} count={400} factor={3} fade />
    <fog attach="fog" args={['#050806', 4, 22]} />
  </group>
);

export const Game = () => {
  const { players, watchers, socket, localPlayer, gameSettings, useSecretPath } = useGame();
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const onLock = () => setIsLocked(true);
    const onUnlock = () => setIsLocked(false);
    document.addEventListener('pointerlockchange', onLock);
    document.addEventListener('pointerlockchange', onUnlock);
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('pointerlockchange', onUnlock);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!document.pointerLockElement) {
        document.body.requestPointerLock();
      }
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  if (!localPlayer) return null;

  const ritualAvailable = players.some(
    p => p.state === PlayerState.IN_REALM || p.state === PlayerState.IN_HARSH
  );
  const exitUnlocked = !ritualAvailable && gameSettings?.gamePhase === GamePhase.NORMAL;
  const secretVisible =
    localPlayer.state === PlayerState.IN_REALM &&
    gameSettings?.secretPathRevealed === true &&
    gameSettings?.gamePhase === GamePhase.FINAL_ACT;

  // Overlay color for Mystery/Harsh Realm — CSS not canvas
  const overlayStyle: React.CSSProperties | null =
    localPlayer.state === PlayerState.IN_REALM
      ? { position: 'absolute', inset: 0, background: 'rgba(20,0,40,0.3)', pointerEvents: 'none', mixBlendMode: 'multiply' }
      : localPlayer.state === PlayerState.IN_HARSH
      ? { position: 'absolute', inset: 0, background: 'rgba(80,5,5,0.45)', pointerEvents: 'none', mixBlendMode: 'multiply' }
      : null;

  return (
    <div className="w-full h-full relative" style={{ cursor: isLocked ? 'none' : 'crosshair' }}>
      {/* Click-to-lock prompt */}
      {!isLocked && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 10,
        }}>
          <div style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 12,
            letterSpacing: '0.3em', textTransform: 'uppercase',
          }}>
            click to look
          </div>
        </div>
      )}

      <Canvas
        camera={{ fov: 75, near: 0.1, far: 200 }}
        gl={{ antialias: false }}
      >
        <Environment
          ritualAvailable={ritualAvailable}
          exitUnlocked={exitUnlocked}
          secretPathVisible={secretVisible}
          onSecretPath={() => useSecretPath?.()}
        />

        {watchers.map(w => (
          <Watcher key={w.id} data={w} localPlayerPos={localPlayer.position} />
        ))}

        {players.map(p =>
          p.id !== socket?.id ? <OtherPlayer key={p.id} data={p} /> : null
        )}

        <PlayerController />
        <PointerLockControls makeDefault={false} />
      </Canvas>

      {/* Realm overlay — CSS div, not a canvas mesh */}
      {overlayStyle && <div style={overlayStyle} />}

      {/* Screen-edge vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: 'inset 0 0 80px rgba(0,0,0,0.7)',
      }} />
    </div>
  );
};
