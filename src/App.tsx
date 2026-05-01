import React from 'react';
import { GameProvider, useGame } from './GameProvider';
import { GamePhase, PlayerState } from './types';
import { MainMenu } from './components/MainMenu';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { HUD } from './components/HUD';
import { Results } from './components/Results';

const AppContent = () => {
  const { gameSettings, localPlayer, socket } = useGame();

  // If we haven't even joined yet, we show the menu.
  // We don't wait for localPlayer because that only exists AFTER joinGame()
  if (!localPlayer) {
    return <MainMenu />;
  }

  // Once joined, we wait for the game state to sync from the server
  if (!gameSettings) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-10">
        <div className="text-xl tracking-[0.5em] animate-pulse">CONNECTING TO VOID...</div>
        <div className="text-[10px] text-gray-600 mt-4 tracking-widest uppercase">Syncing server state</div>
      </div>
    );
  }

  if (gameSettings.gamePhase === GamePhase.LOBBY) {
    return <Lobby />;
  }

  if (gameSettings.gamePhase === GamePhase.ENDED) {
    return <Results />;
  }

  return (
    <>
      <Game />
      <HUD />
    </>
  );
};

export default function App() {
  return (
    <GameProvider>
      <div className="w-full h-full bg-black overflow-hidden font-mono text-white select-none">
        <AppContent />
      </div>
    </GameProvider>
  );
}
