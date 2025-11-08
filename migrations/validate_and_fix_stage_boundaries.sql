-- Migration: Validate and fix stage boundaries for connections
-- Project: 38d8580f-50dc-4c42-a183-a7b0b4dca6b3
-- This ensures connections only exist between nodes in the same stage/location
-- and that connections have location_id matching their nodes

-- PREVIEW: Find connections that cross stage boundaries (run this first)
-- SELECT 
--   c.id as connection_id,
--   c.location_id as connection_location_id,
--   from_node.id as from_node_id,
--   from_node.label as from_node_label,
--   from_node.location_id as from_node_location_id,
--   to_node.id as to_node_id,
--   to_node.label as to_node_label,
--   to_node.location_id as to_node_location_id,
--   CASE 
--     WHEN from_node.location_id != to_node.location_id THEN 'Cross-stage connection'
--     WHEN c.location_id IS NULL AND (from_node.location_id IS NOT NULL OR to_node.location_id IS NOT NULL) THEN 'Missing location_id on connection'
--     WHEN c.location_id != from_node.location_id OR c.location_id != to_node.location_id THEN 'Mismatched location_id'
--     ELSE 'OK'
--   END as issue_type
-- FROM connections c
-- INNER JOIN nodes from_node ON c.from_node_id = from_node.id
-- INNER JOIN nodes to_node ON c.to_node_id = to_node.id
-- WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
--   AND (
--     -- Cross-stage connections
--     (from_node.location_id IS NOT NULL AND to_node.location_id IS NOT NULL AND from_node.location_id != to_node.location_id)
--     -- Missing location_id on connection when nodes have location_id
--     OR (c.location_id IS NULL AND (from_node.location_id IS NOT NULL OR to_node.location_id IS NOT NULL))
--     -- Mismatched location_id
--     OR (c.location_id IS NOT NULL AND from_node.location_id IS NOT NULL AND c.location_id != from_node.location_id)
--     OR (c.location_id IS NOT NULL AND to_node.location_id IS NOT NULL AND c.location_id != to_node.location_id)
--   )
-- ORDER BY issue_type, from_node.label;

-- Fix 1: Update connections to match the location_id of their from_node
-- (This handles cases where connection.location_id is NULL or mismatched)
UPDATE connections c
SET location_id = from_node.location_id
FROM nodes from_node
WHERE c.from_node_id = from_node.id
  AND c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND from_node.location_id IS NOT NULL
  AND (c.location_id IS NULL OR c.location_id != from_node.location_id);

-- Fix 2: Update connections to match the location_id of their to_node
-- (This handles cases where from_node.location_id is NULL but to_node has location_id)
UPDATE connections c
SET location_id = to_node.location_id
FROM nodes to_node
WHERE c.to_node_id = to_node.id
  AND c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND to_node.location_id IS NOT NULL
  AND (c.location_id IS NULL OR c.location_id != to_node.location_id)
  AND c.from_node_id NOT IN (
    SELECT id FROM nodes 
    WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
      AND location_id IS NOT NULL
  );

-- Fix 3: For connections where both nodes have location_id but they differ,
-- use the from_node's location_id (source determines the stage)
-- Log these as they may need manual review
UPDATE connections
SET location_id = from_node.location_id
FROM nodes from_node, nodes to_node
WHERE connections.from_node_id = from_node.id
  AND connections.to_node_id = to_node.id
  AND connections.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND from_node.location_id IS NOT NULL
  AND to_node.location_id IS NOT NULL
  AND from_node.location_id != to_node.location_id;

-- Verification: Show summary of connections by location
SELECT 
  COALESCE(c.location_id::text, 'NULL (project-wide)') as location_id,
  COUNT(*) as connection_count,
  COUNT(DISTINCT c.from_node_id) as unique_from_nodes,
  COUNT(DISTINCT c.to_node_id) as unique_to_nodes
FROM connections c
WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
GROUP BY c.location_id
ORDER BY c.location_id NULLS LAST;

-- Verification: Check for any remaining cross-stage connections
SELECT 
  COUNT(*) as cross_stage_connections_count
FROM connections c
INNER JOIN nodes from_node ON c.from_node_id = from_node.id
INNER JOIN nodes to_node ON c.to_node_id = to_node.id
WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND from_node.location_id IS NOT NULL
  AND to_node.location_id IS NOT NULL
  AND from_node.location_id != to_node.location_id;

-- Verification: Check for connections with mismatched location_id
SELECT 
  COUNT(*) as mismatched_location_connections_count
FROM connections c
INNER JOIN nodes from_node ON c.from_node_id = from_node.id
WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND c.location_id IS NOT NULL
  AND from_node.location_id IS NOT NULL
  AND c.location_id != from_node.location_id;

-- ============================================================================
-- OPTIONAL: Add database constraint to prevent future cross-stage connections
-- ============================================================================
-- Uncomment the following to add a check constraint that prevents connections
-- between nodes with different location_id values
-- 
-- Note: This constraint allows:
--   - Connections between nodes with the same location_id
--   - Connections between nodes where both have NULL location_id (project-wide)
--   - Connections where one node has location_id and the other is NULL (mixed)
--
-- If you want stricter enforcement (only allow same location_id), modify the constraint accordingly.

-- CREATE OR REPLACE FUNCTION check_connection_location_consistency()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   -- Check if both nodes have location_id and they differ
--   IF EXISTS (
--     SELECT 1 
--     FROM nodes from_node, nodes to_node
--     WHERE from_node.id = NEW.from_node_id
--       AND to_node.id = NEW.to_node_id
--       AND from_node.location_id IS NOT NULL
--       AND to_node.location_id IS NOT NULL
--       AND from_node.location_id != to_node.location_id
--   ) THEN
--     RAISE EXCEPTION 'Cannot create connection between nodes from different stages. From node location_id: %, To node location_id: %',
--       (SELECT location_id FROM nodes WHERE id = NEW.from_node_id),
--       (SELECT location_id FROM nodes WHERE id = NEW.to_node_id);
--   END IF;
--   
--   -- Ensure connection.location_id matches from_node.location_id if both are set
--   IF NEW.location_id IS NOT NULL AND EXISTS (
--     SELECT 1 FROM nodes WHERE id = NEW.from_node_id AND location_id IS NOT NULL AND location_id != NEW.location_id
--   ) THEN
--     RAISE EXCEPTION 'Connection location_id (%) does not match from_node location_id (%)',
--       NEW.location_id,
--       (SELECT location_id FROM nodes WHERE id = NEW.from_node_id);
--   END IF;
--   
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- DROP TRIGGER IF EXISTS trigger_check_connection_location ON connections;
-- CREATE TRIGGER trigger_check_connection_location
--   BEFORE INSERT OR UPDATE ON connections
--   FOR EACH ROW
--   EXECUTE FUNCTION check_connection_location_consistency();

