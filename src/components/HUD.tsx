import React, { useState, useEffect } from 'react';
import { useGame } from '../GameProvider';
import { PlayerState, GamePhase } from '../types';

const DOT_COLORS: Record<PlayerState, string> = {
  [PlayerState.ALIVE]:   '#22c55e',
  [PlayerState.IN_REALM]: '#eab308',
  [PlayerState.IN_HARSH]: '#ef4444',
  [PlayerState.LOST]:    '#374151',
  [PlayerState.ESCAPED]: '#60a5fa',
};

export const HUD = () => {
  const { players, watchers, gameSettings, localPlayer, gameMessage, socket } = useGame();
  const [migrationCountdown, setMigrationCountdown] = useState<number | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [flashMsg, setFlashMsg] = useState('');

  // Track pointer lock state
  useEffect(() => {
    const onLockChange = () => {
      setPointerLocked(!!document.pointerLockElement);
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  // Flash game messages
  useEffect(() => {
    if (gameMessage) {
      setFlashMsg(gameMessage);
      const t = setTimeout(() => setFlashMsg(''), 5000);
      return () => clearTimeout(t);
    }
  }, [gameMessage]);

  // Migration countdown from Final Act
  useEffect(() => {
    if (gameSettings?.gamePhase === GamePhase.FINAL_ACT && gameSettings.migrationCommitted) {
      const elapsed = gameSettings.migrationTimer ?? 0;
      const remaining = Math.max(0, 90 - elapsed);
      setMigrationCountdown(Math.ceil(remaining));
    } else {
      setMigrationCountdown(null);
    }
  }, [gameSettings]);

  if (!localPlayer) return null;

  const isInRealm = localPlayer.state === PlayerState.IN_REALM;
  const isInHarsh = localPlayer.state === PlayerState.IN_HARSH;
  const isAlive   = localPlayer.state === PlayerState.ALIVE;
  const isLost    = localPlayer.state === PlayerState.LOST;
  const isEscaped = localPlayer.state === PlayerState.ESCAPED;

  const ritualAvailable = players.some(
    p => p.state === PlayerState.IN_REALM || p.state === PlayerState.IN_HARSH
  );

  // Rough client-side proximity to ritual zone (center [0,0])
  const pos = localPlayer.position;
  const distToRitual = Math.sqrt(pos[0] ** 2 + pos[2] ** 2);
  const nearRitual = isAlive && ritualAvailable && distToRitual < 3.5;

  // Exit gate available
  const exitUnlocked = isAlive &&
    !players.some(p => p.state === PlayerState.IN_REALM || p.state === PlayerState.IN_HARSH) &&
    gameSettings?.gamePhase === GamePhase.NORMAL;

  // Secret path
  const secretPathActive = isInRealm &&
    gameSettings?.secretPathRevealed &&
    gameSettings?.gamePhase === GamePhase.FINAL_ACT;

  const finalAct = gameSettings?.gamePhase === GamePhase.FINAL_ACT;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      fontFamily: 'monospace', color: 'white', userSelect: 'none',
    }}>

      {/* === TOP LEFT: State banner === */}
      <div style={{ position: 'absolute', top: 28, left: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isInRealm && (
          <div style={{
            background: 'rgba(80,0,120,0.6)', border: '1px solid #8800ff',
            padding: '6px 14px', fontSize: 11, letterSpacing: '0.3em',
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            MYSTERY REALM
          </div>
        )}
        {isInHarsh && (
          <div style={{
            background: 'rgba(120,0,0,0.6)', border: '1px solid #ff2200',
            padding: '6px 14px', fontSize: 11, letterSpacing: '0.3em',
            animation: 'pulse 1s ease-in-out infinite',
          }}>
            HARSH DIMENSION
          </div>
        )}
        {isLost && (
          <div style={{
            background: 'rgba(0,0,0,0.6)', border: '1px solid #333',
            padding: '6px 14px', fontSize: 11, letterSpacing: '0.3em',
            color: '#555',
          }}>
            CONSUMED — PRESS F TO FLICKER
          </div>
        )}
        {isEscaped && (
          <div style={{
            background: 'rgba(0,60,0,0.6)', border: '1px solid #22c55e',
            padding: '6px 14px', fontSize: 11, letterSpacing: '0.3em',
            color: '#22c55e',
          }}>
            ESCAPED
          </div>
        )}

        {/* Final Act warning */}
        {finalAct && (
          <div style={{
            background: 'rgba(60,0,0,0.7)', border: '1px solid #ff4400',
            padding: '6px 14px', fontSize: 11, letterSpacing: '0.25em',
            color: '#ff6644',
          }}>
            THE COLLAPSE
            {migrationCountdown !== null && migrationCountdown > 0 && (
              <span style={{ marginLeft: 12, color: '#ff3300' }}>
                ARRIVAL IN {migrationCountdown}s
              </span>
            )}
            {migrationCountdown === 0 && (
              <span style={{ marginLeft: 12, color: '#ff0000' }}>IT IS HERE</span>
            )}
          </div>
        )}
      </div>

      {/* === TOP RIGHT: Player roster === */}
      <div style={{
        position: 'absolute', top: 28, right: 28,
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
      }}>
        {players.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 10, letterSpacing: '0.2em',
              color: p.id === socket?.id ? '#fff' : '#555',
            }}>
              {p.name}{p.id === socket?.id ? ' ·' : ''}
            </span>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: DOT_COLORS[p.state] ?? '#333',
              boxShadow: p.state === PlayerState.ALIVE ? '0 0 6px #22c55e' : 'none',
            }} />
          </div>
        ))}
        <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.15em', marginTop: 4 }}>
          WATCHERS: {watchers.length}
        </div>
      </div>

      {/* === CENTER: Crosshair === */}
      {pointerLocked && (isAlive || isInRealm || isInHarsh) && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'rgba(255,255,255,0.25)', fontSize: 20, lineHeight: 1,
        }}>+</div>
      )}

      {/* === CENTER: Click-to-look prompt === */}
      {!pointerLocked && (isAlive || isInRealm || isInHarsh) && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'rgba(255,255,255,0.4)', fontSize: 11,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          click to look
        </div>
      )}

      {/* === BOTTOM CENTER: Contextual interaction prompts === */}
      <div style={{
        position: 'absolute', bottom: 36, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        {nearRitual && (
          <div style={{
            background: 'rgba(120,0,0,0.7)', border: '1px solid red',
            padding: '8px 20px', fontSize: 11, letterSpacing: '0.3em',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}>
            HOLD [E] TO SACRIFICE
          </div>
        )}

        {exitUnlocked && (
          <div style={{
            background: 'rgba(0,80,40,0.7)', border: '1px solid #22c55e',
            padding: '8px 20px', fontSize: 11, letterSpacing: '0.3em', color: '#22c55e',
          }}>
            EXIT OPEN — MOVE NORTH
          </div>
        )}

        {!ritualAvailable && isAlive && gameSettings?.gamePhase === GamePhase.NORMAL && (
          <div style={{ fontSize: 9, color: '#222', letterSpacing: '0.2em' }}>
            RITUAL INACTIVE
          </div>
        )}

        {secretPathActive && (
          <div style={{
            background: 'rgba(40,0,80,0.8)', border: '1px solid #8800ff',
            padding: '8px 20px', fontSize: 11, letterSpacing: '0.25em', color: '#cc88ff',
            animation: 'pulse 0.8s ease-in-out infinite',
          }}>
            SECRET PATH VISIBLE — [CLICK DOOR] TO DECIDE
          </div>
        )}
      </div>

      {/* === BOTTOM LEFT: Ritual status === */}
      <div style={{ position: 'absolute', bottom: 36, left: 28 }}>
        <div style={{
          fontSize: 9, letterSpacing: '0.2em',
          color: ritualAvailable ? '#ef4444' : '#1f1f1f',
        }}>
          RITUAL {ritualAvailable ? 'READY' : 'INACTIVE'}
        </div>
      </div>

      {/* === TOP CENTER: Flash message === */}
      {flashMsg && (
        <div style={{
          position: 'absolute', top: 80, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.1)',
          padding: '8px 20px', fontSize: 11, letterSpacing: '0.25em',
          color: '#ddd', textAlign: 'center', maxWidth: 480,
          whiteSpace: 'nowrap',
        }}>
          {flashMsg}
        </div>
      )}

      {/* VHS scanline effect */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0px, rgba(0,0,0,0.6) 1px, transparent 1px, transparent 2px)',
        backgroundSize: '100% 2px',
      }} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
