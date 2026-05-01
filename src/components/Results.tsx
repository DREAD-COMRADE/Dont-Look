import React from 'react';
import { useGame } from '../GameProvider';

export const Results = () => {
  const { players, gameSettings } = useGame();

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a] p-12">
      <div className="flex flex-col items-center gap-12 w-full max-w-2xl">
        <h1 className="text-6xl tracking-[0.4em] font-bold glitch-text">SESSION ENDED</h1>
        
        <div className="w-full border border-[#1a1a1a] p-8 flex flex-col gap-4">
          <h2 className="text-xs tracking-widest text-[#888] mb-4">FINAL DESTINIES</h2>
          {players.map(p => (
            <div key={p.id} className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="tracking-widest">{p.name}</span>
              <span className={`text-[10px] tracking-[0.2em] px-3 py-1 rounded-sm border ${
                p.state === 'ESCAPED' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'
              }`}>
                {p.state}
              </span>
            </div>
          ))}
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="border border-white px-24 py-4 tracking-[0.4em] hover:bg-white hover:text-black transition-all"
        >
          RETRY
        </button>
      </div>
    </div>
  );
};
