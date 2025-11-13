-- Migration: Add phantom_power column to nodes table
-- This allows source nodes to have a default phantom power setting
-- that can be applied when creating connections from that source

ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS phantom_power BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.nodes.phantom_power IS 'Default phantom power setting for this source node. When true, indicates +48V phantom power should be enabled for connections from this source.';

