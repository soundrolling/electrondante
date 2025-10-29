-- Add separate coordinates for Signal Flow layout so mic placement can differ

ALTER TABLE nodes
ADD COLUMN IF NOT EXISTS flow_x DECIMAL,
ADD COLUMN IF NOT EXISTS flow_y DECIMAL;

COMMENT ON COLUMN nodes.flow_x IS 'Normalized X (0..1) for Signal Flow layout';
COMMENT ON COLUMN nodes.flow_y IS 'Normalized Y (0..1) for Signal Flow layout';


