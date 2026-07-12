const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('setAvailableOrders(prev => {') && lines[lines.indexOf(l) + 1].includes('// Merge: preserve items from `prev` that are not in `sorted` (to protect real-time socket inserts from read-replica lag)'));

if (startIndex !== -1) {
  const endIndex = lines.indexOf('        });', startIndex);
  if (endIndex !== -1) {
    const newCode = `        setAvailableOrders(prev => {
           // Defensive State Reconciliation Layer
           const mergedMap = new Map<string, DeliveryOrder>();
           
           // 1. Cleanly apply the incoming REST snapshot
           for (const o of sorted) {
              mergedMap.set(o.id, o);
           }

           // 2. Scan existing state for any unassigned real-time orders 
           // and merge them into the snapshot to protect from replication lag 
           // or faulty backend exclusion filters
           const unassignedRealtimeOrders = prev.filter(o => o.delivery_status === 'finding_rider' && !o.rider_id);
           for (const o of unassignedRealtimeOrders) {
              if (!mergedMap.has(o.id)) {
                 mergedMap.set(o.id, o);
              }
           }
             
           const merged = Array.from(mergedMap.values()).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

           if (merged.length > prev.length) {
              toast(notificationTitle, { 
                description: notificationBody,
                duration: 5000,
                icon: <Zap className="w-4 h-4 text-[#f59e0b]" />,
                style: { background: '#050505', color: '#f59e0b', border: '1px solid #f59e0b', textTransform: 'uppercase', fontStyle: 'italic', fontWeight: 900 }
              });
           }
           return merged as DeliveryOrder[];
        });`;
    lines.splice(startIndex, endIndex - startIndex + 1, newCode);
    fs.writeFileSync('src/App.tsx', lines.join('\n'));
    console.log('patched successfully');
  } else {
    console.log('end index not found');
  }
} else {
  console.log('start index not found');
}
