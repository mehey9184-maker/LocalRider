-- 1. Enable Geography support
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Update Rider Profiles with new columns
ALTER TABLE rider_profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline',
ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Road',
ADD COLUMN IF NOT EXISTS current_location geography(POINT, 4326),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Create Notification Table for Nudges
CREATE TABLE IF NOT EXISTS rider_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES rider_profiles(id) ON DELETE CASCADE,
  shop_id BIGINT REFERENCES shops(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'nudge', 
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable Realtime & Security
ALTER TABLE rider_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Secure Nudge Function (Used by Merchant App)
CREATE OR REPLACE FUNCTION nudge_rider(rider_id UUID, message TEXT)
RETURNS VOID AS $$
DECLARE
    merchant_shop_id BIGINT;
BEGIN
    SELECT id INTO merchant_shop_id FROM shops WHERE owner_id::text = auth.uid()::text LIMIT 1;
    INSERT INTO rider_notifications (rider_id, shop_id, message, type)
    VALUES (rider_id, merchant_shop_id, message, 'nudge');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
