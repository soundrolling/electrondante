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
- **Orphaned nodes**: Nodes referencing deleted gear or projects
- **Orphaned gear assignments**: Gear assignments referencing deleted gear or locations
- **Duplicate connections**: Multiple connections with same from/to/input
- **Duplicate port mappings**: Multiple port mappings with same connection/from/to ports
- **Old/unused tables**: Tables from previous signal mapper implementations

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
3. Run queries 15-22 to check related tables
4. Run queries 24-26 to identify old/unused tables
5. Review and backup
6. Run cleanup queries 9-13, 27-32 in order (uncomment as needed)
7. Run query 33 to verify everything is clean

## Current Signal Mapper Tables (Active)

- `nodes` - Signal mapper nodes (sources, transformers, recorders)
- `connections` - Connections between nodes
- `connection_port_map` - Port mappings for transformer/recorder connections

## Related Tables (Checked for Orphaned Data)

- `gear_table` - Gear items referenced by nodes
- `gear_assignments` - Gear assignments to locations
- `projects` - Projects that contain nodes/connections
- `locations` - Locations referenced by gear assignments

## Identifying Old Tables

Queries 24-26 help identify tables that might be from old signal mapper implementations:
- Tables with names like `signal_*`, `mapper_*`, `mic_placement_*`, etc.
- Tables with foreign keys to old signal mapper tables
- Check these tables manually to see if they're still in use

