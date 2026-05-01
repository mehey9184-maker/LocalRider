import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    let scanner: Html5Qrcode;

    const startScanning = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          scanner = new Html5Qrcode('qr-reader-container');
          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
              // Successfully decoded
              onScan(decodedText);
              scanner.stop();
            },
            () => {
              // Ignore typical parse errors while scanning
            }
          );
        } else {
          setHasCamera(false);
        }
      } catch (err: unknown) {
        setHasCamera(false);
        console.error('Camera access failed:', err);
      }
    };

    startScanning();

    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [onScan]);

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
            <div id="qr-reader-container" className="w-full bg-black"></div>
          </div>
        )}
        
        <p className="text-center text-zinc-500 font-black uppercase tracking-widest text-[10px] mt-8">
          Point camera at the shop's pairing QR code
        </p>
      </div>
    </div>
  );
}
