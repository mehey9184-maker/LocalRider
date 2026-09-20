import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Camera, X, Keyboard } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const QRScanner = React.memo(function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [hasCamera, setHasCamera] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    if (clean) {
      onScan(clean);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <button 
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="w-full max-w-sm">
        <h3 className="text-xl font-headline font-black italic uppercase text-white mb-2 text-center tracking-wider">
          Scan Merchant QR
        </h3>
        <p className="text-[10px] text-zinc-400 text-center uppercase tracking-widest font-mono mb-6">
          Terminal Uplink & Pairing
        </p>

        {(!hasCamera || showManual) ? (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-[#f59e0b] flex items-center justify-center mx-auto">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">
                {!hasCamera ? 'Camera stream unreadable or blocked.' : 'Manual Pairing Code'}
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                Enter the 6-character code displayed on the Merchant Terminal screen.
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
              <input
                type="text"
                maxLength={6}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                placeholder="FH6JJA"
                className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-xl font-mono font-bold tracking-[0.2em] text-center text-white outline-none focus:border-[#f59e0b] transition-all placeholder:tracking-normal"
                autoFocus
              />
              <button
                type="submit"
                disabled={!/^[A-Z0-9]{6}$/.test(manualCode)}
                className="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all disabled:opacity-40"
              >
                Submit Pairing Code
              </button>
            </form>

            {hasCamera && showManual && (
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="text-xs text-zinc-400 hover:text-white underline pt-2 block mx-auto"
              >
                Switch back to Camera Scanner
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl overflow-hidden border-2 border-[#f59e0b] shadow-[0_0_40px_rgba(245,158,11,0.25)] relative bg-black min-h-[260px] flex items-center justify-center">
              <Scanner 
                onScan={(result) => {
                  if (result && result.length > 0 && result[0]?.rawValue) {
                    onScan(result[0].rawValue);
                  }
                }}
                onError={(error) => {
                  console.warn("QR Scanner notice (camera unavailable/blocked):", error);
                  setHasCamera(false);
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="w-full py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Keyboard className="w-4 h-4 text-[#f59e0b]" />
              Enter Code Manually
            </button>
          </div>
        )}
        
        <p className="text-center text-zinc-500 font-black uppercase tracking-widest text-[10px] mt-6">
          Point camera at shop's pairing QR or type pairing code
        </p>
      </div>
    </div>
  );
});

