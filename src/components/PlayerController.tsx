import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Euler } from 'three';
import { useGame } from '../GameProvider';
import { WALL_BOUNDS } from './Game';
import { PlayerState } from '../types';

const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 4;
const RUN_SPEED = 7;
const CAM_HEIGHT = 0.7; // offset above position.y

function clampToWalls(pos: Vector3): Vector3 {
  for (const [minX, maxX, minZ, maxZ] of WALL_BOUNDS) {
    const expandedMinX = minX + PLAYER_RADIUS;
    const expandedMaxX = maxX - PLAYER_RADIUS;
    const expandedMinZ = minZ + PLAYER_RADIUS;
    const expandedMaxZ = maxZ - PLAYER_RADIUS;

    // Check overlap with expanded wall AABB
    if (
      pos.x < maxX + PLAYER_RADIUS &&
      pos.x > minX - PLAYER_RADIUS &&
      pos.z < maxZ + PLAYER_RADIUS &&
      pos.z > minZ - PLAYER_RADIUS
    ) {
      // Push out along the shortest axis
      const overlapX = Math.min(
        Math.abs(pos.x - expandedMinX),
        Math.abs(pos.x - expandedMaxX)
      );
      const overlapZ = Math.min(
        Math.abs(pos.z - expandedMinZ),
        Math.abs(pos.z - expandedMaxZ)
      );

      if (overlapX < overlapZ) {
        pos.x = pos.x < (minX + maxX) / 2 ? minX - PLAYER_RADIUS : maxX + PLAYER_RADIUS;
      } else {
        pos.z = pos.z < (minZ + maxZ) / 2 ? minZ - PLAYER_RADIUS : maxZ + PLAYER_RADIUS;
      }
    }
  }

  // Hard bounds: keep inside room
  pos.x = Math.max(-4.5, Math.min(4.5, pos.x));
  pos.z = Math.max(-9.5, Math.min(9.5, pos.z));

  return pos;
}

export const PlayerController = () => {
  const { camera } = useThree();
  const { sendInput, localPlayer, interactRitual } = useGame();

  const moveState = useRef({ forward: 0, right: 0, running: false });
  const rotation = useRef(new Euler(0, 0, 0, 'YXZ'));
  // Start above floor, back from ritual center
  const position = useRef(new Vector3(0, 1, -5));

  useEffect(() => {
    camera.position.set(0, 1 + CAM_HEIGHT, -5);
    camera.rotation.set(0, 0, 0);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore repeats
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyW': moveState.current.forward = 1; break;
        case 'KeyS': moveState.current.forward = -1; break;
        case 'KeyA': moveState.current.right = -1; break;
        case 'KeyD': moveState.current.right = 1; break;
        case 'ShiftLeft': moveState.current.running = true; break;
        case 'KeyE': interactRitual(true); break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': if (moveState.current.forward === 1) moveState.current.forward = 0; break;
        case 'KeyS': if (moveState.current.forward === -1) moveState.current.forward = 0; break;
        case 'KeyA': if (moveState.current.right === -1) moveState.current.right = 0; break;
        case 'KeyD': if (moveState.current.right === 1) moveState.current.right = 0; break;
        case 'ShiftLeft': moveState.current.running = false; break;
        case 'KeyE': interactRitual(false); break;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const sens = 0.002;
      rotation.current.y -= e.movementX * sens;
      rotation.current.x -= e.movementY * sens;
      rotation.current.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, rotation.current.x));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [interactRitual]);

  useFrame((_, delta) => {
    if (!localPlayer) return;

    // Restrict movement when dead/escaped
    const canMove =
      localPlayer.state === PlayerState.ALIVE ||
      localPlayer.state === PlayerState.IN_REALM ||
      localPlayer.state === PlayerState.IN_HARSH;
    if (!canMove) return;

    const speed = (moveState.current.running ? RUN_SPEED : WALK_SPEED) * Math.min(delta, 0.05);

    const dir = new Vector3(moveState.current.right, 0, -moveState.current.forward);
    if (dir.lengthSq() > 0) {
      dir.applyEuler(new Euler(0, rotation.current.y, 0));
      dir.normalize().multiplyScalar(speed);
      position.current.add(dir);
    }

    // AABB wall collision
    position.current = clampToWalls(position.current);

    // Apply to camera
    camera.rotation.copy(rotation.current);
    camera.position.set(
      position.current.x,
      position.current.y + CAM_HEIGHT,
      position.current.z
    );

    const camForward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    sendInput({
      position: [position.current.x, position.current.y, position.current.z],
      rotation: [rotation.current.x, rotation.current.y, rotation.current.z],
      camForward: [camForward.x, camForward.y, camForward.z],
      camPosition: [camera.position.x, camera.position.y, camera.position.z],
    });
  });

  return null;
};
