/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PlayerState {
  ALIVE = 'ALIVE',
  IN_REALM = 'IN_REALM',
  IN_HARSH = 'IN_HARSH',
  LOST = 'LOST',
  ESCAPED = 'ESCAPED',
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  NORMAL = 'NORMAL',
  FINAL_ACT = 'FINAL_ACT',
  ENDED = 'ENDED',
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum WatcherState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
}

export interface PlayerData {
  id: string;
  name: string;
  state: PlayerState;
  position: [number, number, number];
  rotation: [number, number, number];
  camForward: [number, number, number];
  camPosition: [number, number, number];
  respawnGrace: boolean;
  flickerCooldown: number;
  isReady: boolean;
}

export interface WatcherData {
  id: string;
  position: [number, number, number];
  state: WatcherState;
  distanceClosedTimer: number;
  lastDistToTarget: number;
  movingFramesCount: number;
}
