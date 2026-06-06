const fs = require('fs');

const replacements = [
  { regex: /Flight-Deck/g, replace: "Dashboard" },
  { regex: /Flight Deck/g, replace: "Dashboard" },
  { regex: /TELEMETRY_SYNC_SHIELD/g, replace: "LOCATION_SYNC" },
  { regex: /telemetry logs/gi, replace: "location logs" },
  { regex: /telemetry phase/gi, replace: "order status" },
  { regex: /telemetry register/gi, replace: "status log" },
  { regex: /telemetry/gi, replace: "location tracking" },
  { regex: /tactical overlay/gi, replace: "map overlay" },
  { regex: /Tactical Operator/g, replace: "Customer" },
  { regex: /Tactical HUD/gi, replace: "Dashboard" },
  { regex: /Tactical Onboarding/gi, replace: "Driver Onboarding" },
  { regex: /Tactical avatar/gi, replace: "Profile picture" },
  { regex: /Tactical Earnings/gi, replace: "Earnings" },
  { regex: /Tactical/g, replace: "Profile" },
  { regex: /tactical/g, replace: "driver" },
  { regex: /Uplink certified/gi, replace: "Connection verified" },
  { regex: /Alpha Grid/gi, replace: "Delivery Network" },
  { regex: /Grid Relay/gi, replace: "Network Dispatch" },
  { regex: /Grid Uplink/gi, replace: "Network Connection" },
  { regex: /Grid ping/gi, replace: "Network ping" },
  { regex: /Grid Integrity/gi, replace: "Network Integrity" },
  { regex: /Grid Performance/gi, replace: "Network Performance" },
  { regex: /Grid Network/gi, replace: "Delivery Network" },
  { regex: /Central Grid/gi, replace: "Local Network" },
  { regex: /grid integrity/gi, replace: "service quality" },
  { regex: /grid/gi, replace: "network" },
  { regex: /Mission Complete/gi, replace: "Order Delivered" },
  { regex: /Missions Lock-In/gi, replace: "Orders Accepted" },
  { regex: /mission requests/gi, replace: "order requests" },
  { regex: /mission success/gi, replace: "order success" },
  { regex: /Operational Hotline/gi, replace: "Support" },
  { regex: /Operational Mission/gi, replace: "Active Order" },
  { regex: /operational grid/gi, replace: "delivery area" },
  { regex: /operational/gi, replace: "active" },
  { regex: /Active Mission Directives/g, replace: "Active Order Updates" },
  { regex: /Active Mission/g, replace: "Active Order" },
  { regex: /ActiveMissionView/g, replace: "ActiveOrderView" },
  { regex: /active missions/gi, replace: "active orders" },
  { regex: /Mission Tracking/gi, replace: "Order Tracking" },
  { regex: /Mission Pulse/gi, replace: "Order Status" },
  { regex: /Mission Alert/gi, replace: "Order Alert" },
  { regex: /mission/gi, replace: "order" },
  { regex: /Missions/gi, replace: "Orders" },
  { regex: /uplinks/gi, replace: "connections" },
  { regex: /Uplink/gi, replace: "Connection" },
  { regex: /uplink/gi, replace: "connection" },
  { regex: /override dispatch/gi, replace: "manual dispatch" },
  { regex: /Override Unit/gi, replace: "Driver" },
  { regex: /Operating Unit/gi, replace: "Driver" },
  { regex: /Orbital/g, replace: "Map" },
  { regex: /Vector Update/g, replace: "Location Update" },
  { regex: /payload/gi, replace: "delivery items" },
  { regex: /Packet/g, replace: "Order" },
  { regex: /packet/g, replace: "order" },
  { regex: /Rider Flight Deck/g, replace: "Driver Dashboard" },
  { regex: /FlightDeckSimulator/g, replace: "DashboardSimulator" },
];

const processFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    replacements.forEach(({ regex, replace }) => {
      content = content.replace(regex, replace);
    });
    // Fix imports if filename changed internally, though file remains the same
    content = content.replace(/import \{ DashboardSimulator \} from '\.\/components\/FlightDeckSimulator';/g, "import { FlightDeckSimulator as DashboardSimulator } from './components/FlightDeckSimulator';");
    content = content.replace(/export function DashboardSimulator/g, "export function FlightDeckSimulator");
    content = content.replace(/export function DriverOnboarding/g, "export function TacticalOnboarding");
    content = content.replace(/import \{ DriverOnboarding \} from '\.\/components\/TacticalOnboarding';/g, "import { TacticalOnboarding as DriverOnboarding } from './components/TacticalOnboarding';");

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Replaced in ${filePath}`);
    }
  }
};

[
  'src/App.tsx', 
  'src/components/RiderInteractiveTour.tsx', 
  'src/components/FlightDeckSimulator.tsx', 
  'src/components/TacticalOnboarding.tsx',
  'src/lib/geoContext.ts'
].forEach(processFile);
