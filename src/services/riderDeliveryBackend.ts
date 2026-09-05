import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "../lib/firebase";

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

const apiError = (code: string, message: string): BackendResponse<never> => ({
  success: false,
  error: { code, message },
});

const callRiderOrderApi = async (
  orderId: string,
  action: "claim" | "picked-up" | "delivering" | "delivered",
  body?: Record<string, unknown>,
): Promise<BackendResponse<Record<string, unknown>>> => {
  if (!orderId) return apiError("INVALID_ARGUMENT", "Missing order_id");

  const apiUrl = import.meta.env.VITE_LOCALEATS_API_URL?.replace(/\/$/, "");
  if (!apiUrl) {
    return apiError("UNAVAILABLE", "LocalEats rider service is not configured.");
  }

  const app = getFirebaseApp();
  const user = app ? getAuth(app).currentUser : null;
  if (!user) return apiError("UNAUTHENTICATED", "Sign in before changing a delivery.");

  try {
    const token = await user.getIdToken();
    const response = await fetch(
      `${apiUrl}/api/v1/rider/orders/${encodeURIComponent(orderId)}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer fb-${token}`,
        },
        body: JSON.stringify(body ?? {}),
      },
    );
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return apiError("INVALID_RESPONSE", "LocalEats rider service returned an invalid response.");
    }
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return apiError("INVALID_RESPONSE", "LocalEats rider service returned an invalid response.");
    }
    const data = payload as Record<string, unknown>;
    if (!response.ok || data.success !== true) {
      return apiError(
        typeof data.code === "string" ? data.code : "REQUEST_FAILED",
        typeof data.error === "string" ? data.error : "Delivery action failed.",
      );
    }
    if (!data.order || typeof data.order !== "object" || Array.isArray(data.order)) {
      return apiError("INVALID_RESPONSE", "The database did not confirm the delivery change.");
    }
    return { success: true, data: data.order as Record<string, unknown> };
  } catch (error) {
    return apiError(
      "UNAVAILABLE",
      error instanceof Error ? error.message : "LocalEats rider service is unavailable.",
    );
  }
};

const getRiderOrderApi = async (
  path: string,
  responseKey: "order" | "orders",
): Promise<BackendResponse<Record<string, unknown> | Record<string, unknown>[]>> => {
  const apiUrl = import.meta.env.VITE_LOCALEATS_API_URL?.replace(/\/$/, "");
  if (!apiUrl) return apiError("UNAVAILABLE", "LocalEats rider service is not configured.");
  const app = getFirebaseApp();
  const user = app ? getAuth(app).currentUser : null;
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to load deliveries.");
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${apiUrl}/api/v1/rider/orders/${path}`, {
      headers: { Authorization: `Bearer fb-${token}` },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return apiError("INVALID_RESPONSE", "LocalEats rider service returned an invalid response.");
    }
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return apiError("INVALID_RESPONSE", "LocalEats rider service returned an invalid response.");
    }
    const data = payload as Record<string, unknown>;
    const value = data[responseKey];
    const validValue = responseKey === "orders"
      ? Array.isArray(value)
      : Boolean(value && typeof value === "object" && !Array.isArray(value));
    if (!response.ok || data.success !== true || !validValue) {
      return apiError(
        typeof data.code === "string" ? data.code : "REQUEST_FAILED",
        typeof data.error === "string" ? data.error : "Deliveries could not be loaded.",
      );
    }
    return { success: true, data: value as Record<string, unknown> | Record<string, unknown>[] };
  } catch (error) {
    return apiError("UNAVAILABLE", error instanceof Error ? error.message : "Deliveries could not be loaded.");
  }
};

export const fetchAvailableDeliveries = async (): Promise<BackendResponse<Record<string, unknown>[]>> => {
  const apiUrl = import.meta.env.VITE_LOCALEATS_API_URL?.replace(/\/$/, "");
  if (!apiUrl) return apiError("UNAVAILABLE", "LocalEats rider service is not configured.");
  const app = getFirebaseApp();
  const user = app ? getAuth(app).currentUser : null;
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to load deliveries.");
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${apiUrl}/api/v1/rider/orders/available`, {
      headers: { Authorization: `Bearer fb-${token}` },
    });
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return apiError("INVALID_RESPONSE", "LocalEats rider service returned an invalid response.");
    }
    const data = payload as Record<string, unknown>;
    if (!response.ok || data.success !== true || !Array.isArray(data.orders)) {
      return apiError(
        typeof data.code === "string" ? data.code : "REQUEST_FAILED",
        typeof data.error === "string" ? data.error : "Deliveries could not be loaded.",
      );
    }
    return { success: true, data: data.orders as Record<string, unknown>[] };
  } catch (error) {
    return apiError("UNAVAILABLE", error instanceof Error ? error.message : "Deliveries could not be loaded.");
  }
};

export const fetchRiderDeliveries = async (
  scope: "active" | "history",
): Promise<BackendResponse<Record<string, unknown>[]>> => {
  const result = await getRiderOrderApi(`mine?scope=${scope}`, "orders");
  return result as BackendResponse<Record<string, unknown>[]>;
};

export const fetchRiderDelivery = async (
  orderId: string,
): Promise<BackendResponse<Record<string, unknown>>> => {
  if (!orderId) return apiError("INVALID_ARGUMENT", "Missing order_id");
  const result = await getRiderOrderApi(encodeURIComponent(orderId), "order");
  return result as BackendResponse<Record<string, unknown>>;
};

export const claimDeliveryMission = async (
  params: ClaimMissionParams,
): Promise<BackendResponse<{ order_id: string; delivery_status: string; order: Record<string, unknown> }>> => {
  const result = await callRiderOrderApi(params.order_id, "claim");
  if (!result.success || !result.data) return result as BackendResponse<never>;
  return {
    success: true,
    data: {
      order_id: String(result.data.id),
      delivery_status: String(result.data.delivery_status),
      order: result.data,
    },
  };
};

export const markOrderPickedUp = async (
  params: MarkPickedUpParams,
): Promise<BackendResponse<{ order_id: string; delivery_status: string; order: Record<string, unknown> }>> => {
  const result = await callRiderOrderApi(params.order_id, "picked-up");
  if (!result.success || !result.data) return result as BackendResponse<never>;
  return {
    success: true,
    data: {
      order_id: String(result.data.id),
      delivery_status: String(result.data.delivery_status),
      order: result.data,
    },
  };
};

export const markOrderDelivering = async (
  params: MarkPickedUpParams,
): Promise<BackendResponse<{ order_id: string; delivery_status: string; order: Record<string, unknown> }>> => {
  const result = await callRiderOrderApi(params.order_id, "delivering");
  if (!result.success || !result.data) return result as BackendResponse<never>;
  return {
    success: true,
    data: {
      order_id: String(result.data.id),
      delivery_status: String(result.data.delivery_status),
      order: result.data,
    },
  };
};

export const completeDelivery = async (
  params: CompleteDeliveryParams,
): Promise<BackendResponse<{ order_id: string; delivery_status: string; earnings_awarded: number; order: Record<string, unknown> }>> => {
  const result = await callRiderOrderApi(params.order_id, "delivered", {
    delivery_pin: params.delivery_pin,
  });
  if (!result.success || !result.data) return result as BackendResponse<never>;
  return {
    success: true,
    data: {
      order_id: String(result.data.id),
      delivery_status: String(result.data.delivery_status),
      earnings_awarded: Number(result.data.earnings_awarded ?? 0),
      order: result.data,
    },
  };
};

export const incrementRiderStats = async (
  _params: IncrementRiderStatsParams,
): Promise<BackendResponse<{ rider_id: string; total_earnings: number; total_deliveries: number }>> => {
  void _params;
  return apiError(
    "SERVER_MANAGED",
    "Rider statistics are updated only by authoritative delivery completion.",
  );
};
