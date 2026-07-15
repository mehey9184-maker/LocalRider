import { useEffect, useRef, useState, useCallback } from 'react';

interface TrackerOptions {
  onLocationUpdate: (
    lat: number,
    lng: number,
    speed: number,
    heading: number,
    batteryLevel: number,
    isMocked: boolean
  ) => Promise<void> | void;
  isEcoMode?: boolean;
  minDistanceMeters?: number; // Default 5m zero-movement threshold
}

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

// Haversine formula for calculating distance between two coordinates in meters
const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface BatteryManager {
  level: number;
  addEventListener(type: 'levelchange', listener: (this: BatteryManager, ev: Event) => void): void;
  removeEventListener(type: 'levelchange', listener: (this: BatteryManager, ev: Event) => void): void;
}

export const useAdaptiveRiderTracker = ({
  onLocationUpdate,
  isEcoMode = false,
  minDistanceMeters = 5,
}: TrackerOptions) => {
  const [active, setActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);

  const lastSavedCoordsRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onLocationUpdateRef = useRef(onLocationUpdate);

  // Keep callback reference updated to avoid hook teardown on parent re-renders
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  // Monitor battery level via the Web Battery API
  useEffect(() => {
    let batteryInstance: BatteryManager | null = null;

    const updateBatteryInfo = (battery: BatteryManager) => {
      setBatteryLevel(battery.level);
    };

    const handleLevelChange = (e: Event) => {
      const target = e.target as unknown as BatteryManager;
      if (target) {
        setBatteryLevel(target.level);
      }
    };

    if ('getBattery' in navigator) {
      (navigator as unknown as { getBattery: () => Promise<BatteryManager> })
        .getBattery()
        .then((battery: BatteryManager) => {
          batteryInstance = battery;
          updateBatteryInfo(battery);
          battery.addEventListener('levelchange', handleLevelChange);
        })
        .catch((err: unknown) => {
          console.warn('Battery API not accessible:', err);
        });
    }

    return () => {
      if (batteryInstance) {
        batteryInstance.removeEventListener('levelchange', handleLevelChange);
      }
    };
  }, []);

  const handleNewPosition = useCallback(
    async (position: GeolocationPosition | { coords: LocationCoords; timestamp: number; isFallback?: boolean }) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      const speed = position.coords.speed || 0;
      const heading = position.coords.heading || 0;
      const now = Date.now();

      // Native app or simulator flags
      const isMocked = 'isFallback' in position ? !!position.isFallback : false;

      setCurrentLocation({
        latitude: lat,
        longitude: lng,
        accuracy,
        speed,
        heading,
      });

      const lastSaved = lastSavedCoordsRef.current;

      if (lastSaved) {
        const distance = calculateHaversineDistance(lastSaved.lat, lastSaved.lng, lat, lng);
        const timeElapsed = now - lastSaved.time;

        // Adaptive Throttling Thresholds based on velocity & battery level
        let timeThreshold: number;

        // If battery is low or Eco Mode is active, optimize further
        const actualBattery = batteryLevel;
        const lowBattery = actualBattery < 0.25 || isEcoMode;

        // Dynamic Speed detection using speed (m/s) or distance/time velocity
        const calculatedSpeedKmh = speed ? speed * 3.6 : (distance / (timeElapsed / 1000)) * 3.6;
        const isStationary = distance < minDistanceMeters && calculatedSpeedKmh < 1;

        if (isStationary) {
          // Stationary throttling: Update every 60 seconds (or 120s if battery is low / eco-mode)
          timeThreshold = lowBattery ? 120000 : 60000;
        } else if (calculatedSpeedKmh > 15) {
          // Fast-moving (e.g., motor rider): High fidelity required, update every 8-10 seconds
          timeThreshold = lowBattery ? 15000 : 8000;
        } else {
          // Medium/Slow-moving (e.g., bicycle rider): 15s default (or 30s if battery saver is on)
          timeThreshold = lowBattery ? 30000 : 15000;
        }

        // Zero-Movement Filtering: Do not write/fire if rider has moved less than minDistanceMeters
        if (distance < minDistanceMeters && timeElapsed < timeThreshold) {
          return;
        }
      }

      // Commit the updated tracking point
      lastSavedCoordsRef.current = { lat, lng, time: now };
      
      try {
        await onLocationUpdateRef.current(lat, lng, speed, heading, batteryLevel, isMocked);
      } catch (err) {
        console.warn('Failed to dispatch adaptive coordinate updates:', err);
      }
    },
    [batteryLevel, isEcoMode, minDistanceMeters]
  );

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (fallbackIntervalRef.current !== null) {
      clearInterval(fallbackIntervalRef.current);
    }

    setActive(true);
    setError(null);

    // Watch position with highest practical accuracy config
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        handleNewPosition(pos);
      },
      (err) => {
        console.warn('Adaptive Tracker: Primary watch failed. Triggering recovery fallback interval.', err);
        setError(`GPS Warning: Code ${err.code}. ${err.message}`);

        // Establish recovery periodic polling if primary watch is temporarily blocked or unavailable
        if (!fallbackIntervalRef.current) {
          fallbackIntervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                handleNewPosition(pos);
              },
              (fallbackErr) => {
                console.warn('GPS Triangulation totally offline:', fallbackErr);
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
            );
          }, isEcoMode ? 60000 : 30000);
        }
      },
      {
        enableHighAccuracy: !isEcoMode,
        timeout: isEcoMode ? 60000 : 25000,
        maximumAge: isEcoMode ? 30000 : 5000,
      }
    );
  }, [handleNewPosition, isEcoMode]);

  const stopTracking = useCallback(() => {
    setActive(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (fallbackIntervalRef.current !== null) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (fallbackIntervalRef.current !== null) {
        clearInterval(fallbackIntervalRef.current);
      }
    };
  }, []);

  return {
    active,
    currentLocation,
    batteryLevel,
    error,
    startTracking,
    stopTracking,
  };
};
