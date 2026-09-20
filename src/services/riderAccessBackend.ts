import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '../lib/firebase';
import type { UserVehicle } from '../types';

export type RiderVerificationStatus = 'pending' | 'approved' | 'rejected';
export type RiderConnectionStatus = 'pending' | 'approved' | 'rejected';

export interface RiderAccessProfile {
  id: string | number;
  full_name: string;
  phone: string;
  vehicle_type: UserVehicle;
  verification_status: RiderVerificationStatus;
  is_online: boolean;
  status: string;
}

export interface RiderProfileInput {
  full_name: string;
  phone: string;
  vehicle_type: UserVehicle;
}

export interface RiderShopConnection {
  id: string | number;
  status: RiderConnectionStatus;
  created_at: string;
  shop: {
    id: string | number;
    name: string | null;
  };
}

export class RiderAccessError extends Error {
  status: number | null;
  code: string;

  constructor(message: string, status: number | null = null, code = 'RIDER_ACCESS_ERROR') {
    super(message);
    this.name = 'RiderAccessError';
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isId = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';

const isVehicle = (value: unknown): value is UserVehicle =>
  value === 'Road' || value === 'MTB' || value === 'E-Bike' || value === 'Motor';

const isVerificationStatus = (value: unknown): value is RiderVerificationStatus =>
  value === 'pending' || value === 'approved' || value === 'rejected';

const isConnectionStatus = (value: unknown): value is RiderConnectionStatus =>
  value === 'pending' || value === 'approved' || value === 'rejected';

const isProfile = (value: unknown): value is RiderAccessProfile => {
  if (!isRecord(value)) return false;
  return isId(value.id) &&
    typeof value.full_name === 'string' &&
    typeof value.phone === 'string' &&
    isVehicle(value.vehicle_type) &&
    isVerificationStatus(value.verification_status) &&
    typeof value.is_online === 'boolean' &&
    typeof value.status === 'string';
};

const isConnection = (value: unknown): value is RiderShopConnection => {
  if (!isRecord(value) || !isRecord(value.shop)) return false;
  return isId(value.id) &&
    isConnectionStatus(value.status) &&
    typeof value.created_at === 'string' &&
    !Number.isNaN(Date.parse(value.created_at)) &&
    isId(value.shop.id) &&
    (value.shop.name === null || typeof value.shop.name === 'string');
};

const request = async (
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const apiUrl = import.meta.env.VITE_LOCALEATS_API_URL?.replace(/\/+$/, '');
  if (!apiUrl) throw new RiderAccessError('LocalEats Rider API is not configured.', null, 'NOT_CONFIGURED');

  const app = getFirebaseApp();
  const user = app ? getAuth(app).currentUser : null;
  if (!user) throw new RiderAccessError('Sign in to continue.', 401, 'UNAUTHENTICATED');

  let response: Response;
  try {
    const token = await user.getIdToken();
    response = await fetch(`${apiUrl}/api/v1/rider${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer fb-${token}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new RiderAccessError('Unable to reach the LocalEats Rider API.', null, 'UNAVAILABLE');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new RiderAccessError('LocalEats Rider API returned an invalid response.', response.status, 'INVALID_RESPONSE');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new RiderAccessError('LocalEats Rider API returned invalid JSON.', response.status, 'INVALID_RESPONSE');
  }
  if (!isRecord(payload)) {
    throw new RiderAccessError('LocalEats Rider API returned an invalid response.', response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok || payload.success !== true) {
    const errorPayload = isRecord(payload.error) ? payload.error : null;
    throw new RiderAccessError(
      typeof payload.error === 'string'
        ? payload.error
        : typeof errorPayload?.message === 'string'
          ? errorPayload.message
          : 'Rider request failed.',
      response.status,
      typeof payload.code === 'string'
        ? payload.code
        : typeof errorPayload?.code === 'string'
          ? errorPayload.code
          : 'REQUEST_FAILED',
    );
  }
  return payload;
};

export const getRiderProfile = async (): Promise<RiderAccessProfile> => {
  const payload = await request('/profile', 'GET');
  if (!isProfile(payload.profile)) {
    throw new RiderAccessError('LocalEats Rider API returned an invalid profile.', null, 'INVALID_RESPONSE');
  }
  return payload.profile;
};

export const saveRiderProfile = async (input: RiderProfileInput): Promise<RiderAccessProfile> => {
  const payload = await request('/profile', 'POST', {
    full_name: input.full_name,
    phone: input.phone,
    vehicle_type: input.vehicle_type,
  });
  if (!isProfile(payload.profile)) {
    throw new RiderAccessError('LocalEats Rider API did not confirm the profile.', null, 'INVALID_RESPONSE');
  }
  return payload.profile;
};

export const setRiderAvailability = async (isOnline: boolean): Promise<RiderAccessProfile> => {
  const payload = await request('/availability', 'PATCH', { is_online: isOnline });
  if (!isProfile(payload.profile) || payload.profile.is_online !== isOnline) {
    throw new RiderAccessError('LocalEats Rider API did not confirm availability.', null, 'INVALID_RESPONSE');
  }
  return payload.profile;
};

export const getRiderConnections = async (): Promise<RiderShopConnection[]> => {
  const payload = await request('/connections', 'GET');
  if (!Array.isArray(payload.connections) || !payload.connections.every(isConnection)) {
    throw new RiderAccessError('LocalEats Rider API returned invalid shop connections.', null, 'INVALID_RESPONSE');
  }
  return payload.connections;
};

export const requestRiderConnection = async (connectionCode: string): Promise<RiderShopConnection> => {
  const normalizedConnectionCode = connectionCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalizedConnectionCode)) {
    throw new RiderAccessError('Enter the 6-character code from the merchant.', 422, 'INVALID_CONNECTION_CODE');
  }
  const payload = await request('/connections/request', 'POST', { connection_code: normalizedConnectionCode });
  if (!isConnection(payload.connection)) {
    throw new RiderAccessError('LocalEats Rider API did not confirm the connection request.', null, 'INVALID_RESPONSE');
  }
  return payload.connection;
};
