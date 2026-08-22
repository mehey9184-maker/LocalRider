import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, QrCode, Keyboard, AlertTriangle } from 'lucide-react';
import { Html5QrcodePlugin } from './Html5QrcodePlugin';

interface DeliveryPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedPin: string;
  onSuccess: () => void;
}

export const DeliveryPinModal: React.FC<DeliveryPinModalProps> = ({
  isOpen,
  onClose,
  expectedPin,
  onSuccess
}) => {
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'keypad' | 'qr'>('keypad');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setMode('keypad');
      setError(false);
    } else if (mode === 'keypad') {
      // Auto-focus when modal opens or switches to keypad
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === expectedPin) {
        onSuccess();
      } else {
        setError(true);
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        setTimeout(() => {
          setPin('');
          setError(false);
          inputRef.current?.focus();
        }, 1000);
      }
    }
  }, [pin, expectedPin, onSuccess]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleQrSuccess = (result: string) => {
    // Assuming the QR code contains just the 4-digit PIN
    if (result.trim() === expectedPin) {
      onSuccess();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-900/50">
            <h2 className="text-white font-bold tracking-wider text-sm">Proof of Delivery</h2>
            <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-zinc-400 text-sm mb-2">
                Enter the 4-digit PIN provided by the customer to confirm delivery.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-zinc-900 p-1 rounded-xl mb-6">
              <button
                onClick={() => setMode('keypad')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  mode === 'keypad' ? 'bg-[#f59e0b] text-black shadow-lg' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                KEYPAD
              </button>
              <button
                onClick={() => setMode('qr')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  mode === 'qr' ? 'bg-[#f59e0b] text-black shadow-lg' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                SCAN QR
              </button>
            </div>

            {mode === 'keypad' ? (
              <div className="flex flex-col items-center">
                {/* Hidden Input for Keyboard Support */}
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    if (val.length <= 4) {
                      setPin(val);
                      setError(false);
                    }
                  }}
                  className="absolute opacity-0 -z-10"
                  autoFocus
                />

                {/* PIN Display */}
                <div 
                  className={`flex gap-3 mb-8 cursor-pointer ${error ? 'animate-shake' : ''}`}
                  onClick={() => inputRef.current?.focus()}
                >
                  {[0, 1, 2, 3].map(i => (
                    <div 
                      key={i}
                      className={`w-14 h-16 flex items-center justify-center text-3xl font-mono font-bold rounded-xl border-2 transition-all ${
                        pin[i] 
                          ? error ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]/10'
                          : (pin.length === i && !error) ? 'border-[#f59e0b]/50 text-zinc-600 bg-zinc-900 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-zinc-800 text-zinc-600 bg-zinc-900/50'
                      }`}
                    >
                      {pin[i] || ''}
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="text-red-500 text-xs font-bold mb-4 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    INVALID PIN
                  </div>
                )}

                {/* Keyboard */}
                <div className="grid grid-cols-3 gap-3 w-full">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => { handleKeyPress(num.toString()); inputRef.current?.focus(); }}
                      className="h-14 bg-zinc-900 hover:bg-zinc-800 text-white text-xl font-bold rounded-xl transition-all active:scale-95 border border-zinc-800 hover:border-zinc-700"
                    >
                      {num}
                    </button>
                  ))}
                  <div className="h-14"></div>
                  <button
                    onClick={() => { handleKeyPress('0'); inputRef.current?.focus(); }}
                    className="h-14 bg-zinc-900 hover:bg-zinc-800 text-white text-xl font-bold rounded-xl transition-all active:scale-95 border border-zinc-800 hover:border-zinc-700"
                  >
                    0
                  </button>
                  <button
                    onClick={() => { handleDelete(); inputRef.current?.focus(); }}
                    className="h-14 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center"
                  >
                    DEL
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative min-h-[300px]">
                <Html5QrcodePlugin 
                  fps={10}
                  qrbox={250}
                  disableFlip={false}
                  qrCodeSuccessCallback={(decodedText) => handleQrSuccess(decodedText)}
                />
                {error && (
                  <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-20 backdrop-blur-sm">
                    <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-xl">
                      INVALID QR CODE
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* Dev Mode Test Helper */}
            {import.meta.env.DEV && (
              <button 
                onClick={() => setPin(expectedPin)}
                className="mt-6 w-full py-2 bg-zinc-900/80 border border-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs font-bold tracking-wider rounded-lg transition-colors"
              >
                DEV: SHOW TEST PIN ({expectedPin})
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
