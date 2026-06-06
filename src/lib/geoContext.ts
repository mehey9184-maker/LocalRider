export interface RegionContext {
  id: string;
  name: string;
  greetingTitle: string;
  heroText: string;
  dispatchMessage: string;
}

const REGIONS = [
  {
    id: 'tembisa',
    name: 'Tembisa',
    greetingTitle: 'Tembisa On-Demand Deliveries',
    heroText: 'Serving food for Tembisa',
    dispatchMessage: 'Tembisa Network Dispatch Active',
    lat: -26.002,
    lng: 28.225,
    radiusKm: 6
  },
  {
    id: 'ivory_park',
    name: 'Ivory Park',
    greetingTitle: 'Welcome to Ivory Park LocalEats',
    heroText: 'Serving hot Kotas to Ivory Park',
    dispatchMessage: 'Ivory Park Fleet Standby',
    lat: -25.998,
    lng: 28.188,
    radiusKm: 5
  },
  {
    id: 'rabie_ridge',
    name: 'Rabie Ridge',
    greetingTitle: 'Rabie Ridge Fast Deliveries',
    heroText: 'Hot meals straight to Rabie Ridge',
    dispatchMessage: 'Rabie Ridge Express Routing',
    lat: -26.020,
    lng: 28.163,
    radiusKm: 4
  }
];

const DEFAULT_REGION: RegionContext = {
  id: 'global',
  name: 'Local Sector',
  greetingTitle: 'LocalEats On-Demand Deliveries',
  heroText: 'Serving your neighborhood',
  dispatchMessage: 'Delivery Network Active'
};

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function detectRegion(lat: number | null | undefined, lng: number | null | undefined): RegionContext {
  if (!lat || !lng) return DEFAULT_REGION;

  let closestRegion = null;
  let minDistance = Infinity;

  for (const region of REGIONS) {
    const dist = getHaversineDistance(lat, lng, region.lat, region.lng);
    if (dist < minDistance && dist <= region.radiusKm) {
      minDistance = dist;
      closestRegion = region;
    }
  }

  return closestRegion || DEFAULT_REGION;
}
