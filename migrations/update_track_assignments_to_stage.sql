-- Migration: Update track assignments for recording nodes to stage
-- Project: 38d8580f-50dc-4c42-a183-a7b0b4dca6b3
-- Stage: venueId=35, stageId=119, locationId=119
-- This ensures all connections that assign tracks to recorders have location_id = 119

-- PREVIEW: See all track assignments for recorders (run this first to verify)
-- SELECT 
--   c.id as connection_id,
--   c.track_number,
--   c.input_number,
--   c.location_id as current_location_id,
--   from_node.label as source_label,
--   from_node.gear_type as source_type,
--   to_node.label as recorder_label,
--   to_node.gear_type as recorder_type,
--   to_node.num_tracks as recorder_total_tracks
-- FROM connections c
-- INNER JOIN nodes from_node ON c.from_node_id = from_node.id
-- INNER JOIN nodes to_node ON c.to_node_id = to_node.id
-- WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
--   AND (to_node.gear_type = 'recorder' OR to_node.type = 'recorder')
--   AND (c.track_number IS NOT NULL OR c.input_number IS NOT NULL)
-- ORDER BY to_node.label, COALESCE(c.track_number, c.input_number);

-- Update all connections with track assignments (track_number or input_number) 
-- that point to recorders to have location_id = 119
UPDATE connections
SET location_id = 119
WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND (track_number IS NOT NULL OR input_number IS NOT NULL)
  AND to_node_id IN (
    SELECT id 
    FROM nodes 
    WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
      AND (gear_type = 'recorder' OR type = 'recorder')
      AND location_id = 119
  )
  AND (location_id IS NULL OR location_id != 119);

-- Show summary of track assignments by recorder
WITH track_assignments AS (
  SELECT DISTINCT
    c.to_node_id,
    COALESCE(c.track_number, c.input_number) as track_num,
    from_node.label as source_label
  FROM connections c
  INNER JOIN nodes to_node ON c.to_node_id = to_node.id
  INNER JOIN nodes from_node ON c.from_node_id = from_node.id
  WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
    AND (to_node.gear_type = 'recorder' OR to_node.type = 'recorder')
    AND (c.track_number IS NOT NULL OR c.input_number IS NOT NULL)
    AND c.location_id = 119
    AND to_node.location_id = 119
)
SELECT 
  to_node.label as recorder_label,
  to_node.id as recorder_id,
  to_node.num_tracks as total_tracks,
  COUNT(DISTINCT ta.track_num) as assigned_tracks_count,
  STRING_AGG(
    ta.track_num::text, 
    ', ' 
    ORDER BY ta.track_num
  ) as assigned_track_numbers,
  STRING_AGG(
    DISTINCT ta.source_label, 
    ', '
    ORDER BY ta.source_label
  ) as source_labels
FROM nodes to_node
LEFT JOIN track_assignments ta ON to_node.id = ta.to_node_id
WHERE to_node.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND (to_node.gear_type = 'recorder' OR to_node.type = 'recorder')
  AND to_node.location_id = 119
GROUP BY to_node.id, to_node.label, to_node.num_tracks
HAVING COUNT(DISTINCT ta.track_num) > 0
ORDER BY to_node.label;

-- Verify all track assignments are properly linked
SELECT 
  'Track assignments updated' as data_type,
  COUNT(*) as count
FROM connections c
WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND (c.track_number IS NOT NULL OR c.input_number IS NOT NULL)
  AND c.location_id = 119
  AND c.to_node_id IN (
    SELECT id 
    FROM nodes 
    WHERE project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
      AND (gear_type = 'recorder' OR type = 'recorder')
      AND location_id = 119
  )

UNION ALL

SELECT 
  'Recorders with track assignments' as data_type,
  COUNT(DISTINCT c.to_node_id) as count
FROM connections c
INNER JOIN nodes n ON c.to_node_id = n.id
WHERE c.project_id = '38d8580f-50dc-4c42-a183-a7b0b4dca6b3'
  AND (n.gear_type = 'recorder' OR n.type = 'recorder')
  AND (c.track_number IS NOT NULL OR c.input_number IS NOT NULL)
  AND c.location_id = 119
  AND n.location_id = 119;

