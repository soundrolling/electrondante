# Supabase Database Setup Guide

## Overview

This guide explains how to set up the Supabase database tables for the multi-room audio system.

## Prerequisites

1. A Supabase project (create one at https://supabase.com)
2. Access to the Supabase SQL Editor

## Setup Steps

### 1. Run the Migration

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase-migration.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

### 2. Verify Tables Created

After running the migration, verify the tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('audio_rooms', 'room_participants', 'room_analytics', 'audit_log');
```

You should see all 4 tables listed.

### 3. Verify Indexes

Check that indexes were created:

```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('audio_rooms', 'room_participants', 'room_analytics', 'audit_log')
ORDER BY tablename, indexname;
```

### 4. Test Row Level Security

Verify RLS is enabled:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('audio_rooms', 'room_participants', 'room_analytics', 'audit_log');
```

All should show `rowsecurity = true`.

## Tables Created

### `audio_rooms`
Stores room information with codes, passwords, and metadata.

### `room_participants`
Tracks who joined which rooms and connection duration.

### `room_analytics`
Daily aggregated analytics per room.

### `audit_log`
Security audit trail for authentication and room access events.

## Row Level Security (RLS)

RLS policies are configured to:
- Allow users to see/manage their own rooms
- Allow users to join rooms
- Allow service role full access (for server-side operations)

## Usage Notes

The current server implementation uses in-memory room storage. Database persistence can be added as an enhancement to:
- Persist rooms across server restarts
- Track long-term analytics
- Maintain audit logs
- Support room discovery features

