import * as React from 'react';

interface TelemetryDataProps {
  label: string;
  value: string | number;
  unit?: string;
}

export const TelemetryData = React.memo(({ label, value, unit }: TelemetryDataProps) => (
  <div className="flex flex-col">
    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-1">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className="text-4xl md:text-5xl font-mono font-bold text-[#F0F0F0] tabular-nums tracking-tighter">{value}</span>
      {unit && <span className="text-xs text-zinc-400 font-bold uppercase">{unit}</span>}
    </div>
  </div>
));

TelemetryData.displayName = 'TelemetryData';
