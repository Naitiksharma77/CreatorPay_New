-- Takora Subscription Platform Migration (Non-destructive & Idempotent)
-- Run in Supabase SQL Editor to enable Postgres persistence for users, subscriptions, payments, and webhooks.

-- 1. Users table (Free registration, no payment required)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  has_access BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  razorpay_customer_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely ensure columns exist if users table already existed
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Centralized Monthly Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT DEFAULT '',
  plan_code TEXT NOT NULL CHECK (plan_code IN ('basic', 'pro', 'premium')),
  plan_name TEXT NOT NULL,
  amount_inr INTEGER NOT NULL,
  razorpay_plan_id TEXT DEFAULT '',
  razorpay_subscription_id TEXT UNIQUE NOT NULL,
  razorpay_customer_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'created',
  payment_verification_status TEXT NOT NULL DEFAULT 'pending',
  has_access BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  current_start TIMESTAMPTZ,
  current_end TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  paid_count INTEGER DEFAULT 0,
  short_url TEXT DEFAULT '',
  superseded_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 3. Subscription Payment & Renewal Ledger
CREATE TABLE IF NOT EXISTS subscription_payments (
  id TEXT PRIMARY KEY,
  subscription_id TEXT DEFAULT '',
  razorpay_subscription_id TEXT DEFAULT '',
  user_id TEXT NOT NULL,
  user_email TEXT DEFAULT '',
  plan_code TEXT NOT NULL,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT DEFAULT '',
  amount_inr INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL,
  method TEXT DEFAULT '',
  error_reason TEXT DEFAULT '',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_user_id ON subscription_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON subscription_payments(status);

-- 4. Webhook Event Idempotency Store
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  subscription_id TEXT DEFAULT '',
  payment_id TEXT DEFAULT '',
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Interaction Sessions Audit Log (Chat / Voice / Video entitlements)
CREATE TABLE IF NOT EXISTS interaction_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  creator_name TEXT DEFAULT '',
  interaction_type TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Idempotent Razorpay Monthly Plans Registry (Basic / Pro / Premium)
CREATE TABLE IF NOT EXISTS razorpay_plans (
  plan_key TEXT PRIMARY KEY,
  razorpay_plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  interval_count INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely ensure extra subscription columns exist
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS superseded_subscription_id TEXT DEFAULT '';

-- 7. Extend messages table with optional user_id if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT '';
  END IF;
END $$;
