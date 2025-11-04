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
-- VERIFICATION QUERY (Run after cleanup)
-- ============================================

-- 14. Verify all connections have valid nodes
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
        ELSE 'PASS: All connections and port mappings are valid'
    END as verification_status;

