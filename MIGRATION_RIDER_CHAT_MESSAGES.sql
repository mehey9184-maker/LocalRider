-- Create a dedicated table for rider-customer chat messages
CREATE TABLE IF NOT EXISTS public.rider_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT,
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  is_delivered BOOLEAN DEFAULT true
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_chat_messages;

-- Enable Row Level Security
ALTER TABLE public.rider_chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow public read access to rider_chat_messages
CREATE POLICY "Allow public read access to rider_chat_messages"
  ON public.rider_chat_messages FOR SELECT USING (true);

-- Allow public insert access to rider_chat_messages
CREATE POLICY "Allow public insert access to rider_chat_messages"
  ON public.rider_chat_messages FOR INSERT WITH CHECK (true);
