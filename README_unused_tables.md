# Finding Unused Supabase Tables

This SQL file helps identify tables in your Supabase database that are not being used by the application.

## How to Use

1. **Open Supabase SQL Editor**
2. **Run query 1** to see all tables in your database
3. **Run query 8** (in STEP 3) to find tables NOT in the used list - this is the main query
4. **Review queries 2-7** for additional insights

## Tables Confirmed as USED (from codebase scan)

Based on scanning the codebase for `.from()` calls, these tables are actively used:

### Signal Mapper
- `nodes`
- `connections`
- `connection_port_map`

### Projects & Locations
- `projects`
- `project_members`
- `project_details`
- `project_contacts`
- `project_docs`
- `locations`
- `venues`
- `stage_hours`

### Gear
- `gear_table`
- `gear_assignments`
- `user_gear`
- `user_gear_view`
- `gear_bags`
- `gear_bag_items`
- `gear-bag-images` (hyphenated - might be old)

### Calendar
- `calendar_events`

### Travel
- `travel_trips`
- `travel_trip_members`
- `travel_flights`
- `travel_accommodations`
- `travel_accommodation_members`
- `travel_documents`
- `travel_expenses`
- `travel_parking`
- `travel_rental_cars`
- `travel_local_transport`
- `travel-documents` (hyphenated - might be old)
- `travel-expenses` (hyphenated - might be old)

### Documents & Pictures
- `stage_docs`
- `stage_pictures`
- `stage-docs` (hyphenated - might be old)
- `stage-pictures` (hyphenated - might be old)

### User
- `user_profiles`

### Other
- `bug_reports`
- `bug_report_comments`
- `quickfire_buttons`

## Important Notes

### Hyphenated Tables (Old Naming Convention)
Some tables use hyphens instead of underscores:
- `stage-docs` vs `stage_docs`
- `stage-pictures` vs `stage_pictures`
- `travel-documents` vs `travel_documents`
- `travel-expenses` vs `travel_expenses`
- `gear-bag-images`

These might be old tables that can be removed if the underscore versions are being used.

### Old Signal Mapper Tables
The codebase search shows the current signal mapper uses:
- `nodes`
- `connections`
- `connection_port_map`

Any other tables with names like:
- `signal_*`
- `mapper_*`
- `mic_placement*`
- `signal_flow*`
- `track_list*`
- `quickfire*` (old name for signal mapper)

Might be from old implementations and could potentially be removed.

## Recommended Workflow

1. **Run Query 8** (STEP 3) - Find unused tables
2. **Run Query 2** (STEP 4) - See all tables with status
3. **Run Query 5** (STEP 7) - Find old signal mapper tables
4. **Check for empty tables** - Manually check if unused tables have data
5. **Backup before deletion** - Always backup before removing tables
6. **Verify** - After identifying unused tables, verify they're not used by:
   - Database triggers
   - Stored procedures
   - External services
   - Future features

## Safety

- All queries are **read-only** (SELECT statements)
- No DELETE operations are included
- Always backup your database before removing tables
- Verify tables are truly unused by checking:
  - Foreign key relationships
  - Row counts
  - Last modified dates (if available)
  - Application logs

