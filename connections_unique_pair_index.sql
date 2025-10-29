-- Ensure only one parent connection per device pair for non-source connections
-- This allows port mappings to be managed through connection_port_map

CREATE UNIQUE INDEX IF NOT EXISTS connections_unique_source_to_target
ON connections (project_id, from_node_id, to_node_id)
WHERE from_node_id IS NOT NULL AND to_node_id IS NOT NULL;

COMMENT ON INDEX connections_unique_source_to_target IS 'Ensures one parent connection per device pair for port-mapped connections';

