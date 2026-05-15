import React from 'react';
import { useMap } from 'react-leaflet';
import { Plus, Minus, LocateFixed } from 'lucide-react';

export function CustomMapControls({ riderPos }: { riderPos: [number, number] }) {
  const map = useMap();

  return (
    <div className="absolute right-4 bottom-[40%] md:bottom-32 z-[1000] flex flex-col gap-2 pointer-events-auto">
      <div className="flex flex-col bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-800 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <button 
          onClick={(e) => { e.stopPropagation(); map.zoomIn(); }}
          className="p-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 flex items-center justify-center text-white active:bg-zinc-700"
          aria-label="Zoom in"
        >
          <Plus size={20} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); map.zoomOut(); }}
          className="p-3 hover:bg-zinc-800 transition-colors flex items-center justify-center text-white active:bg-zinc-700"
          aria-label="Zoom out"
        >
          <Minus size={20} />
        </button>
      </div>

      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          map.setView(riderPos, map.getZoom(), { animate: true }); 
        }}
        className="p-3 bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center text-[#00f2ff] hover:bg-zinc-800 transition-colors active:bg-zinc-700 mt-2"
        aria-label="Recenter map"
      >
        <LocateFixed size={20} />
      </button>
    </div>
  );
}
