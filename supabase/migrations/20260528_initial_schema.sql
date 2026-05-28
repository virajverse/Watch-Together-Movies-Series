-- Supabase Migration: Initial Schema for Watch Together
-- This script creates the necessary tables for room management, users, and playback state

-- Rooms table - stores persistent room metadata
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  video_url TEXT,
  status VARCHAR(20) DEFAULT 'waiting',
  host_id TEXT,
  max_users INTEGER DEFAULT 50,
  inactive_timeout INTEGER DEFAULT 30,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room users table - tracks users in each room
CREATE TABLE IF NOT EXISTS room_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  socket_id TEXT,
  is_host BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Room sessions table - stores playback state
CREATE TABLE IF NOT EXISTS room_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  is_playing BOOLEAN DEFAULT FALSE,
  playback_time DOUBLE PRECISION DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(room_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_users_room_id ON room_users(room_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_room_id ON room_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms(last_activity);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations (backend uses service_role key which bypasses RLS)
CREATE POLICY "Allow all for authenticated" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON room_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON room_sessions FOR ALL USING (true) WITH CHECK (true);
