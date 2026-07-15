const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const acceptTarget = `toast.success('Order accepted. Starting navigation.', {
            description: surgeMultiplier > 1 ? \`Bonus active: x\${surgeMultiplier.toFixed(1)}\` : undefined
          });`;
const acceptReplace = `if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]); // Short vibration pattern for accept
          toast.success('Order accepted. Starting navigation.', {
            description: surgeMultiplier > 1 ? \`Bonus active: x\${surgeMultiplier.toFixed(1)}\` : undefined
          });`;

const pickupTarget = `                  onUpdateStatus(currentOrder.id, 'picked_up');
                  audioSynth.playArrivedDestination();
                  toast.success("Status: Food order collected successfully. Heading to delivery address.");`;
const pickupReplace = `                  if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]); // Haptic pickup
                  onUpdateStatus(currentOrder.id, 'picked_up');
                  audioSynth.playArrivedDestination();
                  toast.success("Status: Food order collected successfully. Heading to delivery address.");`;

const deliverTarget = `                  setShowSuccessOverlay(true);
                  audioSynth.playOrderDelivered();
                  setTimeout(() => {
                    onUpdateStatus(currentOrder.id, 'delivered');`;
const deliverReplace = `                  if ('vibrate' in navigator) navigator.vibrate([150, 100, 150, 100, 200]); // Haptic delivery
                  setShowSuccessOverlay(true);
                  audioSynth.playOrderDelivered();
                  setTimeout(() => {
                    onUpdateStatus(currentOrder.id, 'delivered');`;

code = code.replace(acceptTarget, acceptReplace);
code = code.replace(pickupTarget, pickupReplace);
code = code.replace(deliverTarget, deliverReplace);

fs.writeFileSync('src/App.tsx', code);
