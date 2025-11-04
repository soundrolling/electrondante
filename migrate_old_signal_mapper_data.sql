-- Migration Script for Old Signal Mapper Tables
-- WARNING: Only run this if you need to migrate data from old tables
-- Test thoroughly before running in production
-- Backup your database first!

-- ============================================
-- STEP 1: Check if migration is needed
-- ============================================

-- Check row counts
SELECT 'signal_connections' as table_name, COUNT(*) as row_count FROM signal_connections
UNION ALL
SELECT 'signal_flow_data' as table_name, COUNT(*) as row_count FROM signal_flow_data
UNION ALL
SELECT 'signal_mapper_layouts' as table_name, COUNT(*) as row_count FROM signal_mapper_layouts;

-- ============================================
-- STEP 2: Sample data to understand structure
-- ============================================

-- Sample from signal_connections
-- SELECT * FROM signal_connections LIMIT 5;

-- Sample from signal_flow_data (shows JSONB structure)
-- SELECT 
--     id,
--     location_id,
--     jsonb_pretty(nodes) as nodes_json,
--     jsonb_pretty(connections) as connections_json
-- FROM signal_flow_data 
-- LIMIT 1;

-- Sample from signal_mapper_layouts
-- SELECT * FROM signal_mapper_layouts LIMIT 5;

-- ============================================
-- STEP 3: Migration Queries (if needed)
-- ============================================

-- NOTE: These are templates. You'll need to customize based on:
-- 1. Your actual data structure
-- 2. Node ID format (character varying vs UUID)
-- 3. Project ID mapping
-- 4. Whether port mappings need to be created

-- ============================================
-- Option A: Migrate signal_connections to connections
-- ============================================
-- This assumes:
-- - Old node IDs can be mapped to new node IDs
-- - You have a mapping table or can match by other criteria
-- - Project IDs are available

/*
-- Example migration (customize as needed):
INSERT INTO connections (
    from_node_id,
    to_node_id,
    input_number,
    output_number,
    track_number,
    project_id,
    pad,
    phantom_power,
    inserted_at
)
SELECT 
    -- Map old node IDs to new node IDs
    -- You'll need a mapping table or logic to convert
    new_from_node_id,
    new_to_node_id,
    sc.input_number,
    sc.output_number,
    sc.track_number,
    -- Get project_id from location_id or other source
    p.id as project_id,
    false as pad,
    false as phantom_power,
    sc.inserted_at
FROM signal_connections sc
-- Add JOIN logic to map old node IDs to new ones
-- JOIN node_id_mapping nm_from ON nm_from.old_id = sc.from_node_id
-- JOIN node_id_mapping nm_to ON nm_to.old_id = sc.to_node_id
-- JOIN projects p ON p.location_id = ... -- map location_id to project_id
WHERE NOT EXISTS (
    -- Prevent duplicates
    SELECT 1 FROM connections c
    WHERE c.from_node_id = new_from_node_id
      AND c.to_node_id = new_to_node_id
      AND c.input_number = sc.input_number
);
*/

-- ============================================
-- Option B: Migrate signal_flow_data (JSONB to structured)
-- ============================================
-- This is more complex as it requires parsing JSONB
-- You'll need to:
-- 1. Parse nodes JSONB and create nodes records
-- 2. Parse connections JSONB and create connections records
-- 3. Create connection_port_map entries if needed

/*
-- Example: Extract nodes from JSONB
WITH flow_data AS (
    SELECT 
        id,
        location_id,
        nodes,
        connections
    FROM signal_flow_data
    WHERE nodes IS NOT NULL
)
SELECT 
    flow_data.location_id,
    node->>'id' as old_node_id,
    node->>'gear_type' as gear_type,
    node->>'gear_id' as gear_id,
    -- Extract other node properties
    (node->>'x')::numeric as x,
    (node->>'y')::numeric as y
FROM flow_data,
LATERAL jsonb_array_elements(flow_data.nodes) AS node;

-- Then insert into nodes table:
-- INSERT INTO nodes (project_id, gear_type, gear_id, x, y, ...)
-- SELECT ... (from above query)
*/

-- ============================================
-- STEP 4: Verify migration
-- ============================================

-- After migration, verify counts match:
-- SELECT 
--     'Old signal_connections' as source, COUNT(*) as count FROM signal_connections
-- UNION ALL
--     'New connections' as source, COUNT(*) as count FROM connections
-- UNION ALL
--     'Old signal_flow_data' as source, COUNT(*) as count FROM signal_flow_data
-- UNION ALL
--     'New nodes' as source, COUNT(*) as count FROM nodes;

-- ============================================
-- STEP 5: Cleanup old tables (after verification)
-- ============================================

-- Only run after:
-- 1. Migration is complete and verified
-- 2. Data has been backed up
-- 3. You've confirmed new tables work correctly

-- DROP TABLE IF EXISTS signal_connections CASCADE;
-- DROP TABLE IF EXISTS signal_flow_data CASCADE;
-- DROP TABLE IF EXISTS signal_mapper_layouts CASCADE;

-- ============================================
-- NOTES
-- ============================================

-- 1. Node ID Mapping:
--    - Old: character varying
--    - New: UUID (likely)
--    - You may need to create a mapping table or use a conversion function

-- 2. Project ID:
--    - Old tables use location_id
--    - New tables use project_id
--    - You'll need to map location_id -> project_id

-- 3. Port Mappings:
--    - Old implementation might not have had connection_port_map
--    - You may need to create port mappings based on input_number/output_number

-- 4. Data Validation:
--    - Check for NULL values
--    - Validate foreign key relationships
--    - Ensure project_id exists in projects table

-- 5. Testing:
--    - Test migration on a copy of production data
--    - Verify all relationships are maintained
--    - Check that signal flow still works in UI

