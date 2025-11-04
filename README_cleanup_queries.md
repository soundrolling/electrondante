# Database Cleanup Queries for Signal Mapper

This file contains SQL queries to identify and clean up orphaned connections and port mappings that can cause issues with auto-adding connections and scrambled port maps.

## How to Use

1. **First, run the diagnostic queries** (queries 1-8) to see what issues exist
2. **Review the results** to understand what data needs to be cleaned
3. **Backup your database** before running any cleanup queries
4. **Run cleanup queries** (queries 9-13) one at a time, reviewing results after each
5. **Verify** with query 14 that everything is clean

## Running in Supabase

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the queries one at a time
4. Review results before running DELETE queries

## Common Issues Found

- **Orphaned connections**: Connections referencing nodes that were deleted
- **Orphaned port mappings**: Port mappings referencing deleted connections
- **Duplicate connections**: Multiple connections with same from/to/input
- **Duplicate port mappings**: Multiple port mappings with same connection/from/to ports

## Safe Queries (Read-only)

Queries 1-8 are diagnostic only and safe to run - they won't modify any data.

## Cleanup Queries (DELETE operations)

Queries 9-13 are commented out with `-- DELETE` statements. Uncomment them only after:
- Running diagnostic queries
- Reviewing the results
- Backing up your database
- Understanding what will be deleted

## Recommended Order

1. Run query 8 (summary) to get an overview
2. Run queries 1-7 to see detailed issues
3. Review and backup
4. Run cleanup queries 9-13 in order
5. Run query 14 to verify

