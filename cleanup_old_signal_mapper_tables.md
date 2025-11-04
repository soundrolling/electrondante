# Cleanup Plan for Old Signal Mapper Tables

## Tables Identified for Removal

Based on the analysis, these 3 tables are from an old signal mapper implementation:

1. **`signal_connections`** - 9 columns (similar structure to current `connections` table)
2. **`signal_flow_data`** - 6 columns (stores nodes/connections as JSONB)
3. **`signal_mapper_layouts`** - 9 columns (stores UI layout/canvas positions as JSONB)

## Table Structure Analysis

### signal_connections
- **Structure**: Similar to current `connections` table
- **Columns**: `from_node_id`, `to_node_id`, `input_number`, `output_number`, `track_number`, `connection_type`, `notes`
- **Difference**: Uses `character varying` for node IDs (old) vs likely UUID in current implementation
- **Migration**: Data might be migratable if node IDs match, but structure is slightly different

### signal_flow_data
- **Structure**: Stores entire signal flow as JSONB
- **Columns**: `location_id`, `nodes` (jsonb), `connections` (jsonb)
- **Difference**: Old implementation stored everything as JSON vs current structured tables
- **Migration**: Complex - would require parsing JSONB and mapping to `nodes`, `connections`, and `connection_port_map` tables

### signal_mapper_layouts
- **Structure**: Stores UI layout/canvas configuration
- **Columns**: `elements` (jsonb), `canvas_width`, `canvas_height`, `created_email`
- **Difference**: This appears to be UI state/layout data, not core signal flow data
- **Migration**: Probably not needed - UI layouts are typically user-specific and can be regenerated

## Current Signal Mapper Tables (Active)

The current implementation uses:
- `nodes` - Signal mapper nodes
- `connections` - Connections between nodes
- `connection_port_map` - Port mappings for connections

## Verification Steps

### Step 1: Check if tables have data
Run Query 10 from `find_unused_tables.sql`:
```sql
SELECT 'signal_connections' as table_name, COUNT(*) as row_count FROM signal_connections
UNION ALL
SELECT 'signal_flow_data' as table_name, COUNT(*) as row_count FROM signal_flow_data
UNION ALL
SELECT 'signal_mapper_layouts' as table_name, COUNT(*) as row_count FROM signal_mapper_layouts;
```

**If row_count > 0:**
- Check if data needs to be migrated to new tables
- Review the data structure (Query 12) to understand what was stored
- Consider if any historical data is needed

**If row_count = 0:**
- Tables are empty and safe to remove

### Step 2: Check for foreign key references
Run Query 11 from `find_unused_tables.sql`:
```sql
SELECT 
    tc.table_name as referencing_table,
    kcu.column_name as referencing_column,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('signal_connections', 'signal_flow_data', 'signal_mapper_layouts')
ORDER BY ccu.table_name, tc.table_name;
```

**If results are empty:**
- No other tables reference these - safe to delete

**If results exist:**
- You'll need to handle those foreign key relationships first
- Either drop the foreign keys or delete the referencing rows

### Step 3: Understand table structure (optional)
Run Query 12 to see what columns these tables have:
```sql
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('signal_connections', 'signal_flow_data', 'signal_mapper_layouts')
ORDER BY table_name, ordinal_position;
```

This helps understand if any data migration might be needed.

## Deletion Process

### Safe Deletion (if tables are empty and have no references)

1. **Backup your database first!**

2. Run the deletion queries one at a time (Query 14):
```sql
-- Delete in order (if any foreign keys exist, this order matters)
DROP TABLE IF EXISTS signal_connections CASCADE;
DROP TABLE IF EXISTS signal_flow_data CASCADE;
DROP TABLE IF EXISTS signal_mapper_layouts CASCADE;
```

The `CASCADE` option will automatically drop any dependent objects (foreign keys, views, etc.).

### If Tables Have Data

**If `signal_flow_data` has data:**
- This stores the entire signal flow as JSONB
- Migration would require parsing JSONB and creating structured records
- **Recommendation**: If data is old/unused, export as backup and delete. If recent, consider migration script.

**If `signal_connections` has data:**
- Data structure is similar to current `connections` table
- **Check first**: Run Query 10 to see row count
- **If migration needed**: Node IDs might need conversion (character varying → UUID)
- **Migration complexity**: Medium - requires ID mapping

**If `signal_mapper_layouts` has data:**
- This is UI layout data (canvas positions, zoom levels, etc.)
- **Recommendation**: Typically safe to delete - layouts are user-specific and can be regenerated
- **Exception**: Only keep if you need to preserve specific user layouts

### Migration Decision Guide

**Safe to delete (recommended) if:**
- All tables have 0 rows OR
- Data is from old/unused implementations OR
- Current signal mapper is working and users don't need old data

**Consider migration if:**
- `signal_flow_data` has recent/important signal flow configurations
- `signal_connections` has data that needs to be preserved
- You need to maintain historical signal mapper data

**Migration Complexity:**
- `signal_connections`: Medium (requires ID mapping)
- `signal_flow_data`: High (JSONB parsing and transformation)
- `signal_mapper_layouts`: Low (probably not needed)

## Verification After Deletion

After deletion, verify:
1. Run Query 7 again - should show 0 tables to investigate
2. Check that current signal mapper still works
3. Verify no errors in application logs

## Notes

- These tables are from an old implementation
- The current signal mapper uses a different schema (`nodes`, `connections`, `connection_port_map`)
- If these tables are empty, they're safe to remove
- If they have data, decide if it needs to be migrated or can be discarded

