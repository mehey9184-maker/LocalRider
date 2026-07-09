import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  CloudRain, 
  CloudLightning, 
  Cloud, 
  Wind, 
  Sun 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { BentoCard } from './BentoCard';
import { WeatherData, WeatherForecastHour } from '../types';
import { cn } from '../lib/utils';

interface DashboardWeatherProps {
  lat?: number;
  lng?: number;
  weather: WeatherData | null;
  setWeather: React.Dispatch<React.SetStateAction<WeatherData | null>>;
}

export const DashboardWeather = React.memo(({ 
  lat, 
  lng, 
  weather, 
  setWeather 
}: DashboardWeatherProps) => {
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lastSyncFailed, setLastSyncFailed] = useState(false);

  // Periodically refresh minutes elapsed counter
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchWeather = useCallback(async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code&hourly=temperature_2m&timezone=auto`);
      if (res.ok) {
        const data = await res.json();
        
        const nowIso = new Date().toISOString().substring(0, 13) + ":00";
        let startIndex = -1;
        if (data.hourly && Array.isArray(data.hourly.time)) {
          startIndex = data.hourly.time.findIndex((t: string) => t >= nowIso);
        }
        if (startIndex === -1) startIndex = 0;
        
        const hourlyForecast: WeatherForecastHour[] = [];
        if (data.hourly && Array.isArray(data.hourly.time) && Array.isArray(data.hourly.temperature_2m)) {
          for (let i = 0; i < 6; i++) {
            const index = startIndex + i;
            if (index < data.hourly.time.length) {
              const timeStr = data.hourly.time[index];
              const dateObj = new Date(timeStr);
              const hourNum = dateObj.getHours();
              hourlyForecast.push({
                time: `${hourNum}:00`,
                temp: Number(data.hourly.temperature_2m[index])
              });
            }
          }
        }

        const info: WeatherData = {
          temp: data.current.temperature_2m,
          feelsLike: data.current.apparent_temperature,
          precipitation: data.current.precipitation,
          windSpeed: data.current.wind_speed_10m,
          code: data.current.weather_code,
          timestamp: Date.now(),
          hourlyForecast
        };
        setWeather(info);
        localStorage.setItem('localeats_cached_weather', JSON.stringify(info));
        setLastSyncFailed(false);
      } else {
        setLastSyncFailed(true);
      }
    } catch (e) {
      console.warn("Weather API unreachable:", e);
      setLastSyncFailed(true);
      const isSimulatedOffline = localStorage.getItem('localeats_force_offline') === 'true';
      const isSystemOffline = !navigator.onLine;
      if (!isSimulatedOffline && !isSystemOffline) {
        toast.error("Weather sensor connection offline", {
          description: "Displaying cached local meteorological coordinates. Standing by for reconnect...",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [setWeather]);

  useEffect(() => {
    const activeLat = lat || -25.9964;
    const activeLng = lng || 28.2268;
    
    let isMounted = true;
    const checkAndTrigger = () => {
      if (!isMounted) return;
      if (!weather) {
        fetchWeather(activeLat, activeLng);
      } else {
        const cached = localStorage.getItem('localeats_cached_weather');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp >= 3600000) {
              fetchWeather(activeLat, activeLng);
            }
          } catch (err) {
            console.warn("Cache parsing failed", err);
          }
        }
      }
    };

    const timer = setTimeout(checkAndTrigger, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [lat, lng, weather, fetchWeather]);

  if (!weather && loading) {
    return (
      <div className="w-full h-24 rounded-3xl bg-zinc-900/40 border border-zinc-800/60 animate-pulse flex items-center justify-center">
        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Acquiring Weather Coordinates...</span>
      </div>
    );
  }

  if (!weather) return null;

  // Confidence calculations based on sync age and status
  const minutesElapsed = Math.max(0, Math.floor((now - weather.timestamp) / 60000));
  let confidence: 'High' | 'Medium' | 'Low' | 'Offline' = 'High';
  let confColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let dotColor = 'bg-emerald-400';
  
  if (lastSyncFailed) {
    confidence = 'Offline';
    confColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    dotColor = 'bg-amber-500 animate-pulse';
  } else if (minutesElapsed >= 45) {
    confidence = 'Low';
    confColor = 'text-red-400 bg-red-500/10 border-red-500/20';
    dotColor = 'bg-red-400 animate-ping';
  } else if (minutesElapsed >= 15) {
    confidence = 'Medium';
    confColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    dotColor = 'bg-amber-400';
  }

  const isExtremePrecipitation = weather.precipitation > 5;
  const isExtremeWind = weather.windSpeed > 40;
  const hasExtremeSafetyAlert = isExtremePrecipitation || isExtremeWind;

  const getWeatherDetails = (code: number) => {
    if (code >= 51 && code <= 67) {
      return { 
        label: 'Rainy', 
        icon: <CloudRain className="w-5 h-5 text-blue-400" />, 
        bg: 'border-blue-500/20 bg-gradient-to-br from-slate-950 via-[#1e293b]/50 to-slate-950 shadow-[inset_0_1px_2px_rgba(59,130,246,0.05)]',
        glow: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_60%)]',
        tips: '⚠️ Wet roads detected! Avoid hard braking, lean gently on corners, and wear reflective kit.'
      };
    }
    if (code >= 80 && code <= 99) {
      return { 
        label: 'Storm / Rain Showers', 
        icon: <CloudLightning className="w-5 h-5 text-amber-500 animate-pulse" />, 
        bg: 'border-amber-500/20 bg-gradient-to-br from-slate-950 via-[#78350f]/20 to-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.05)]',
        glow: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_60%)]',
        tips: '🚨 Storm Warning! Turn on hazard lights, reduce speed by 20km/h, and keep your phone in a safe pocket.'
      };
    }
    if (code >= 1 && code <= 3) {
      return { 
        label: 'Partly Cloudy', 
        icon: <Cloud className="w-5 h-5 text-zinc-400" />, 
        bg: 'border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900/60 to-zinc-950 shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]',
        glow: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_50%)]',
        tips: '⛅ Clear vision conditions. Perfect weather for smooth dispatch pacing.'
      };
    }
    if (weather.windSpeed > 25) {
      return { 
        label: 'High Winds', 
        icon: <Wind className="w-5 h-5 text-teal-400" />, 
        bg: 'border-teal-500/20 bg-gradient-to-br from-zinc-950 via-[#0f766e]/15 to-zinc-950 shadow-[inset_0_1px_2px_rgba(20,184,166,0.05)]',
        glow: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.12),transparent_60%)]',
        tips: '💨 High wind drag! Keep two hands on handlebars and stay clear of large trucks.'
      };
    }
    return { 
      label: 'Clear Sky', 
      icon: <Sun className="w-5 h-5 text-[#f59e0b]" />, 
      bg: 'border-emerald-500/10 bg-gradient-to-br from-zinc-950 via-[#7c2d12]/10 to-zinc-950 shadow-[inset_0_1px_2px_rgba(245,158,11,0.04)]',
      glow: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.1),transparent_60%)]',
      tips: '☀️ Beautiful riding weather. Stay hydrated and remember sunscreen.'
    };
  };

  const details = getWeatherDetails(weather.code);

  return (
    <BentoCard className={cn("border p-5 rounded-[2rem] relative overflow-hidden transition-all duration-300", details.bg, details.glow)}>
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-black/60 border border-white/5 flex items-center justify-center shrink-0">
            {details.icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#f59e0b] font-mono">WEATHER COMM</span>
              <span className="w-1 h-1 rounded-full bg-orange-500" />
              <span className="text-[8px] font-sans font-bold text-zinc-500">TEMBISA SENSOR</span>
            </div>
            <h4 className="text-base font-black text-white mt-1.5 uppercase italic tracking-wide flex items-center gap-2">
              {details.label} • {weather.temp.toFixed(1)}°C
            </h4>
          </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-20 shrink-0">
          <div className="flex items-end gap-3 text-right">
            <div className="flex flex-col">
              <span className="text-[7.5px] font-black uppercase text-zinc-500 tracking-wider">Feels Like</span>
              <span className="text-xs font-mono font-bold text-white leading-tight">{weather.feelsLike.toFixed(1)}°C</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[7.5px] font-black uppercase text-zinc-500 tracking-wider">Wind</span>
              <span className="text-xs font-mono font-bold text-white leading-tight">{weather.windSpeed.toFixed(0)} kmh</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {/* Status confidence and age chip */}
            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[7.5px] font-black uppercase tracking-wider font-sans leading-none", confColor)}>
              <span className={cn("w-1 h-1 rounded-full shrink-0", dotColor)} />
              <span>CONF: {confidence} • {minutesElapsed === 0 ? "just now" : `${minutesElapsed}m ago`}</span>
            </div>
            <button 
              onClick={() => {
                fetchWeather(lat || -25.9964, lng || 28.2268);
                toast.success('Syncing high-fidelity meteorological sensors...');
              }}
              className="p-1 px-2 rounded-lg bg-black hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all text-[8px] font-sans uppercase font-bold flex items-center gap-1.5 border border-zinc-800"
              title="Refresh weather"
            >
              <span>Refresh Sensor</span> 🔄
            </button>
          </div>
        </div>
      </div>

      {/* Safety alert banner when conditions cross critical cyclist thresholds */}
      {hasExtremeSafetyAlert && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl relative z-10 flex items-start gap-3">
          <span className="text-sm shrink-0 mt-0.5 animate-bounce">🚨</span>
          <div className="space-y-0.5">
            <p className="text-[9.5px] text-red-400 font-bold uppercase tracking-wider font-sans leading-none">Extreme Cyclist Safety Warning</p>
            <p className="text-[9px] text-zinc-300 font-sans leading-relaxed font-semibold">
              {isExtremePrecipitation && `Severe downpour detected (${weather.precipitation}mm). wet tires have 60% less grip. Extend stopping distance by 3x.`}
              {isExtremePrecipitation && isExtremeWind && ` • `}
              {isExtremeWind && `Dangerous high winds of ${weather.windSpeed}kmh. Avoid draft tunnels next to heavy freight vehicles.`}
            </p>
          </div>
        </div>
      )}

      {/* 6-hour forecast Sparkline Chart */}
      {weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
        <div className="mt-4 relative z-10">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">6-Hour Temperature Projection</span>
            <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider font-sans leading-none">
              Shift Trend: {weather.hourlyForecast[0].temp.toFixed(0)}°C → {weather.hourlyForecast[5]?.temp.toFixed(0)}°C
            </span>
          </div>
          <div className="h-16 w-full min-w-0 opacity-90">
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={weather.hourlyForecast} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="weatherTempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#18181b" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  tickLine={false} 
                  axisLine={false} 
                  stroke="#52525b" 
                  fontSize={8} 
                  dy={4}
                  fontWeight="bold"
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-black/90 p-1.5 px-2.5 rounded-lg border border-zinc-800 text-[9px] font-mono shadow-xl leading-none">
                          <span className="text-zinc-400 font-bold">{payload[0].payload.time}</span> : <span className="text-amber-400 font-black font-sans">{Number(payload[0].value).toFixed(1)}°C</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="temp" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#weatherTempGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="h-px bg-zinc-800 my-3 relative z-10" />
      
      <div className="flex items-start gap-2.5 relative z-10">
        <span className="text-xs shrink-0 mt-0.5">💡</span>
        <p className="text-[9.5px] text-zinc-400 font-sans font-bold uppercase tracking-wider leading-relaxed">
          {details.tips}
        </p>
      </div>
    </BentoCard>
  );
});

DashboardWeather.displayName = 'DashboardWeather';
