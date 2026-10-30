-- ==============================================================================
-- Roséia — Supabase Database Migration
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Add available_dates and tags to the existing 'creators' table if not present
ALTER TABLE IF EXISTS public.creators 
ADD COLUMN IF NOT EXISTS available_dates JSONB DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.creators 
ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT 'Coffee & Conversation, Fine Dining';

-- 2. Create the 'bookings' table to persist date reservations
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    creator_name TEXT,
    booking_date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    user_note TEXT,
    base_price NUMERIC,
    platform_fee NUMERIC,
    tax NUMERIC,
    total_amount NUMERIC,
    payment_id TEXT,
    order_id TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create index for fast booking lookups by creator and date
CREATE INDEX IF NOT EXISTS idx_bookings_creator_date ON public.bookings(creator_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

-- 4. Enable Row Level Security (RLS) and policies (optional, adjust according to project needs)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to bookings" 
ON public.bookings FOR SELECT USING (true);

CREATE POLICY "Allow authenticated or backend insert to bookings" 
ON public.bookings FOR INSERT WITH CHECK (true);
