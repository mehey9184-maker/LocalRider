-- 1. Fix the permission denied error on the is_shop_owner function
GRANT EXECUTE ON FUNCTION public.is_shop_owner TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_owner TO anon;

-- 2. Allow riders to insert into chat_messages
-- (Assuming your chat_messages table has an order_id and sender_type)
CREATE POLICY "Allow riders to insert chat messages"
ON public.chat_messages
FOR INSERT
TO public
WITH CHECK (
  sender_type = 'rider'
);

-- 3. Allow riders to read chat messages for their orders
CREATE POLICY "Allow riders to read chat messages"
ON public.chat_messages
FOR SELECT
TO public
USING (
  true -- Or you can restrict to specific order_ids if needed
);

-- 4. Just in case, create the fallback order_messages table
CREATE TABLE IF NOT EXISTS public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  sender_role TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  is_delivered BOOLEAN DEFAULT true
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to order_messages"
  ON public.order_messages FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to order_messages"
  ON public.order_messages FOR INSERT WITH CHECK (true);
