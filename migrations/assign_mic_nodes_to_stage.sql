-- Migration: Assign signal flow nodes to stage for project 38d8580f-50dc-4c42-a183-a7b0b4dca6b3
-- Stage: venueId=35, stageId=119, locationId=119
-- This retroactively assigns all signal flow nodes to location_id 119:
--   - Mic nodes (gear_type='source')
--   - Transformers (gear_type='transformer')
--   - Recorders (gear_type='recorder')
--   - Venue sources (gear_type='venue_sources')

-- PREVIEW: See what nodes will be updated (run this first to verify)
-- SELECT 
--   id,
--   label,
--   gear_id,
--   gear_type,
--   type,
--   location_id as current_location_id,
--   CASE 
--     WHEN gear_type = 'source' OR type = 'source' THEN 'Mic/Source'
--     WHEN gear_type = 'transformer' OR type = 'transformer' THEN 'Transformer'
--     WHEN gear_type = 'recorder' OR type = 'recorder' THEN 'Recorder'
--     WHEN gear_type = 'venue_sources' OR type = 'venue_sources' THEN 'Venue Sources'
--     ELSE 'Other'
--   END as node_category
-- FROM nodes
-- WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
--   AND (
--     (gear_type = 'source' OR type = 'source') OR
--     (gear_type = 'transformer' OR type = 'transformer') OR
--     (gear_type = 'recorder' OR type = 'recorder') OR
--     (gear_type = 'venue_sources' OR type = 'venue_sources')
--   )
--   AND (location_id IS NULL OR location_id != 119)
-- ORDER BY node_category, label;

-- Update all signal flow nodes to location_id 119
UPDATE nodes
SET location_id = 119
WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND (
    (gear_type = 'source' OR type = 'source') OR
    (gear_type = 'transformer' OR type = 'transformer') OR
    (gear_type = 'recorder' OR type = 'recorder') OR
    (gear_type = 'venue_sources' OR type = 'venue_sources')
  )
  AND (location_id IS NULL OR location_id != 119);

-- Update all connections associated with these signal flow nodes
-- Connections should match the location_id of their nodes
UPDATE connections
SET location_id = 119
WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND (
    from_node_id IN (
      SELECT id 
      FROM nodes 
      WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
        AND (
          (gear_type = 'source' OR type = 'source') OR
          (gear_type = 'transformer' OR type = 'transformer') OR
          (gear_type = 'recorder' OR type = 'recorder') OR
          (gear_type = 'venue_sources' OR type = 'venue_sources')
        )
        AND location_id = 119
    )
    OR to_node_id IN (
      SELECT id 
      FROM nodes 
      WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
        AND (
          (gear_type = 'source' OR type = 'source') OR
          (gear_type = 'transformer' OR type = 'transformer') OR
          (gear_type = 'recorder' OR type = 'recorder') OR
          (gear_type = 'venue_sources' OR type = 'venue_sources')
        )
        AND location_id = 119
    )
  )
  AND (location_id IS NULL OR location_id != 119);

-- Show summary of updated nodes by category
SELECT 
  CASE 
    WHEN gear_type = 'source' OR type = 'source' THEN 'Mic/Source'
    WHEN gear_type = 'transformer' OR type = 'transformer' THEN 'Transformer'
    WHEN gear_type = 'recorder' OR type = 'recorder' THEN 'Recorder'
    WHEN gear_type = 'venue_sources' OR type = 'venue_sources' THEN 'Venue Sources'
    ELSE 'Other'
  END as node_category,
  COUNT(*) as nodes_count,
  COUNT(DISTINCT gear_id) as unique_gear_types
FROM nodes
WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND (
    (gear_type = 'source' OR type = 'source') OR
    (gear_type = 'transformer' OR type = 'transformer') OR
    (gear_type = 'recorder' OR type = 'recorder') OR
    (gear_type = 'venue_sources' OR type = 'venue_sources')
  )
  AND location_id = 119
GROUP BY node_category
ORDER BY node_category;

-- Verify track list data integrity
-- connection_port_map and venue_source_feeds are linked via connection_id/node_id
-- so they will automatically work with the updated connections and nodes
SELECT 
  'Connections updated' as data_type,
  COUNT(*) as count
FROM connections
WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND location_id = 119

UNION ALL

SELECT 
  'Port maps linked to updated connections' as data_type,
  COUNT(DISTINCT cpm.connection_id) as count
FROM connection_port_map cpm
INNER JOIN connections c ON cpm.connection_id = c.id
WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND c.location_id = 119

UNION ALL

SELECT 
  'Venue source feeds linked to updated nodes' as data_type,
  COUNT(DISTINCT vsf.node_id) as count
FROM venue_source_feeds vsf
INNER JOIN nodes n ON vsf.node_id = n.id
WHERE n.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND n.location_id = 119;

