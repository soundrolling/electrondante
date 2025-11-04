-- SQL Queries to Find and Clean Up Orphaned Connections and Port Mappings
-- Run these queries to identify and fix data integrity issues

-- ============================================
-- DIAGNOSTIC QUERIES (Read-only, safe to run)
-- ============================================

-- 1. Find connections where from_node_id doesn't exist in nodes table
SELECT 
    c.id as connection_id,
    c.project_id,
    c.from_node_id,
    c.to_node_id,
    c.input_number,
    c.track_number,
    'FROM node missing' as issue
FROM connections c
LEFT JOIN nodes n ON c.from_node_id = n.id
WHERE n.id IS NULL;

-- 2. Find connections where to_node_id doesn't exist in nodes table
SELECT 
    c.id as connection_id,
    c.project_id,
    c.from_node_id,
    c.to_node_id,
    c.input_number,
    c.track_number,
    'TO node missing' as issue
FROM connections c
LEFT JOIN nodes n ON c.to_node_id = n.id
WHERE n.id IS NULL;

-- 3. Find port mappings that reference connections that don't exist
SELECT 
    pm.id as port_map_id,
    pm.connection_id,
    pm.from_port,
    pm.to_port,
    'Connection missing' as issue
FROM connection_port_map pm
LEFT JOIN connections c ON pm.connection_id = c.id
WHERE c.id IS NULL;

-- 4. Find port mappings where the connection's from_node_id doesn't exist
SELECT 
    pm.id as port_map_id,
    pm.connection_id,
    pm.from_port,
    pm.to_port,
    c.from_node_id,
    'FROM node missing for connection' as issue
FROM connection_port_map pm
INNER JOIN connections c ON pm.connection_id = c.id
LEFT JOIN nodes n ON c.from_node_id = n.id
WHERE n.id IS NULL;

-- 5. Find port mappings where the connection's to_node_id doesn't exist
SELECT 
    pm.id as port_map_id,
    pm.connection_id,
    pm.from_port,
    pm.to_port,
    c.to_node_id,
    'TO node missing for connection' as issue
FROM connection_port_map pm
INNER JOIN connections c ON pm.connection_id = c.id
LEFT JOIN nodes n ON c.to_node_id = n.id
WHERE n.id IS NULL;

-- 6. Find duplicate connections (same from_node, to_node, input_number)
SELECT 
    from_node_id,
    to_node_id,
    input_number,
    COUNT(*) as duplicate_count,
    array_agg(id) as connection_ids
FROM connections
WHERE input_number IS NOT NULL
GROUP BY from_node_id, to_node_id, input_number
HAVING COUNT(*) > 1;

-- 7. Find duplicate port mappings (same connection_id, from_port, to_port)
SELECT 
    connection_id,
    from_port,
    to_port,
    COUNT(*) as duplicate_count,
    array_agg(id) as port_map_ids
FROM connection_port_map
GROUP BY connection_id, from_port, to_port
HAVING COUNT(*) > 1;

-- 8. Summary of orphaned data
SELECT 
    'Connections with missing FROM node' as issue_type,
    COUNT(*) as count
FROM connections c
LEFT JOIN nodes n ON c.from_node_id = n.id
WHERE n.id IS NULL
UNION ALL
SELECT 
    'Connections with missing TO node' as issue_type,
    COUNT(*) as count
FROM connections c
LEFT JOIN nodes n ON c.to_node_id = n.id
WHERE n.id IS NULL
UNION ALL
SELECT 
    'Port mappings with missing connection' as issue_type,
    COUNT(*) as count
FROM connection_port_map pm
LEFT JOIN connections c ON pm.connection_id = c.id
WHERE c.id IS NULL;

-- ============================================
-- CLEANUP QUERIES (Run with caution - DELETES data)
-- ============================================

-- WARNING: Review the diagnostic queries above before running cleanup queries!
-- Backup your database before running these!

-- 9. Delete port mappings that reference non-existent connections
-- DELETE FROM connection_port_map pm
-- WHERE NOT EXISTS (
--     SELECT 1 FROM connections c WHERE c.id = pm.connection_id
-- );

-- 10. Delete connections where from_node_id doesn't exist
-- DELETE FROM connections c
-- WHERE NOT EXISTS (
--     SELECT 1 FROM nodes n WHERE n.id = c.from_node_id
-- );

-- 11. Delete connections where to_node_id doesn't exist
-- DELETE FROM connections c
-- WHERE NOT EXISTS (
--     SELECT 1 FROM nodes n WHERE n.id = c.to_node_id
-- );

-- 12. Delete duplicate port mappings (keeps the first one)
-- DELETE FROM connection_port_map pm
-- WHERE pm.id NOT IN (
--     SELECT MIN(id)
--     FROM connection_port_map
--     GROUP BY connection_id, from_port, to_port
-- );

-- 13. Delete duplicate connections (keeps the first one, but be careful!)
-- This should rarely be needed if constraints are working properly
-- DELETE FROM connections c
-- WHERE c.id NOT IN (
--     SELECT MIN(id)
--     FROM connections
--     WHERE input_number IS NOT NULL
--     GROUP BY from_node_id, to_node_id, input_number
-- );

-- ============================================
-- ADDITIONAL DIAGNOSTIC QUERIES FOR RELATED TABLES
-- ============================================

-- 15. Find nodes that reference non-existent gear
SELECT 
    n.id as node_id,
    n.project_id,
    n.gear_id,
    'Gear missing' as issue
FROM nodes n
LEFT JOIN gear_table g ON n.gear_id = g.id
WHERE n.gear_id IS NOT NULL AND g.id IS NULL;

-- 16. Find nodes that reference non-existent projects
SELECT 
    n.id as node_id,
    n.project_id,
    'Project missing' as issue
FROM nodes n
LEFT JOIN projects p ON n.project_id = p.id
WHERE p.id IS NULL;

-- 17. Find connections that reference non-existent projects
SELECT 
    c.id as connection_id,
    c.project_id,
    'Project missing' as issue
FROM connections c
LEFT JOIN projects p ON c.project_id = p.id
WHERE p.id IS NULL;

-- 18. Find port mappings that reference non-existent projects
SELECT 
    pm.id as port_map_id,
    pm.project_id,
    pm.connection_id,
    'Project missing' as issue
FROM connection_port_map pm
LEFT JOIN projects p ON pm.project_id = p.id
WHERE p.id IS NULL;

-- 19. Find gear_assignments that reference non-existent gear
SELECT 
    ga.id as assignment_id,
    ga.gear_id,
    ga.location_id,
    'Gear missing' as issue
FROM gear_assignments ga
LEFT JOIN gear_table g ON ga.gear_id = g.id
WHERE g.id IS NULL;

-- 20. Find gear_assignments that reference non-existent locations
SELECT 
    ga.id as assignment_id,
    ga.gear_id,
    ga.location_id,
    'Location missing' as issue
FROM gear_assignments ga
LEFT JOIN locations l ON ga.location_id = l.id
WHERE ga.location_id IS NOT NULL AND l.id IS NULL;

-- 21. Find gear_assignments that reference non-existent projects (via gear)
SELECT 
    ga.id as assignment_id,
    ga.gear_id,
    g.project_id,
    'Project missing for gear' as issue
FROM gear_assignments ga
INNER JOIN gear_table g ON ga.gear_id = g.id
LEFT JOIN projects p ON g.project_id = p.id
WHERE p.id IS NULL;

-- 22. Find nodes with invalid project_id (not matching project)
SELECT 
    n.id as node_id,
    n.project_id,
    'Project mismatch' as issue
FROM nodes n
WHERE n.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.id = n.project_id
  );

-- 23. Summary of ALL orphaned data across all tables
SELECT 
    'Connections with missing FROM node' as issue_type,
    COUNT(*) as count
FROM connections c
LEFT JOIN nodes n ON c.from_node_id = n.id
WHERE n.id IS NULL
UNION ALL
SELECT 
    'Connections with missing TO node' as issue_type,
    COUNT(*) as count
FROM connections c
LEFT JOIN nodes n ON c.to_node_id = n.id
WHERE n.id IS NULL
UNION ALL
SELECT 
    'Port mappings with missing connection' as issue_type,
    COUNT(*) as count
FROM connection_port_map pm
LEFT JOIN connections c ON pm.connection_id = c.id
WHERE c.id IS NULL
UNION ALL
SELECT 
    'Nodes with missing gear' as issue_type,
    COUNT(*) as count
FROM nodes n
LEFT JOIN gear_table g ON n.gear_id = g.id
WHERE n.gear_id IS NOT NULL AND g.id IS NULL
UNION ALL
SELECT 
    'Nodes with missing project' as issue_type,
    COUNT(*) as count
FROM nodes n
LEFT JOIN projects p ON n.project_id = p.id
WHERE p.id IS NULL
UNION ALL
SELECT 
    'Connections with missing project' as issue_type,
    COUNT(*) as count
FROM connections c
LEFT JOIN projects p ON c.project_id = p.id
WHERE p.id IS NULL
UNION ALL
SELECT 
    'Gear assignments with missing gear' as issue_type,
    COUNT(*) as count
FROM gear_assignments ga
LEFT JOIN gear_table g ON ga.gear_id = g.id
WHERE g.id IS NULL
UNION ALL
SELECT 
    'Gear assignments with missing location' as issue_type,
    COUNT(*) as count
FROM gear_assignments ga
LEFT JOIN locations l ON ga.location_id = l.id
WHERE ga.location_id IS NOT NULL AND l.id IS NULL;

-- ============================================
-- IDENTIFY OLD/UNUSED SIGNAL MAPPER TABLES
-- ============================================

-- 24. List all tables that might be related to signal mapper (current and old)
-- This query checks for common signal mapper table name patterns
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('nodes', 'connections', 'connection_port_map') THEN 'CURRENT - Active'
        WHEN table_name LIKE '%signal%' OR table_name LIKE '%mapper%' OR table_name LIKE '%mic%' 
             OR table_name LIKE '%connection%' OR table_name LIKE '%port%'
             THEN 'POTENTIALLY OLD - Check usage'
        ELSE 'OTHER - Check if related'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name IN ('nodes', 'connections', 'connection_port_map')
    OR table_name LIKE '%signal%'
    OR table_name LIKE '%mapper%'
    OR table_name LIKE '%mic%'
    OR table_name LIKE '%connection%'
    OR table_name LIKE '%port%'
    OR table_name LIKE '%node%'
  )
ORDER BY 
    CASE 
        WHEN table_name IN ('nodes', 'connections', 'connection_port_map') THEN 1
        ELSE 2
    END,
    table_name;

-- 25. Check for old signal mapper tables with data
-- This helps identify tables that might have old data
SELECT 
    t.table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name AND table_schema = 'public') as column_count,
    CASE 
        WHEN t.table_name IN ('nodes', 'connections', 'connection_port_map') THEN 'CURRENT'
        ELSE 'CHECK IF OLD'
    END as status
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND (
    t.table_name LIKE '%signal%'
    OR t.table_name LIKE '%mapper%'
    OR t.table_name LIKE '%mic_placement%'
    OR t.table_name LIKE '%signal_flow%'
    OR t.table_name LIKE '%track_list%'
  )
ORDER BY t.table_name;

-- 26. Find tables with foreign key references to nodes/connections (might indicate old tables)
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
  AND (
    ccu.table_name IN ('nodes', 'connections')
    OR ccu.table_name LIKE '%signal%'
    OR ccu.table_name LIKE '%mapper%'
  )
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- ADDITIONAL CLEANUP QUERIES
-- ============================================

-- 27. Delete nodes with missing gear (if gear was deleted)
-- DELETE FROM nodes n
-- WHERE n.gear_id IS NOT NULL 
--   AND NOT EXISTS (
--     SELECT 1 FROM gear_table g WHERE g.id = n.gear_id
--   );

-- 28. Delete nodes with missing projects
-- DELETE FROM nodes n
-- WHERE NOT EXISTS (
--     SELECT 1 FROM projects p WHERE p.id = n.project_id
-- );

-- 29. Delete connections with missing projects
-- DELETE FROM connections c
-- WHERE NOT EXISTS (
--     SELECT 1 FROM projects p WHERE p.id = c.project_id
-- );

-- 30. Delete port mappings with missing projects
-- DELETE FROM connection_port_map pm
-- WHERE NOT EXISTS (
--     SELECT 1 FROM projects p WHERE p.id = pm.project_id
-- );

-- 31. Delete gear_assignments with missing gear
-- DELETE FROM gear_assignments ga
-- WHERE NOT EXISTS (
--     SELECT 1 FROM gear_table g WHERE g.id = ga.gear_id
-- );

-- 32. Delete gear_assignments with missing locations
-- DELETE FROM gear_assignments ga
-- WHERE ga.location_id IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM locations l WHERE l.id = ga.location_id
-- );

-- ============================================
-- VERIFICATION QUERY (Run after cleanup)
-- ============================================

-- 33. Verify all connections have valid nodes
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM connections c
            LEFT JOIN nodes n1 ON c.from_node_id = n1.id
            WHERE n1.id IS NULL
        ) THEN 'FAIL: Connections with missing FROM nodes exist'
        WHEN EXISTS (
            SELECT 1 FROM connections c
            LEFT JOIN nodes n2 ON c.to_node_id = n2.id
            WHERE n2.id IS NULL
        ) THEN 'FAIL: Connections with missing TO nodes exist'
        WHEN EXISTS (
            SELECT 1 FROM connection_port_map pm
            LEFT JOIN connections c ON pm.connection_id = c.id
            WHERE c.id IS NULL
        ) THEN 'FAIL: Port mappings with missing connections exist'
        WHEN EXISTS (
            SELECT 1 FROM nodes n
            LEFT JOIN gear_table g ON n.gear_id = g.id
            WHERE n.gear_id IS NOT NULL AND g.id IS NULL
        ) THEN 'FAIL: Nodes with missing gear exist'
        WHEN EXISTS (
            SELECT 1 FROM nodes n
            LEFT JOIN projects p ON n.project_id = p.id
            WHERE p.id IS NULL
        ) THEN 'FAIL: Nodes with missing projects exist'
        WHEN EXISTS (
            SELECT 1 FROM connections c
            LEFT JOIN projects p ON c.project_id = p.id
            WHERE p.id IS NULL
        ) THEN 'FAIL: Connections with missing projects exist'
        WHEN EXISTS (
            SELECT 1 FROM gear_assignments ga
            LEFT JOIN gear_table g ON ga.gear_id = g.id
            WHERE g.id IS NULL
        ) THEN 'FAIL: Gear assignments with missing gear exist'
        ELSE 'PASS: All connections, nodes, and port mappings are valid'
    END as verification_status;

