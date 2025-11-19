# Database Verification Instructions

This application requires a Supabase database with specific tables.

## 1. Log in to Supabase
Go to your Supabase project dashboard: https://supabase.com/dashboard

## 2. Open SQL Editor
Click on the "SQL Editor" icon in the left sidebar.

## 3. Run Migration Script
Copy the content of `supabase-migration.sql` from this repository and paste it into the SQL Editor.
Click "Run" to execute the script.

## 4. Verify Tables
Go to the "Table Editor" (left sidebar) and ensure the following tables exist:
- `audio_rooms`
- `room_participants`
- `room_analytics`
- `audit_log`

## 5. Verify RLS Policies
Check that Row Level Security (RLS) is enabled for all tables (you should see a "RLS" badge next to the table names).

---

# Railway Environment Variables

Ensure the following variables are set in your Railway project settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Application port (auto-set by Railway) | `3000` |
| `SUPABASE_URL` | Your Supabase Project URL | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key (for admin access) | `eyJ...` |
| `JWT_SECRET` | Secret for signing tokens (can be same as Supabase JWT secret) | `super-secret-string` |
| `NODE_ENV` | Environment | `production` |

