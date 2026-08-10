-- Create a dedicated table for order messages (Rider <-> Customer chat)
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

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

-- Enable Row Level Security
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read messages for now (or restrict by order_id)
CREATE POLICY "Allow public read access to order_messages"
  ON public.order_messages FOR SELECT
  USING (true);

-- Allow anyone to insert messages
CREATE POLICY "Allow public insert access to order_messages"
  ON public.order_messages FOR INSERT
  WITH CHECK (true);
