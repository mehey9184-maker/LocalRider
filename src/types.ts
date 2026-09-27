export type UserVehicle = 'Road' | 'MTB' | 'E-Bike' | 'Motor';
export type RiderVerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface RiderProfile {
  id: string; // LocalEats server Rider profile ID; Firebase UID is separate identity linkage.
  name: string;
  full_name?: string;
  phone?: string;
  photo_url?: string;
  is_online: boolean;
  status: string; // added this
  vehicle_type: UserVehicle;
  verification_status: RiderVerificationStatus;
  rating?: number;
  total_earnings?: number;
  total_deliveries?: number;
  active_points?: number;
  updated_at?: string;
  current_latitude?: number;
  current_longitude?: number;
  onboarding_complete?: boolean;
  experience_level?: 'cadet' | 'operator' | 'commander';
}

export interface ShopConnection {
  id: string | number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  shop: {
    id: string | number;
    name: string | null;
  };
}

export type DeliveryStatus = 'finding_rider' | 'rider_assigned' | 'picked_up' | 'delivering' | 'delivered' | 'cancelled' | 'none';

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
  shop_updated_at?: string; // Merchant last active heartbeat
  distance_km: number; // Mocked/calculated
  lat?: number; // Destination Latitude
  lng?: number; // Destination Longitude
  shop_lat?: number; // Source Latitude
  shop_lng?: number; // Source Longitude
  match_score?: number; // Tactical algorithm score
  surge_multiplier?: number; // ROI Multiplier
  batch_id?: string; // Grouping missions
  delivery_pin?: string; // 4-digit PIN for drop-off
  dropoff_photo_ref?: string; // Proof of delivery
  items?: Array<string | { name?: string; quantity?: number; price?: number; [key: string]: unknown }>; // Optional list of items in the order
  merchant_rating?: number;
  merchant_feedback?: string;
  payment_method?: 'cash_on_arrival' | 'card_online';
  payment_collected?: boolean;
  rider_name?: string;
  rider_phone?: string;
  allow_external_riders?: boolean;
  cash_trust_enabled?: boolean;
  auto_look_for_rider?: boolean;
  dispatch_to_marketplace?: boolean;
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

export interface WeatherForecastHour {
  time: string;
  temp: number;
}

export interface WeatherData {
  temp: number;
  feelsLike: number;
  precipitation: number;
  windSpeed: number;
  code: number;
  timestamp: number;
  hourlyForecast: WeatherForecastHour[];
}

export type AppView = 'dash' | 'feed' | 'move' | 'log' | 'hub' | 'pair' | 'tracking' | 'merchant';

export interface OrderChatMessage {
  id: string;
  order_id: string;
  sender_role: 'rider' | 'customer' | 'merchant' | 'system';
  sender_id: string;
  sender_name?: string;
  message: string;
  created_at: string;
  is_quick_reply?: boolean;
  is_read?: boolean;
  is_delivered?: boolean;
}

