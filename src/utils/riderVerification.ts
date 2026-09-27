import type { RiderVerificationStatus } from '../types';

export interface RiderVerificationView {
  title: string;
  message: string;
}

export const isRiderVerificationStatus = (value: unknown): value is RiderVerificationStatus =>
  value === 'pending' || value === 'approved' || value === 'rejected' || value === 'suspended';

export const canToggleRiderAvailability = (verificationStatus: unknown, isOnline: boolean): boolean =>
  isOnline || verificationStatus === 'approved';

export const getRiderVerificationView = (verificationStatus: unknown): RiderVerificationView => {
  switch (verificationStatus) {
    case 'pending':
      return {
        title: 'Verification pending',
        message: 'Your Rider account is awaiting LocalEats verification. You can go online after approval.',
      };
    case 'rejected':
      return {
        title: 'Verification rejected',
        message: 'Your Rider verification was not approved. Contact LocalEats support if you believe this needs review.',
      };
    case 'suspended':
      return {
        title: 'Account suspended',
        message: 'Your Rider account is suspended and cannot receive new delivery work.',
      };
    case 'approved':
      return {
        title: 'Platform verified',
        message: 'You may go online. Rider Pool dispatch is being enabled; connected-shop deliveries remain available where supported.',
      };
    default:
      return {
        title: 'Verification unavailable',
        message: 'Your verification state could not be confirmed. Stay offline and refresh your profile or contact LocalEats support.',
      };
  }
};
