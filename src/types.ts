export type UserVehicle = 'Road' | 'MTB' | 'E-Bike' | 'Motor';

export interface RiderProfile {
  id: string; // matches auth.uid
  name: string;
  full_name?: string;
  phone?: string;
  photo_url?: string;
  is_online: boolean;
  vehicle_type: UserVehicle;
  verification_status: 'pending' | 'verified' | 'rejected';
  rating: number;
  total_earnings: number;
  total_deliveries: number;
  active_points: number;
  updated_at: string;
  current_latitude?: number;
  current_longitude?: number;
  onboarding_complete?: boolean;
  experience_level?: 'cadet' | 'operator' | 'commander';
}

export interface ShopConnection {
  id: string;
  rider_id: string;
  shop_id: string;
  expires_at: string;
  created_at: string;
  shop_name?: string;
  connection_code?: string;
}

export type DeliveryStatus = 'finding_rider' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';

export interface DeliveryOrder {
  id: string;
  product_name: string;
  total_price: number;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  delivery_fee: number;
  delivery_status: DeliveryStatus;
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  order_type: 'delivery' | 'collection';
  rider_id?: string | null;
  shop_id: string;
  restaurant_name?: string; // Virtual field joined from shops table
  distance_km: number; // Mocked/calculated
  match_score?: number; // Tactical algorithm score
  surge_multiplier?: number; // ROI Multiplier
  batch_id?: string; // Grouping missions
  dropoff_photo_ref?: string; // Proof of delivery
  items?: string[]; // Optional list of items in the order
  merchant_rating?: number;
  merchant_feedback?: string;
  created_at: string;
  updated_at: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  RPC = 'rpc'
}
