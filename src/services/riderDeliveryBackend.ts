import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { getFirebaseApp } from '../lib/firebase';

export interface BackendResponse<T = unknown> {
  success: boolean;
  data?: T;
  order_id?: string;
  delivery_status?: string;
  earnings_awarded?: number;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ClaimMissionParams {
  order_id: string;
  rider_id?: string;
  p_rider_name?: string;
  p_rider_phone?: string;
}

export interface MarkPickedUpParams {
  order_id: string;
  rider_id?: string;
}

export interface CompleteDeliveryParams {
  order_id: string;
  delivery_pin?: string;
  rider_id?: string;
}

export interface IncrementRiderStatsParams {
  order_id?: string;
  rider_id?: string;
}

function parseFirebaseError(err: unknown): { code: string; message: string; details?: unknown } {
  if (err && typeof err === 'object') {
    const errorObj = err as Record<string, unknown>;
    const code = typeof errorObj.code === 'string' ? errorObj.code : 'UNKNOWN';
    const message = typeof errorObj.message === 'string' ? errorObj.message : 'Unknown server error';
    const details = errorObj.details;
    return { code, message, details };
  }
  return {
    code: 'UNKNOWN',
    message: err instanceof Error ? err.message : 'Unknown server error'
  };
}

/**
 * 1. claimDeliveryMission (Callable Cloud Function Client)
 * Invokes trusted server-side Cloud Function to claim mission atomically.
 * Does NOT trust client-provided rider metadata or financial fields.
 * Direct Firestore write fallback is strictly removed.
 */
export async function claimDeliveryMission(
  params: ClaimMissionParams
): Promise<BackendResponse<{ order_id: string; delivery_status: string }>> {
  try {
    const orderId = params.order_id;
    if (!orderId) {
      return {
        success: false,
        error: { code: 'INVALID_ARGUMENT', message: 'Missing order_id' }
      };
    }

    const app = getFirebaseApp();
    if (!app) {
      return {
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Firebase service is not initialized' }
      };
    }

    const functions = getFunctions(app);
    const claimFn = httpsCallable<{ order_id: string }, { success: boolean; order_id: string; delivery_status: string }>(
      functions,
      'claimDeliveryMission'
    );

    // Call server with only trusted parameters (order_id)
    const result: HttpsCallableResult<{ success: boolean; order_id: string; delivery_status: string }> = await claimFn({
      order_id: orderId
    });

    return {
      success: true,
      data: result.data
    };
  } catch (err: unknown) {
    const parsed = parseFirebaseError(err);
    console.error('Server callable claimDeliveryMission failed:', parsed);
    return {
      success: false,
      error: parsed
    };
  }
}

/**
 * 2. markOrderPickedUp (Callable Cloud Function Client)
 * Invokes trusted server-side Cloud Function to advance order state to "picked_up".
 * Direct Firestore write fallback is strictly removed.
 */
export async function markOrderPickedUp(
  params: MarkPickedUpParams
): Promise<BackendResponse<{ order_id: string; delivery_status: string }>> {
  try {
    const orderId = params.order_id;
    if (!orderId) {
      return {
        success: false,
        error: { code: 'INVALID_ARGUMENT', message: 'Missing order_id' }
      };
    }

    const app = getFirebaseApp();
    if (!app) {
      return {
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Firebase service is not initialized' }
      };
    }

    const functions = getFunctions(app);
    const pickupFn = httpsCallable<{ order_id: string }, { success: boolean; order_id: string; delivery_status: string }>(
      functions,
      'markOrderPickedUp'
    );

    const result = await pickupFn({
      order_id: orderId
    });

    return {
      success: true,
      data: result.data
    };
  } catch (err: unknown) {
    const parsed = parseFirebaseError(err);
    console.error('Server callable markOrderPickedUp failed:', parsed);
    return {
      success: false,
      error: parsed
    };
  }
}

/**
 * 3. completeDelivery (Callable Cloud Function Client)
 * Invokes trusted server-side Cloud Function to complete delivery, verify PIN, and award earnings.
 * Direct Firestore write fallback is strictly removed.
 */
export async function completeDelivery(
  params: CompleteDeliveryParams
): Promise<BackendResponse<{ order_id: string; delivery_status: string; earnings_awarded: number }>> {
  try {
    const orderId = params.order_id;
    if (!orderId) {
      return {
        success: false,
        error: { code: 'INVALID_ARGUMENT', message: 'Missing order_id' }
      };
    }

    const app = getFirebaseApp();
    if (!app) {
      return {
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Firebase service is not initialized' }
      };
    }

    const functions = getFunctions(app);
    const completeFn = httpsCallable<
      { order_id: string; delivery_pin?: string },
      { success: boolean; order_id: string; delivery_status: string; earnings_awarded: number }
    >(functions, 'completeDelivery');

    const result = await completeFn({
      order_id: orderId,
      delivery_pin: params.delivery_pin
    });

    return {
      success: true,
      data: result.data
    };
  } catch (err: unknown) {
    const parsed = parseFirebaseError(err);
    console.error('Server callable completeDelivery failed:', parsed);
    return {
      success: false,
      error: parsed
    };
  }
}

/**
 * 4. incrementRiderStats (Callable Cloud Function Client)
 * Invokes trusted server-side Cloud Function to increment stats based on authoritative DB records.
 */
export async function incrementRiderStats(
  params: IncrementRiderStatsParams
): Promise<BackendResponse<{ rider_id: string; total_earnings: number; total_deliveries: number }>> {
  try {
    if (!params.order_id) {
      return {
        success: false,
        error: { code: 'INVALID_ARGUMENT', message: 'order_id is required' }
      };
    }

    const app = getFirebaseApp();
    if (!app) {
      return {
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Firebase service is not initialized' }
      };
    }

    const functions = getFunctions(app);
    const statsFn = httpsCallable<{ order_id: string }, { success: boolean; data: { rider_id: string; total_earnings: number; total_deliveries: number } }>(
      functions,
      'incrementRiderStats'
    );

    const result = await statsFn({
      order_id: params.order_id
    });

    return {
      success: true,
      data: result.data.data
    };
  } catch (err: unknown) {
    const parsed = parseFirebaseError(err);
    console.error('Server callable incrementRiderStats failed:', parsed);
    return {
      success: false,
      error: parsed
    };
  }
}
