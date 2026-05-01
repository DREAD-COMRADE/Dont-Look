import React, { useState } from 'react';
import { useGame } from '../GameProvider';

export const MainMenu = () => {
  const { joinGame } = useGame();
  const [name, setName] = useState('');

  const handleJoin = () => {
    const trimmed = name.trim();
    if (trimmed) joinGame(trimmed);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleJoin();
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: 'white',
      userSelect: 'none',
    }}>

      {/* Title */}
      <div style={{ marginBottom: 64, textAlign: 'center' }}>
        <h1 style={{
          fontSize: 52, fontWeight: 700, letterSpacing: '0.5em',
          margin: 0, marginBottom: 12,
          textShadow: '2px 0 #ff00c1, -2px 0 #00fff9',
        }}>
          DON'T LOOK
        </h1>
        <p style={{
          fontSize: 10, letterSpacing: '0.5em', color: '#333', margin: 0,
        }}>
          MULTIPLAYER HORROR · UP TO 8 PLAYERS
        </p>
      </div>

      {/* Entry form */}
      <div style={{
        border: '1px solid #1a1a1a', padding: '40px 48px',
        display: 'flex', flexDirection: 'column', gap: 16,
        minWidth: 320,
      }}>
        <p style={{
          fontSize: 9, letterSpacing: '0.4em', color: '#444',
          margin: 0, textAlign: 'center',
        }}>
          IDENTIFY YOURSELF
        </p>

        <input
          value={name}
          onChange={e => setName(e.target.value.toUpperCase().slice(0, 14))}
          onKeyDown={handleKey}
          placeholder="ENTER NAME"
          maxLength={14}
          autoFocus
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #333',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: 18,
            letterSpacing: '0.3em',
            padding: '8px 0',
            textAlign: 'center',
            outline: 'none',
            width: '100%',
          }}
        />

        <button
          onClick={handleJoin}
          disabled={!name.trim()}
          style={{
            marginTop: 8,
            background: 'transparent',
            border: name.trim() ? '1px solid #555' : '1px solid #1a1a1a',
            color: name.trim() ? '#fff' : '#222',
            fontFamily: 'monospace',
            fontSize: 11,
            letterSpacing: '0.4em',
            padding: '14px 0',
            cursor: name.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s',
            width: '100%',
          }}
          onMouseEnter={e => {
            if (name.trim()) (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          ENTER THE VOID
        </button>
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: 48, fontSize: 9, letterSpacing: '0.25em',
        color: '#222', textAlign: 'center', lineHeight: 2.2,
      }}>
        <p style={{ margin: 0 }}>WASD — MOVE &nbsp;·&nbsp; MOUSE — LOOK &nbsp;·&nbsp; SHIFT — RUN</p>
        <p style={{ margin: 0 }}>E — RITUAL &nbsp;·&nbsp; F — FLICKER (LOST ONLY)</p>
        <p style={{ margin: 0 }}>THEY ONLY MOVE WHEN YOU LOOK AWAY</p>
      </div>
    </div>
  );
};
