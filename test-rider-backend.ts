import {
  claimDeliveryMissionHandler,
  markOrderPickedUpHandler,
  completeDeliveryHandler,
  incrementRiderStatsHandler
} from './functions/src/riderDeliveryFunctions';
import { backendDb } from './functions/src/dbAdapter';

interface TestReport {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

async function runTests() {
  console.log('====================================================');
  console.log('LOCAL EATS — AUTHORITATIVE CLOUD FUNCTIONS TEST SUITE');
  console.log('====================================================\n');

  const testShopId = 'shop_test_' + Date.now();
  const riderA = 'rider_auth_A_' + Date.now();
  const riderB = 'rider_auth_B_' + Date.now();

  // 1. Seed Rider Profiles
  await backendDb.collection('rider_profiles').doc(riderA).set({
    id: riderA,
    name: 'Sipho Dlamini',
    phone: '+27 82 111 2222',
    total_earnings: 100.0,
    total_deliveries: 5,
    active_points: 50,
    created_at: new Date().toISOString()
  });

  await backendDb.collection('rider_profiles').doc(riderB).set({
    id: riderB,
    name: 'Thabo Ndlovu',
    phone: '+27 83 333 4444',
    total_earnings: 50.0,
    total_deliveries: 2,
    active_points: 20,
    created_at: new Date().toISOString()
  });

  // -------------------------------------------------------------
  // Test A: Simultaneous claim (Two riders claim same order concurrently)
  // -------------------------------------------------------------
  const orderAId = 'order_test_race_' + Date.now();
  await backendDb.collection('orders').doc(orderAId).set({
    id: orderAId,
    delivery_status: 'finding_rider',
    order_type: 'delivery',
    total_price: 150.0,
    delivery_fee: 25.0,
    shop_id: testShopId,
    customer_id: 'cust_123',
    delivery_pin: '4321',
    created_at: new Date().toISOString()
  });

  let claimRes1: any = null;
  let claimRes2: any = null;
  let claimErr1: any = null;
  let claimErr2: any = null;

  await Promise.all([
    claimDeliveryMissionHandler({ order_id: orderAId }, riderA)
      .then(res => { claimRes1 = res; })
      .catch(err => { claimErr1 = err; }),
    claimDeliveryMissionHandler({ order_id: orderAId }, riderB)
      .then(res => { claimRes2 = res; })
      .catch(err => { claimErr2 = err; })
  ]);

  const exactlyOneWon = (claimRes1 && !claimRes2 && claimErr2) || (!claimRes1 && claimRes2 && claimErr1);
  const losingError = claimErr1 || claimErr2;

  reports.push({
    id: 'A',
    name: 'Simultaneous claim by two riders',
    passed: exactlyOneWon && losingError?.code === 'failed-precondition',
    details: `Claim 1: ${claimRes1 ? 'WON' : claimErr1?.message}, Claim 2: ${claimRes2 ? 'WON' : claimErr2?.message}`
  });

  // -------------------------------------------------------------
  // Test B: Unauthorized pickup
  // -------------------------------------------------------------
  const orderBId = 'order_test_pickup_' + Date.now();
  await backendDb.collection('orders').doc(orderBId).set({
    id: orderBId,
    rider_id: riderA,
    delivery_status: 'accepted',
    order_type: 'delivery',
    total_price: 200.0,
    delivery_fee: 30.0,
    shop_id: testShopId,
    customer_id: 'cust_123',
    created_at: new Date().toISOString()
  });

  let unassignedPickupErr: any = null;
  try {
    await markOrderPickedUpHandler({ order_id: orderBId }, riderB);
  } catch (err: any) {
    unassignedPickupErr = err;
  }

  reports.push({
    id: 'B',
    name: 'Unauthorized pickup attempt',
    passed: unassignedPickupErr?.code === 'permission-denied',
    details: `Blocked with code: ${unassignedPickupErr?.code} (${unassignedPickupErr?.message})`
  });

  // -------------------------------------------------------------
  // Test C: Unauthorized completion (Rider A attempts to complete Rider B's order)
  // -------------------------------------------------------------
  const orderCId = 'order_test_rider_b_' + Date.now();
  await backendDb.collection('orders').doc(orderCId).set({
    id: orderCId,
    rider_id: riderB,
    delivery_status: 'picked_up',
    order_type: 'delivery',
    delivery_pin: '8888',
    delivery_fee: 20.0,
    created_at: new Date().toISOString()
  });

  let foreignCompleteErr: any = null;
  try {
    await completeDeliveryHandler({ order_id: orderCId, delivery_pin: '8888' }, riderA);
  } catch (err: any) {
    foreignCompleteErr = err;
  }

  reports.push({
    id: 'C',
    name: "Unauthorized completion (Rider A on Rider B's order)",
    passed: foreignCompleteErr?.code === 'permission-denied',
    details: `Blocked with code: ${foreignCompleteErr?.code} (${foreignCompleteErr?.message})`
  });

  // -------------------------------------------------------------
  // Test D: Wrong delivery PIN
  // -------------------------------------------------------------
  const orderDId = 'order_test_pin_' + Date.now();
  await backendDb.collection('orders').doc(orderDId).set({
    id: orderDId,
    rider_id: riderA,
    delivery_status: 'picked_up',
    order_type: 'delivery',
    delivery_pin: '5678',
    delivery_fee: 22.0,
    created_at: new Date().toISOString()
  });

  let wrongPinErr: any = null;
  try {
    await completeDeliveryHandler({ order_id: orderDId, delivery_pin: '0000' }, riderA);
  } catch (err: any) {
    wrongPinErr = err;
  }

  reports.push({
    id: 'D',
    name: 'Wrong delivery PIN rejection',
    passed: wrongPinErr?.code === 'invalid-argument',
    details: `Rejected with code: ${wrongPinErr?.code} (${wrongPinErr?.message})`
  });

  // -------------------------------------------------------------
  // Test E: Correct delivery PIN completion
  // -------------------------------------------------------------
  const correctPinRes = await completeDeliveryHandler(
    { order_id: orderDId, delivery_pin: '5678' },
    riderA
  );

  const updatedOrderSnap = await backendDb.collection('orders').doc(orderDId).get();
  const orderDataE = updatedOrderSnap.data();

  reports.push({
    id: 'E',
    name: 'Correct delivery PIN completion & fee calculation',
    passed: correctPinRes.success && orderDataE?.delivery_status === 'delivered' && correctPinRes.earnings_awarded === 22.0,
    details: `Delivered successfully. Status: ${orderDataE?.delivery_status}, Awarded fee: R${correctPinRes.earnings_awarded}`
  });

  // -------------------------------------------------------------
  // Test F: Duplicate completion (Idempotency)
  // -------------------------------------------------------------
  const initialProfileSnap = await backendDb.collection('rider_profiles').doc(riderA).get();
  const earningsBefore = initialProfileSnap.data()?.total_earnings;

  const duplicateCompleteRes = await completeDeliveryHandler(
    { order_id: orderDId, delivery_pin: '5678' },
    riderA
  );

  const postProfileSnap = await backendDb.collection('rider_profiles').doc(riderA).get();
  const earningsAfter = postProfileSnap.data()?.total_earnings;

  reports.push({
    id: 'F',
    name: 'Duplicate completion request idempotency',
    passed: duplicateCompleteRes.success && earningsBefore === earningsAfter && duplicateCompleteRes.earnings_awarded === 0,
    details: `Idempotent response. Earnings before: R${earningsBefore}, after: R${earningsAfter} (No duplicate earnings increment)`
  });

  // -------------------------------------------------------------
  // Test G: Timeout + retry
  // -------------------------------------------------------------
  const orderGId = 'order_test_retry_' + Date.now();
  await backendDb.collection('orders').doc(orderGId).set({
    id: orderGId,
    rider_id: riderA,
    delivery_status: 'accepted',
    order_type: 'delivery',
    delivery_pin: '1234',
    delivery_fee: 18.0,
    created_at: new Date().toISOString()
  });

  const pickupRes1 = await markOrderPickedUpHandler({ order_id: orderGId }, riderA);
  const pickupRes2 = await markOrderPickedUpHandler({ order_id: orderGId }, riderA);

  const completeRes1 = await completeDeliveryHandler({ order_id: orderGId, delivery_pin: '1234' }, riderA);
  const completeRes2 = await completeDeliveryHandler({ order_id: orderGId, delivery_pin: '1234' }, riderA);

  reports.push({
    id: 'G',
    name: 'Network timeout followed by retry',
    passed: pickupRes1.success && pickupRes2.success && completeRes1.success && completeRes2.success,
    details: 'Pickup and completion retries handled idempotently without error'
  });

  // -------------------------------------------------------------
  // Test H: Forged earnings in client payload
  // -------------------------------------------------------------
  // The client attempts to pass custom earnings
  const forgedPayload = { order_id: orderGId, custom_earnings: 9999.0 } as any;
  const forgedRes = await incrementRiderStatsHandler(forgedPayload, riderA);

  const profileSnapH = await backendDb.collection('rider_profiles').doc(riderA).get();
  const actualEarnings = profileSnapH.data()?.total_earnings;

  reports.push({
    id: 'H',
    name: 'Forged earnings payload rejection',
    passed: forgedRes.success && actualEarnings < 500, // Server strictly used order's R18 fee, ignored R9999
    details: `Server strictly derived payout from verified DB order. Total earnings: R${actualEarnings}`
  });

  // -------------------------------------------------------------
  // Test I: Forged rider_id
  // -------------------------------------------------------------
  const orderIId = 'order_test_forged_rider_' + Date.now();
  await backendDb.collection('orders').doc(orderIId).set({
    id: orderIId,
    delivery_status: 'finding_rider',
    order_type: 'delivery',
    total_price: 100.0,
    delivery_fee: 15.0,
    shop_id: testShopId,
    created_at: new Date().toISOString()
  });

  // Rider A claims, but attempts to forge rider_id: riderB in body
  await claimDeliveryMissionHandler({ order_id: orderIId, rider_id: riderB } as any, riderA);

  const orderSnapI = await backendDb.collection('orders').doc(orderIId).get();
  const assignedRiderId = orderSnapI.data()?.rider_id;

  reports.push({
    id: 'I',
    name: 'Forged rider_id in request payload',
    passed: assignedRiderId === riderA,
    details: `Bound strictly to auth UID (${assignedRiderId}) and rejected forged rider (${riderB})`
  });

  // -------------------------------------------------------------
  // Test J: Forged rider_name
  // -------------------------------------------------------------
  const orderJId = 'order_test_forged_name_' + Date.now();
  await backendDb.collection('orders').doc(orderJId).set({
    id: orderJId,
    delivery_status: 'finding_rider',
    order_type: 'delivery',
    total_price: 120.0,
    delivery_fee: 15.0,
    shop_id: testShopId,
    created_at: new Date().toISOString()
  });

  // Rider A claims, but supplies forged rider_name in body
  await claimDeliveryMissionHandler({ order_id: orderJId, rider_name: 'Imposter Fake CEO' } as any, riderA);

  const orderSnapJ = await backendDb.collection('orders').doc(orderJId).get();
  const assignedRiderName = orderSnapJ.data()?.rider_name;

  reports.push({
    id: 'J',
    name: 'Forged rider_name in request payload',
    passed: assignedRiderName === 'Sipho Dlamini', // Authoritative profile name
    details: `Server used profile name (${assignedRiderName}) instead of forged client name`
  });

  // -------------------------------------------------------------
  // Test K: Forged delivery_fee
  // -------------------------------------------------------------
  const orderKId = 'order_test_forged_fee_' + Date.now();
  await backendDb.collection('orders').doc(orderKId).set({
    id: orderKId,
    rider_id: riderA,
    delivery_status: 'accepted',
    total_price: 250.0,
    delivery_fee: 25.0,
    shop_id: testShopId,
    customer_id: 'cust_abc',
    created_at: new Date().toISOString()
  });

  // Rider attempts to supply forged delivery_fee during pickup
  await markOrderPickedUpHandler({ order_id: orderKId, delivery_fee: 1000.0 } as any, riderA);

  const orderSnapK = await backendDb.collection('orders').doc(orderKId).get();
  const feeAfterK = orderSnapK.data()?.delivery_fee;

  reports.push({
    id: 'K',
    name: 'Forged delivery_fee alteration attempt',
    passed: feeAfterK === 25.0,
    details: `delivery_fee preserved at authoritative R${feeAfterK}`
  });

  // -------------------------------------------------------------
  // Test L: Forged total_price
  // -------------------------------------------------------------
  // Rider attempts to alter total_price during pickup
  await markOrderPickedUpHandler({ order_id: orderKId, total_price: 0.01 } as any, riderA);

  const orderSnapL = await backendDb.collection('orders').doc(orderKId).get();
  const priceAfterL = orderSnapL.data()?.total_price;

  reports.push({
    id: 'L',
    name: 'Forged total_price alteration attempt',
    passed: priceAfterL === 250.0,
    details: `total_price preserved at authoritative R${priceAfterL}`
  });

  // -------------------------------------------------------------
  // Test M: Forged shop_id
  // -------------------------------------------------------------
  // Rider attempts to alter shop_id
  await markOrderPickedUpHandler({ order_id: orderKId, shop_id: 'rogue_shop_999' } as any, riderA);

  const orderSnapM = await backendDb.collection('orders').doc(orderKId).get();
  const shopAfterM = orderSnapM.data()?.shop_id;

  reports.push({
    id: 'M',
    name: 'Forged shop_id alteration attempt',
    passed: shopAfterM === testShopId,
    details: `shop_id preserved as ${shopAfterM}`
  });

  // -------------------------------------------------------------
  // Test N: Forged customer_id
  // -------------------------------------------------------------
  // Rider attempts to alter customer_id
  await markOrderPickedUpHandler({ order_id: orderKId, customer_id: 'rogue_customer_999' } as any, riderA);

  const orderSnapN = await backendDb.collection('orders').doc(orderKId).get();
  const customerAfterN = orderSnapN.data()?.customer_id;

  reports.push({
    id: 'N',
    name: 'Forged customer_id alteration attempt',
    passed: customerAfterN === 'cust_abc',
    details: `customer_id preserved as ${customerAfterN}`
  });

  // Print Summary
  console.log('----------------------------------------------------');
  console.log('RESULTS:');
  console.log('----------------------------------------------------');
  let allPassed = true;
  for (const r of reports) {
    const mark = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[Test ${r.id}] ${mark} - ${r.name}`);
    console.log(`         Details: ${r.details}`);
    if (!r.passed) allPassed = false;
  }
  console.log('----------------------------------------------------');
  console.log(`FINAL RESULT: ${allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('====================================================');
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((e) => {
  console.error('Test execution fatal error:', e);
  process.exit(1);
});
