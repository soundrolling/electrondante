# Signal Mapper Refactor - Implementation Guide

## Overview

The Signal Mapper has been refactored into a tabbed interface with three distinct sections:
1. **Mic Placement** - Place and rotate microphones on floor plans
2. **Signal Flow** - Connect sources, transformers, and recorders
3. **Track List** - View complete signal routing to recorder tracks

## Database Migrations

Before using the refactored Signal Mapper, you must run the following database migrations:

### 1. Nodes Table Migration

Run this SQL script to add rotation and track_name columns:

```bash
psql your_database < signal_mapper_nodes_migration.sql
```

Or manually execute:
```sql
ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS rotation DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS track_name TEXT;
```

### 2. Connections Table Migration

Run this SQL script to add pad and phantom_power columns:

```bash
psql your_database < signal_mapper_connections_migration.sql
```

Or manually execute:
```sql
ALTER TABLE connections
ADD COLUMN IF NOT EXISTS pad BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phantom_power BOOLEAN DEFAULT false;
```

## New Features

### Tab 1: Mic Placement
- Upload floor plan images
- Place microphones from your gear list
- Rotate mics with visual handle or numeric input (0-360°)
- Assign track names (e.g., "Stage L", "Stage R")
- Mics are automatically available as sources in Tab 2

### Tab 2: Signal Flow
- Sources from Tab 1 appear as read-only nodes
- Add transformers (stage boxes, mixers, etc.)
- Add recorders
- Create connections between nodes
- Specify pad and phantom power (+48V) for each connection
- Assign inputs/outputs and track numbers

### Tab 3: Track List
- Auto-populated from Tab 2 connections
- Shows complete signal paths from source to recorder track
- Displays pad and phantom power settings
- Export to CSV
- Print-friendly format

## Data Flow

```
Tab 1 (Mic Placement) → Tab 2 (Signal Flow) → Tab 3 (Track List)
     Mics with          Connect mics to         View final
     track names        transformers and        track routing
                        recorders
```

## Component Structure

```
SignalMapper.vue (entry point)
└── SignalMapperParent.vue (tab container)
    ├── MicPlacement.vue (Tab 1)
    ├── SignalFlow.vue (Tab 2)
    └── TrackList.vue (Tab 3)

Shared Components:
├── ConnectionDetailsModal.vue (connection creation with pad/phantom)
├── NodeConnectionMatrixModal.vue (bulk connection management)
└── SignalMapperDocumentation.vue (exports and documentation)
```

## API Changes

### signalMapperService.js

New helper functions:
- `getSourceNodes(projectId)` - Get only source nodes
- `getCompleteSignalPath(projectId)` - Build full signal paths for track list

### Node Fields

Nodes now support:
- `rotation` (DECIMAL) - Mic rotation in degrees
- `track_name` (TEXT) - User-defined track name

### Connection Fields

Connections now support:
- `pad` (BOOLEAN) - Pad enabled
- `phantom_power` (BOOLEAN) - Phantom power enabled

## Usage Notes

1. **Start with Mic Placement**: Place your mics first to establish sources
2. **Build Signal Flow**: Connect sources through transformers to recorders
3. **Review Track List**: Verify your complete signal routing

## Troubleshooting

### Migrations Fail
- Ensure you have the correct database permissions
- Check if columns already exist (use `IF NOT EXISTS`)
- Verify table names match your schema

### Mics Don't Appear in Signal Flow
- Ensure mics were created with `gear_type: 'source'` in Tab 1
- Check that nodes are being loaded correctly in SignalMapperParent

### Track List is Empty
- Verify connections have `track_number` assigned
- Ensure connections lead to recorder nodes
- Check that `getCompleteSignalPath()` is working correctly

## Development

To test locally:
1. Run migrations
2. Navigate to `/projects/:id/signal-mapper?locationId=:locationId`
3. Test each tab in sequence

## Migration Checklist

- [ ] Run `signal_mapper_nodes_migration.sql`
- [ ] Run `signal_mapper_connections_migration.sql`
- [ ] Verify migrations in database
- [ ] Test Mic Placement tab
- [ ] Test Signal Flow tab
- [ ] Test Track List tab
- [ ] Test connection creation with pad/phantom power
- [ ] Test exports and documentation

