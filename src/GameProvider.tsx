import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GamePhase, PlayerData, WatcherData, PlayerState } from './types';

interface GameContextType {
  socket: Socket | null;
  players: PlayerData[];
  watchers: WatcherData[];
  gameSettings: any;
  localPlayer: PlayerData | null;
  joinGame: (name: string) => void;
  toggleReady: () => void;
  startGame: () => void;
  sendInput: (data: any) => void;
  interactRitual: (active: boolean) => void;
  useSecretPath: () => void;
  gameMessage: string;
  collapseActive: boolean;
  migrationComplete: boolean;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [watchers, setWatchers] = useState<WatcherData[]>([]);
  const [gameSettings, setGameSettings] = useState<any>(null);
  const [gameMessage, setGameMessage] = useState('');
  const [collapseActive, setCollapseActive] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const showMessage = useCallback((msg: string, duration = 6000) => {
    setGameMessage(msg);
    const t = setTimeout(() => setGameMessage(''), duration);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const s = io();
    setSocket(s);
    socketRef.current = s;

    s.on('player_list', (list: PlayerData[]) => setPlayers(list));
    s.on('game_settings', (settings: any) => setGameSettings(settings));

    s.on('state_sync', (data: any) => {
      setPlayers(data.players);
      setWatchers(data.watchers);
      setGameSettings(data.gameSettings);
    });

    s.on('game_start', (data: any) => {
      setGameSettings(data.gameSettings);
      setWatchers(data.watchers);
      setCollapseActive(false);
      setMigrationComplete(false);
    });

    s.on('ritual_event', (msg: string) => showMessage(msg));

    s.on('ritual_progress', (_pct: number) => {
      // Could drive a progress bar — available here for HUD
    });

    s.on('player_captured', (id: string) => {
      setPlayers(prev => prev.map(p =>
        p.id === id ? { ...p, state: PlayerState.IN_REALM } : p
      ));
    });

    s.on('player_escaped', (id: string) => {
      setPlayers(prev => prev.map(p =>
        p.id === id ? { ...p, state: PlayerState.ESCAPED } : p
      ));
    });

    s.on('collapse_event', ({ migrationSeconds }: { migrationSeconds: number }) => {
      setCollapseActive(true);
      showMessage(`THE VOID CONSUMES THE WORLD. ARRIVAL IN ${migrationSeconds}s.`, 8000);
    });

    s.on('migration_complete', () => {
      setMigrationComplete(true);
      showMessage('IT HAS ARRIVED.', 5000);
    });

    s.on('secret_path_outcome', ({ betrayer, outcome }: { betrayer: string; outcome: string }) => {
      if (outcome === 'selfish') {
        showMessage('A SOUL ESCAPED ALONE. THE OTHERS ARE GONE.', 8000);
      } else {
        showMessage('THE THRESHOLD CLAIMED ITS OWN. THE WAY IS OPEN.', 8000);
      }
    });

    s.on('realm_shared_light', (_ids: string[]) => {
      showMessage('A SHARED FATE. FIND THE LIGHT TOGETHER.', 5000);
    });

    s.on('execute_flicker', () => {
      // Trigger a brief screen flash — implement in HUD if desired
    });

    s.on('game_ended', ({ win, escaped }: { win: boolean; escaped: number }) => {
      if (win) {
        showMessage(`SESSION COMPLETE. ${escaped} SURVIVED.`, 10000);
      } else {
        showMessage('ALL CONSUMED. NONE REMAIN.', 10000);
      }
    });

    return () => { s.disconnect(); };
  }, []);

  const localPlayer = players.find(p => p.id === socket?.id) ?? null;

  const joinGame = useCallback((name: string) => socketRef.current?.emit('join', name), []);
  const toggleReady = useCallback(() => socketRef.current?.emit('ready_toggle'), []);
  const startGame = useCallback(() => socketRef.current?.emit('start_game'), []);
  const sendInput = useCallback((data: any) => socketRef.current?.emit('update_input', data), []);
  const interactRitual = useCallback((active: boolean) => socketRef.current?.emit('ritual_interact', active), []);
  const useSecretPath = useCallback(() => socketRef.current?.emit('use_secret_path'), []);

  return (
    <GameContext.Provider value={{
      socket, players, watchers, gameSettings, localPlayer,
      joinGame, toggleReady, startGame, sendInput,
      interactRitual, useSecretPath,
      gameMessage, collapseActive, migrationComplete,
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
};
