import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { backendDb, GenericTransaction } from './dbAdapter.js';

export interface ClaimMissionData {
  order_id: string;
}

export interface MarkPickedUpData {
  order_id: string;
}

export interface CompleteDeliveryData {
  order_id: string;
  delivery_pin?: string;
}

export interface IncrementRiderStatsData {
  order_id: string;
}

export interface CallableResponse<T = unknown> {
  success: boolean;
  data?: T;
  order_id?: string;
  delivery_status?: string;
  earnings_awarded?: number;
  message?: string;
}

/**
 * 1. claimDeliveryMissionHandler
 * Core server-side handler for claiming open delivery orders.
 * Binds authenticated UID and authoritative profile information inside an atomic transaction.
 */
export async function claimDeliveryMissionHandler(
  data: ClaimMissionData,
  authUid: string | undefined
): Promise<CallableResponse<{ order_id: string; delivery_status: string }>> {
  if (!authUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to claim delivery missions.');
  }

  const orderId = data?.order_id;
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid order_id.');
  }

  const orderRef = backendDb.collection('orders').doc(orderId);
  const profileRef = backendDb.collection('rider_profiles').doc(authUid);

  return await backendDb.runTransaction(async (transaction: GenericTransaction) => {
    // 1. Reads
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }

    const orderData = orderSnap.data() || {};

    // Verify order is unassigned and open for claiming
    if (orderData.delivery_status !== 'finding_rider') {
      throw new HttpsError('failed-precondition', 'Mission already claimed by another courier.');
    }

    if (orderData.rider_id && orderData.rider_id !== authUid) {
      throw new HttpsError('failed-precondition', 'Mission already claimed by another courier.');
    }

    const profileSnap = await transaction.get(profileRef);
    const profileData = profileSnap.exists ? (profileSnap.data() || {}) : {};

    // Authoritative metadata derived ONLY from server profile
    const riderName = profileData.name || profileData.full_name || 'Rider';
    const riderPhone = profileData.phone || '';
    const now = new Date().toISOString();

    // 2. Writes
    transaction.update(orderRef, {
      rider_id: authUid,
      rider_name: riderName,
      rider_phone: riderPhone,
      delivery_status: 'accepted',
      status: 'preparing',
      claimed_at: now,
      accepted_at: now,
      updated_at: now
    });

    return {
      success: true,
      order_id: orderId,
      delivery_status: 'accepted'
    };
  });
}

/**
 * 2. markOrderPickedUpHandler
 * Core server-side handler for advancing order state to "picked_up".
 * Validates rider ownership and restricts updates strictly to delivery tracking.
 */
export async function markOrderPickedUpHandler(
  data: MarkPickedUpData,
  authUid: string | undefined
): Promise<CallableResponse<{ order_id: string; delivery_status: string }>> {
  if (!authUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to mark orders as picked up.');
  }

  const orderId = data?.order_id;
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid order_id.');
  }

  const orderRef = backendDb.collection('orders').doc(orderId);

  return await backendDb.runTransaction(async (transaction: GenericTransaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }

    const orderData = orderSnap.data() || {};

    // Authorization check
    if (orderData.rider_id !== authUid) {
      throw new HttpsError('permission-denied', 'Rider is not assigned to this order.');
    }

    // Idempotency: If already picked up, return current state without re-updating
    if (orderData.delivery_status === 'picked_up') {
      return {
        success: true,
        order_id: orderId,
        delivery_status: 'picked_up'
      };
    }

    // State transition guard
    if (orderData.delivery_status !== 'accepted') {
      throw new HttpsError(
        'failed-precondition',
        `Invalid order status for pickup: currently ${orderData.delivery_status || 'unknown'}.`
      );
    }

    const now = new Date().toISOString();

    // Mutate ONLY delivery tracking timestamps/status (pricing, customer_id, shop_id are untouched)
    transaction.update(orderRef, {
      delivery_status: 'picked_up',
      status: 'in_transit',
      picked_up_at: now,
      updated_at: now
    });

    return {
      success: true,
      order_id: orderId,
      delivery_status: 'picked_up'
    };
  });
}

/**
 * 3. completeDeliveryHandler
 * Core server-side handler for completing delivery, verifying PIN, and awarding earnings.
 * Calculates earnings strictly from authoritative order data. Fully idempotent.
 */
export async function completeDeliveryHandler(
  data: CompleteDeliveryData,
  authUid: string | undefined
): Promise<CallableResponse<{ order_id: string; delivery_status: string; earnings_awarded: number }>> {
  if (!authUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to complete deliveries.');
  }

  const orderId = data?.order_id;
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid order_id.');
  }

  const orderRef = backendDb.collection('orders').doc(orderId);
  const profileRef = backendDb.collection('rider_profiles').doc(authUid);

  return await backendDb.runTransaction(async (transaction: GenericTransaction) => {
    // 1. All Reads First
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }

    const orderData = orderSnap.data() || {};

    // Authorization check
    if (orderData.rider_id !== authUid) {
      throw new HttpsError('permission-denied', 'Rider is not assigned to this order.');
    }

    // Idempotency: If already delivered, return 0 earnings awarded without double increment
    if (orderData.delivery_status === 'delivered') {
      return {
        success: true,
        order_id: orderId,
        delivery_status: 'delivered',
        earnings_awarded: 0
      };
    }

    // PIN Verification
    if (orderData.delivery_pin) {
      const expectedPin = String(orderData.delivery_pin).trim();
      const providedPin = String(data?.delivery_pin || '').trim();
      if (providedPin !== expectedPin) {
        throw new HttpsError('invalid-argument', 'Incorrect 4-digit delivery PIN.');
      }
    }

    const profileSnap = await transaction.get(profileRef);

    // 2. Authoritative Calculations
    const deliveryFee = typeof orderData.delivery_fee === 'number' ? orderData.delivery_fee : 15.0;
    const pointsAwarded = 15;
    const now = new Date().toISOString();

    // 3. Writes
    transaction.update(orderRef, {
      delivery_status: 'delivered',
      status: 'completed',
      delivered_at: now,
      updated_at: now
    });

    if (profileSnap.exists) {
      const pData = profileSnap.data() || {};
      const currentEarnings = typeof pData.total_earnings === 'number' ? pData.total_earnings : 0;
      const currentDeliveries = typeof pData.total_deliveries === 'number' ? pData.total_deliveries : 0;
      const currentPoints = typeof pData.active_points === 'number' ? pData.active_points : 0;

      const newEarnings = Number((currentEarnings + deliveryFee).toFixed(2));
      const newDeliveries = currentDeliveries + 1;
      const newPoints = currentPoints + pointsAwarded;

      transaction.update(profileRef, {
        total_earnings: newEarnings,
        total_deliveries: newDeliveries,
        active_points: newPoints,
        last_delivery_at: now,
        updated_at: now
      });
    }

    return {
      success: true,
      order_id: orderId,
      delivery_status: 'delivered',
      earnings_awarded: deliveryFee
    };
  });
}

/**
 * 4. incrementRiderStatsHandler
 * Server-authoritative stats updater.
 * Only increments based on authoritative database order record.
 */
export async function incrementRiderStatsHandler(
  data: IncrementRiderStatsData,
  authUid: string | undefined
): Promise<CallableResponse<{ rider_id: string; total_earnings: number; total_deliveries: number }>> {
  if (!authUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const orderId = data?.order_id;
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'Authoritative order_id is required.');
  }

  const orderRef = backendDb.collection('orders').doc(orderId);
  const profileRef = backendDb.collection('rider_profiles').doc(authUid);

  return await backendDb.runTransaction(async (transaction: GenericTransaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }

    const orderData = orderSnap.data() || {};
    if (orderData.rider_id !== authUid) {
      throw new HttpsError('permission-denied', 'Rider is not assigned to this order.');
    }

    if (orderData.delivery_status !== 'delivered') {
      throw new HttpsError('failed-precondition', 'Order must be delivered before awarding stats.');
    }

    const profileSnap = await transaction.get(profileRef);
    if (!profileSnap.exists) {
      throw new HttpsError('not-found', 'Rider profile not found.');
    }

    const pData = profileSnap.data() || {};
    const deliveryFee = typeof orderData.delivery_fee === 'number' ? orderData.delivery_fee : 15.0;
    const currentEarnings = typeof pData.total_earnings === 'number' ? pData.total_earnings : 0;
    const currentDeliveries = typeof pData.total_deliveries === 'number' ? pData.total_deliveries : 0;

    const newEarnings = Number((currentEarnings + deliveryFee).toFixed(2));
    const newDeliveries = currentDeliveries + 1;

    transaction.update(profileRef, {
      total_earnings: newEarnings,
      total_deliveries: newDeliveries,
      active_points: (pData.active_points || 0) + 15,
      updated_at: new Date().toISOString()
    });

    return {
      success: true,
      data: {
        rider_id: authUid,
        total_earnings: newEarnings,
        total_deliveries: newDeliveries
      }
    };
  });
}

// ============================================================================
// Firebase Callable Cloud Functions (v2)
// ============================================================================

export const claimDeliveryMission = onCall<ClaimMissionData>(async (request: CallableRequest<ClaimMissionData>) => {
  return await claimDeliveryMissionHandler(request.data, request.auth?.uid);
});

export const markOrderPickedUp = onCall<MarkPickedUpData>(async (request: CallableRequest<MarkPickedUpData>) => {
  return await markOrderPickedUpHandler(request.data, request.auth?.uid);
});

export const completeDelivery = onCall<CompleteDeliveryData>(async (request: CallableRequest<CompleteDeliveryData>) => {
  return await completeDeliveryHandler(request.data, request.auth?.uid);
});

export const incrementRiderStats = onCall<IncrementRiderStatsData>(async (request: CallableRequest<IncrementRiderStatsData>) => {
  return await incrementRiderStatsHandler(request.data, request.auth?.uid);
});
