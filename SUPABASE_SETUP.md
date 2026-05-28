# Supabase Setup Guide for Watch Together

This guide explains how to set up Supabase for the Watch Together application.

## Prerequisites

1. A Supabase account (https://supabase.com)
2. Node.js >= 18
3. npm or yarn

## Setup Steps

### 1. Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in the project details:
   - Name: watch-together (or similar)
   - Database password: (choose a strong password)
   - Region: Select closest to your users
4. Click "Create new project"

### 2. Get Your Supabase Credentials

1. In your Supabase project dashboard, go to Settings > API
2. You'll see:
   - Project URL
   - anon public key
3. Copy these values

### 3. Configure Environment Variables

Create a `.env.local` file in the `server` directory with:

```
PORT=3001
NODE_ENV=development
WS_ORIGIN=http://localhost:3000

# Supabase Configuration (REQUIRED)
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_public_key_here

# Future Cloudflare Integration
CLOUDFLARE_TUNNEL_TOKEN=
CLOUDFLARE_ACCOUNT_ID=

# Worker Configuration
ENABLE_LOCAL_WORKERS=true
WORKERS_QUEUE_TYPE=local
```

Replace `your_project_url_here` and `your_anon_public_key_here` with your actual Supabase values.

### 4. Run the Database Migration

The Supabase migration SQL is located at:
`supabase/migrations/20260528_initial_schema.sql`

You can run this migration in two ways:

#### Option A: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Click "New Query"
4. Copy and paste the contents of `supabase/migrations/20260528_initial_schema.sql`
5. Click "RUN"

#### Option B: Using Supabase CLI
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link your project: `supabase link --project-ref YOUR_PROJECT_REF`
4. Start the migration: `supabase db push`

### 5. Test the Connection

Start your development server:
```bash
# In the project root
npm run dev
```

You should see in the logs:
```
[SUPABASE] Database connected successfully
```

If you see:
```
[SUPABASE] Database connection failed or not configured
```

Check your `.env.local` file and make sure the Supabase credentials are correct.

## Database Schema Overview

### Tables

1. **rooms**
   - Stores persistent room metadata
   - Fields: id, created_at, video_url, status, host_id, max_users, inactive_timeout, last_activity

2. **room_users**
   - Tracks users in each room
   - Fields: id, room_id, user_id, socket_id, is_host, joined_at, last_seen
   - Note: user_id currently stores raw UUIDs; in a future version with authentication, this would link to a proper users table

3. **room_sessions**
   - Stores playback state for rooms
   - Fields: id, room_id, is_playing, current_time, last_updated_at, updated_by

### Indexes
- Indexes on foreign keys for better join performance
- Indexes on status and last_activity for efficient querying

## How the Application Uses Supabase

### Room Lifecycle
1. When a room is created, a record is inserted into the `rooms` table
2. When users join/leave, records are inserted/updated/deleted from `room_users`
3. When playback state changes, the `room_sessions` table is updated
4. A background process periodically cleans up inactive rooms (based on `inactive_timeout`)

### Real-time Synchronization
Note: While Supabase provides real-time capabilities, this application uses Socket.IO for low-latency synchronization between clients. Supabase is used for:
- Persistence (recovering room state after server restarts)
- Enabling room state recovery when users reconnect
- Providing a foundation for future features like chat, history, etc.

## Security Considerations

For MVP1, we're using the Supabase anon key which allows read/write access to the database. In a production application with user authentication, you would:

1. Enable Row Level Security (RLS) on all tables
2. Create policies that restrict access based on user authentication
3. Use the service_role key for backend operations that require elevated privileges
4. Only expose the anon key to the frontend for public, read-only operations

## Troubleshooting

### Connection Issues
- Double-check your SUPABASE_URL and SUPABASE_ANON_KEY values
- Ensure your Supabase project is active (not paused)
- Verify that the database schema has been applied correctly

### Permission Errors
- If you see permission errors, make sure the migration was applied successfully
- For MVP1 with anon key, all tables should be accessible for read/write operations

### Performance Issues
- Ensure database indexes are present (they're created in the migration)
- Monitor query performance in the Supabase dashboard