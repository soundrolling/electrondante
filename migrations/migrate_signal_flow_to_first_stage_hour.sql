-- Migration: Migrate signal flow data without stage_hour_id to first stage hour (open days)
-- This assigns all nodes and connections with NULL stage_hour_id to the first available
-- stage hour for their location, allowing them to be copied to other recording days
--
-- PREVIEW QUERIES (run these first to see what will be updated):
--
-- Preview: Count nodes that will be updated per location
-- SELECT 
--   n.location_id,
--   l.stage_name,
--   COUNT(*) as nodes_to_update,
--   MIN(sh.id) as first_stage_hour_id,
--   MIN(sh.notes) as first_stage_hour_notes
-- FROM nodes n
-- LEFT JOIN locations l ON n.location_id = l.id
-- LEFT JOIN LATERAL (
--   SELECT id, notes
--   FROM stage_hours
--   WHERE stage_id = n.location_id
--     AND project_id = n.project_id
--   ORDER BY start_datetime ASC
--   LIMIT 1
-- ) sh ON true
-- WHERE n.stage_hour_id IS NULL
--   AND n.location_id IS NOT NULL
--   AND n.project_id IS NOT NULL
-- GROUP BY n.location_id, l.stage_name
-- ORDER BY n.location_id;
--
-- Preview: Count connections that will be updated per location
-- SELECT 
--   c.location_id,
--   l.stage_name,
--   COUNT(*) as connections_to_update,
--   MIN(sh.id) as first_stage_hour_id,
--   MIN(sh.notes) as first_stage_hour_notes
-- FROM connections c
-- LEFT JOIN locations l ON c.location_id = l.id
-- LEFT JOIN LATERAL (
--   SELECT id, notes
--   FROM stage_hours
--   WHERE stage_id = c.location_id
--     AND project_id = c.project_id
--   ORDER BY start_datetime ASC
--   LIMIT 1
-- ) sh ON true
-- WHERE c.stage_hour_id IS NULL
--   AND c.location_id IS NOT NULL
--   AND c.project_id IS NOT NULL
-- GROUP BY c.location_id, l.stage_name
-- ORDER BY c.location_id;

-- Step 1: Update nodes with NULL stage_hour_id to use the first stage hour for their location
-- Only updates nodes that have a location_id and a corresponding stage hour exists
UPDATE nodes n
SET stage_hour_id = (
  SELECT id
  FROM stage_hours sh
  WHERE sh.stage_id = n.location_id
    AND sh.project_id = n.project_id
  ORDER BY sh.start_datetime ASC
  LIMIT 1
)
WHERE n.stage_hour_id IS NULL
  AND n.location_id IS NOT NULL
  AND n.project_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM stage_hours sh
    WHERE sh.stage_id = n.location_id
      AND sh.project_id = n.project_id
  );

-- Step 2: Update connections with NULL stage_hour_id to use the first stage hour for their location
-- Only updates connections that have a location_id and a corresponding stage hour exists
UPDATE connections c
SET stage_hour_id = (
  SELECT id
  FROM stage_hours sh
  WHERE sh.stage_id = c.location_id
    AND sh.project_id = c.project_id
  ORDER BY sh.start_datetime ASC
  LIMIT 1
)
WHERE c.stage_hour_id IS NULL
  AND c.location_id IS NOT NULL
  AND c.project_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM stage_hours sh
    WHERE sh.stage_id = c.location_id
      AND sh.project_id = c.project_id
  );

-- Verification: Show summary of updated nodes by location
SELECT 
  n.location_id,
  l.stage_name,
  n.stage_hour_id,
  sh.notes as stage_hour_notes,
  COUNT(*) as node_count
FROM nodes n
LEFT JOIN locations l ON n.location_id = l.id
LEFT JOIN stage_hours sh ON n.stage_hour_id = sh.id
WHERE n.stage_hour_id IS NOT NULL
  AND n.location_id IS NOT NULL
GROUP BY n.location_id, l.stage_name, n.stage_hour_id, sh.notes
ORDER BY n.location_id, n.stage_hour_id;

-- Verification: Show summary of updated connections by location
SELECT 
  c.location_id,
  l.stage_name,
  c.stage_hour_id,
  sh.notes as stage_hour_notes,
  COUNT(*) as connection_count
FROM connections c
LEFT JOIN locations l ON c.location_id = l.id
LEFT JOIN stage_hours sh ON c.stage_hour_id = sh.id
WHERE c.stage_hour_id IS NOT NULL
  AND c.location_id IS NOT NULL
GROUP BY c.location_id, l.stage_name, c.stage_hour_id, sh.notes
ORDER BY c.location_id, c.stage_hour_id;

-- Final check: Count any remaining nodes/connections with NULL stage_hour_id (should be 0 or only project-wide items)
SELECT 
  'nodes' as table_name,
  COUNT(*) as null_stage_hour_count
FROM nodes
WHERE stage_hour_id IS NULL
  AND location_id IS NOT NULL
  AND project_id IS NOT NULL
UNION ALL
SELECT 
  'connections' as table_name,
  COUNT(*) as null_stage_hour_count
FROM connections
WHERE stage_hour_id IS NULL
  AND location_id IS NOT NULL
  AND project_id IS NOT NULL;



