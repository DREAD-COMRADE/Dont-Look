import React from 'react';
import { useGame } from '../GameProvider';

export const Lobby = () => {
  const { players, socket, toggleReady, startGame } = useGame();
  const isHost = players[0]?.id === socket?.id;
  const allReady = players.length >= 2 && players.every(p => p.isReady);

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a] p-12">
      <div className="grid grid-cols-2 gap-12 w-full max-w-5xl">
        <div className="border border-[#1a1a1a] p-8 flex flex-col gap-4">
          <h2 className="text-sm tracking-widest text-[#888] mb-4">SURVIVORS</h2>
          {players.map(p => (
            <div key={p.id} className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="tracking-widest">{p.name} {p.id === socket?.id ? "(YOU)" : ""}</span>
              <div className={`w-2 h-2 rounded-full ${p.isReady ? 'bg-green-500 shadow-[0_0_8px_green]' : 'bg-[#333]'}`} />
            </div>
          ))}
        </div>

        <div className="border border-[#1a1a1a] p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-sm tracking-widest text-[#888] mb-4">GAME INFO</h2>
            <div className="flex flex-col gap-4 text-xs tracking-widest text-[#666]">
               <p>DIFFICULTY: MEDIUM</p>
               <p>WATCHERS: 3-4</p>
               <p>PLAYERS: {players.length}/8</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
             <button 
               onClick={toggleReady}
               className="border border-[#333] py-4 tracking-[0.2em] hover:border-white hover:bg-white/5"
             >
               {players.find(p => p.id === socket?.id)?.isReady ? 'CANCEL READY' : 'READY'}
             </button>
             
             {isHost && (
               <button 
                 disabled={!allReady}
                 onClick={startGame}
                 className="border border-[#333] py-4 tracking-[0.2em] hover:border-white text-white disabled:opacity-20 transition-all font-bold"
               >
                 START GAME
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
