import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const QRScanner = React.memo(function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [hasCamera, setHasCamera] = useState(true);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-full text-white"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="w-full max-w-sm">
        <h3 className="text-xl font-headline font-black italic uppercase text-white mb-6 text-center">
          Scan Merchant QR
        </h3>

        {!hasCamera ? (
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center">
            <Camera className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 font-bold">Camera access denied or not available.</p>
          </div>
        ) : (
          <div className="rounded-3xl overflow-hidden border-2 border-[#39FF14] shadow-[0_0_40px_rgba(57,255,20,0.2)]">
            <Scanner 
              onScan={(result) => onScan(result[0].rawValue)}
              onError={(error) => {
                console.error("Scanner Error:", error);
                setHasCamera(false);
              }}
            />
          </div>
        )}
        
        <p className="text-center text-zinc-500 font-black uppercase tracking-widest text-[10px] mt-8">
          Point camera at the shop's pairing QR code
        </p>
      </div>
    </div>
  );
});
