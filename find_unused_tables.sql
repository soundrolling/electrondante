-- SQL Queries to Find Unused Supabase Tables
-- Compares tables in database vs tables actually used in the application
--
-- QUICK START: Run Query 9 to see which specific tables need investigation

-- ============================================
-- STEP 1: List ALL tables in your database
-- ============================================

-- 1. Get all tables in the public schema
SELECT 
    table_name,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_name = t.table_name 
       AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- STEP 2: Tables that ARE used in the application
-- ============================================
-- Based on codebase search, these tables are actively used:

-- Current Signal Mapper Tables:
-- - nodes
-- - connections
-- - connection_port_map

-- Project & Location Tables:
-- - projects
-- - project_members
-- - project_details
-- - project_contacts
-- - locations
-- - venues
-- - stage_hours

-- Gear Tables:
-- - gear_table
-- - gear_assignments
-- - user_gear
-- - user_gear_view
-- - gear_bags
-- - gear_bag_items
-- - gear-bag-images (with hyphen - might be old)

-- Calendar & Events:
-- - calendar_events

-- Travel Tables:
-- - travel_trips
-- - travel_trip_members
-- - travel_flights
-- - travel_accommodations
-- - travel_accommodation_members
-- - travel_documents
-- - travel_expenses
-- - travel_parking
-- - travel_rental_cars
-- - travel_local_transport

-- Documents & Pictures:
-- - stage_docs
-- - stage_pictures
-- - stage-docs (with hyphen - might be old table)
-- - stage-pictures (with hyphen - might be old table)

-- User & Profile:
-- - user_profiles
-- - user_gear

-- Note: Tables with hyphens (stage-docs, stage-pictures, travel-documents, travel-expenses, gear-bag-images)
-- might be old naming conventions. Check if these are still in use or can be removed.

-- ============================================
-- STEP 3: Compare database tables vs used tables
-- ============================================

-- 8. Find tables in database that are NOT in the used list
-- This is the main query to identify unused tables
WITH used_tables AS (
    SELECT unnest(ARRAY[
        -- Signal Mapper
        'nodes', 'connections', 'connection_port_map',
        -- Projects & Locations
        'projects', 'project_members', 'project_details', 'project_contacts', 'project_docs',
        'locations', 'venues', 'stage_hours',
        -- Gear
        'gear_table', 'gear_assignments', 'user_gear', 'user_gear_view',
        'gear_bags', 'gear_bag_items', 'gear-bag-images',
        -- Calendar
        'calendar_events',
        -- Travel
        'travel_trips', 'travel_trip_members', 'travel_flights',
        'travel_accommodations', 'travel_accommodation_members',
        'travel_documents', 'travel_expenses', 'travel_parking',
        'travel_rental_cars', 'travel_local_transport',
        'travel-documents', 'travel-expenses',
        -- Documents & Pictures
        'stage_docs', 'stage_pictures', 'stage-docs', 'stage-pictures',
        -- User
        'user_profiles',
        -- Other
        'bug_reports', 'bug_report_comments', 'quickfire_buttons'
    ]) AS table_name
)
SELECT 
    t.table_name,
    CASE 
        WHEN t.table_name IN (SELECT table_name FROM used_tables) THEN 'USED - Active'
        WHEN t.table_name LIKE '%-%' THEN 'CHECK - Hyphenated (might be old)'
        WHEN t.table_name LIKE '%signal%' OR t.table_name LIKE '%mapper%' THEN 'CHECK - Possibly old signal mapper'
        ELSE 'UNKNOWN - Possibly unused'
    END as status,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_name = t.table_name 
       AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN (SELECT table_name FROM used_tables)
ORDER BY 
    CASE 
        WHEN t.table_name LIKE '%-%' THEN 1
        WHEN t.table_name LIKE '%signal%' OR t.table_name LIKE '%mapper%' THEN 2
        ELSE 3
    END,
    t.table_name;

-- ============================================
-- STEP 4: Find tables that might be UNUSED (Detailed)
-- ============================================

-- 2. List all tables and mark which are likely used
SELECT 
    t.table_name,
    CASE 
        -- Current signal mapper (confirmed active)
        WHEN t.table_name IN ('nodes', 'connections', 'connection_port_map') THEN 'CURRENT - Signal Mapper'
        
        -- Project & location (confirmed active)
        WHEN t.table_name IN ('projects', 'project_members', 'project_details', 'project_contacts', 
                              'locations', 'venues', 'stage_hours') THEN 'CURRENT - Project/Location'
        
        -- Gear (confirmed active)
        WHEN t.table_name IN ('gear_table', 'gear_assignments', 'user_gear', 'user_gear_view') THEN 'CURRENT - Gear'
        
        -- Calendar (confirmed active)
        WHEN t.table_name IN ('calendar_events') THEN 'CURRENT - Calendar'
        
        -- Travel (confirmed active)
        WHEN t.table_name IN ('travel_trips', 'travel_trip_members', 'travel_flights', 
                              'travel_accommodations', 'travel_accommodation_members', 
                              'travel_documents', 'travel_expenses', 'travel_parking',
                              'travel_rental_cars', 'travel_local_transport') THEN 'CURRENT - Travel'
        
        -- Documents (confirmed active)
        WHEN t.table_name IN ('stage_docs', 'stage_pictures') THEN 'CURRENT - Documents'
        
        -- User (confirmed active)
        WHEN t.table_name IN ('user_profiles', 'user_gear') THEN 'CURRENT - User'
        
        -- Old signal mapper tables (potentially unused)
        WHEN t.table_name LIKE '%signal%' 
             OR t.table_name LIKE '%mapper%'
             OR t.table_name LIKE '%mic_placement%'
             OR t.table_name LIKE '%signal_flow%'
             OR t.table_name LIKE '%track_list%'
             OR t.table_name LIKE '%mic%map%'
        THEN 'CHECK - Possibly old signal mapper table'
        
        -- Tables with hyphens (often old naming convention)
        WHEN t.table_name LIKE '%-%' THEN 'CHECK - Hyphenated table (might be old)'
        
        -- Other potential signal mapper tables
        WHEN t.table_name LIKE '%connection%' AND t.table_name NOT IN ('connections', 'connection_port_map')
        THEN 'CHECK - Other connection table'
        
        WHEN t.table_name LIKE '%port%' AND t.table_name NOT IN ('connection_port_map')
        THEN 'CHECK - Other port table'
        
        WHEN t.table_name LIKE '%node%' AND t.table_name NOT IN ('nodes')
        THEN 'CHECK - Other node table'
        
        ELSE 'UNKNOWN - Check if used'
    END as status,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_name = t.table_name 
       AND table_schema = 'public') as column_count,
    -- Try to get row count (if table exists and is accessible)
    NULL as estimated_row_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY 
    CASE 
        WHEN t.table_name IN ('nodes', 'connections', 'connection_port_map',
                              'projects', 'project_members', 'project_details', 'project_contacts', 'project_docs',
                              'gear_table', 'gear_assignments', 'user_gear', 'user_gear_view',
                              'gear_bags', 'gear_bag_items',
                              'locations', 'venues', 'stage_hours',
                              'calendar_events', 'user_profiles',
                              'bug_reports', 'bug_report_comments', 'quickfire_buttons') THEN 1
        WHEN t.table_name LIKE '%signal%' OR t.table_name LIKE '%mapper%' THEN 2
        WHEN t.table_name LIKE '%-%' THEN 3
        ELSE 4
    END,
    t.table_name;

-- ============================================
-- STEP 5: Find tables with no foreign key relationships
-- ============================================

-- 3. Find tables that have NO foreign keys pointing TO them (might be unused)
SELECT 
    t.table_name,
    'No foreign keys reference this table' as note
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = t.table_name
  )
  AND t.table_name NOT IN (
    -- Exclude known standalone tables
    'projects', 'venues', 'user_profiles'
  )
ORDER BY t.table_name;

-- ============================================
-- STEP 6: Find tables with no data (likely unused)
-- ============================================

-- 4. Find empty tables (might be unused)
-- Note: This requires dynamic SQL or running for each table
-- For now, we'll create a template you can use

-- Example to check if a table is empty:
-- SELECT COUNT(*) as row_count FROM table_name_here;

-- ============================================
-- STEP 7: Find old signal mapper specific tables
-- ============================================

-- 5. Specifically look for old signal mapper tables
SELECT 
    t.table_name,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_name = t.table_name 
       AND table_schema = 'public') as column_count,
    'POTENTIALLY OLD SIGNAL MAPPER TABLE' as status
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND (
    -- Old naming patterns
    t.table_name LIKE '%signal_%'
    OR t.table_name LIKE '%mapper_%'
    OR t.table_name LIKE '%mic_placement%'
    OR t.table_name LIKE '%signal_flow%'
    OR t.table_name LIKE '%track_list%'
    OR t.table_name LIKE '%tracklist%'
    OR t.table_name LIKE '%micmap%'
    OR t.table_name LIKE '%quickfire%'  -- Old name for signal mapper
    OR (t.table_name LIKE '%connection%' 
        AND t.table_name NOT IN ('connections', 'connection_port_map'))
    OR (t.table_name LIKE '%port%' 
        AND t.table_name NOT IN ('connection_port_map'))
    OR (t.table_name LIKE '%node%' 
        AND t.table_name NOT IN ('nodes'))
  )
  AND t.table_name NOT IN ('nodes', 'connections', 'connection_port_map')  -- Current tables
ORDER BY t.table_name;

-- ============================================
-- STEP 8: Check for tables with similar names (old vs new)
-- ============================================

-- 6. Find tables with hyphens (old naming) vs underscores (new naming)
SELECT 
    table_name,
    CASE 
        WHEN table_name LIKE '%-%' THEN 'Has hyphens (old naming convention)'
        ELSE 'Has underscores (new naming convention)'
    END as naming_convention,
    'Check if this is an old table' as note
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND (
    table_name LIKE 'stage-%'
    OR table_name LIKE 'travel-%'
    OR table_name LIKE 'connection-%'
    OR table_name LIKE 'signal-%'
    OR table_name LIKE 'mapper-%'
  )
ORDER BY table_name;

-- ============================================
-- RECOMMENDATION QUERY
-- ============================================

-- 7. Summary: Tables to investigate
SELECT 
    'Tables to investigate for potential removal' as category,
    COUNT(*) as count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND (
    -- Old signal mapper patterns
    (t.table_name LIKE '%signal%' OR t.table_name LIKE '%mapper%')
    AND t.table_name NOT IN ('nodes', 'connections', 'connection_port_map')
  )
  OR (
    -- Hyphenated tables (old naming)
    t.table_name LIKE '%-%'
    AND t.table_name NOT IN ('stage_docs', 'stage_pictures')  -- These might be active
  )
UNION ALL
SELECT 
    'Confirmed active tables' as category,
    COUNT(*) as count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN (
    'nodes', 'connections', 'connection_port_map',
    'projects', 'project_members', 'project_details', 'project_contacts', 'project_docs',
    'gear_table', 'gear_assignments', 'user_gear', 'user_gear_view',
    'gear_bags', 'gear_bag_items', 'gear-bag-images',
    'locations', 'venues', 'stage_hours',
    'calendar_events',
    'travel_trips', 'travel_trip_members', 'travel_flights',
    'travel_accommodations', 'travel_accommodation_members',
    'travel_documents', 'travel_expenses', 'travel_parking',
    'travel_rental_cars', 'travel_local_transport',
    'travel-documents', 'travel-expenses',
    'stage_docs', 'stage_pictures', 'stage-docs', 'stage-pictures',
    'user_profiles',
    'bug_reports', 'bug_report_comments', 'quickfire_buttons'
  );

-- 9. DETAILED: Show which specific tables are flagged for investigation
-- This shows the actual table names that need to be checked
SELECT 
    t.table_name,
    CASE 
        WHEN (t.table_name LIKE '%signal%' OR t.table_name LIKE '%mapper%')
             AND t.table_name NOT IN ('nodes', 'connections', 'connection_port_map')
        THEN 'Old signal mapper table'
        WHEN t.table_name LIKE '%-%'
             AND t.table_name NOT IN ('stage_docs', 'stage_pictures', 
                                      'stage-docs', 'stage-pictures',
                                      'travel-documents', 'travel-expenses',
                                      'gear-bag-images')  -- These are in used list
        THEN 'Hyphenated table (old naming)'
        ELSE 'Other - needs investigation'
    END as reason,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_name = t.table_name 
       AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND (
    -- Old signal mapper patterns
    (t.table_name LIKE '%signal%' OR t.table_name LIKE '%mapper%')
    AND t.table_name NOT IN ('nodes', 'connections', 'connection_port_map')
  )
  OR (
    -- Hyphenated tables (old naming) - but exclude ones we know are used
    t.table_name LIKE '%-%'
    AND t.table_name NOT IN (
        'stage_docs', 'stage_pictures',  -- underscore versions
        'stage-docs', 'stage-pictures',  -- hyphen versions (might be used)
        'travel-documents', 'travel-expenses',  -- hyphen versions (might be used)
        'gear-bag-images'  -- hyphen version (might be used)
    )
  )
ORDER BY 
    CASE 
        WHEN t.table_name LIKE '%signal%' OR t.table_name LIKE '%mapper%' THEN 1
        WHEN t.table_name LIKE '%-%' THEN 2
        ELSE 3
    END,
    t.table_name;

-- ============================================
-- VERIFICATION QUERIES FOR OLD SIGNAL MAPPER TABLES
-- ============================================

-- 10. Check if old signal mapper tables have any data
-- Run these to see if the tables are empty (safe to remove) or have data (check migration needed)
SELECT 'signal_connections' as table_name, COUNT(*) as row_count FROM signal_connections
UNION ALL
SELECT 'signal_flow_data' as table_name, COUNT(*) as row_count FROM signal_flow_data
UNION ALL
SELECT 'signal_mapper_layouts' as table_name, COUNT(*) as row_count FROM signal_mapper_layouts;

-- 11. Check if old signal mapper tables are referenced by foreign keys
-- If any tables reference these, you'll need to handle those first
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

-- 12. Check table structures to understand what they stored
-- This helps understand if data migration might be needed
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('signal_connections', 'signal_flow_data', 'signal_mapper_layouts')
ORDER BY table_name, ordinal_position;

-- 13. Sample data from old tables (if they have data)
-- Uncomment these if you want to see what data exists before deletion
-- SELECT * FROM signal_connections LIMIT 10;
-- SELECT * FROM signal_flow_data LIMIT 10;
-- SELECT * FROM signal_mapper_layouts LIMIT 10;

-- ============================================
-- CLEANUP QUERIES (Run ONLY after verification)
-- ============================================

-- 14. Delete old signal mapper tables
-- WARNING: Only run these AFTER:
--   1. Confirming tables are empty OR data has been migrated
--   2. Confirming no foreign keys reference these tables
--   3. Backing up your database
--
-- Uncomment these one at a time and run them:
--
-- DROP TABLE IF EXISTS signal_connections CASCADE;
-- DROP TABLE IF EXISTS signal_flow_data CASCADE;
-- DROP TABLE IF EXISTS signal_mapper_layouts CASCADE;

