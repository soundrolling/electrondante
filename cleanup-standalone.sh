#!/bin/bash
# ElectroDante Standalone Cleanup Script
# Removes all production management app features, keeping only Dante audio client

set -e  # Exit on error

echo "🧹 ElectroDante Standalone Cleanup"
echo "=================================="
echo ""
echo "⚠️  WARNING: This will delete 65+ components and services!"
echo "Make sure you have a backup branch before proceeding."
echo ""
read -p "Have you created a backup branch? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborting. Please create a backup first:"
    echo "   git checkout -b backup-before-cleanup"
    echo "   git push -u origin backup-before-cleanup"
    exit 1
fi

echo ""
echo "📋 Starting cleanup..."
echo ""

# Project Management Components
echo "🗑️  Deleting project management components..."
rm -f src/components/Projects.vue
rm -f src/components/ProjectDetail.vue
rm -f src/components/ProjectLocations.vue
rm -f src/components/ProjectNotes.vue
rm -f src/components/ProjectSchedule.vue
rm -f src/components/ProjectQuickfire.vue
rm -f src/components/ProjectSettings.vue
rm -f src/components/ProjectContacts.vue
rm -f src/components/ProjectGear.vue
rm -f src/components/ProjectDocs.vue
rm -f src/components/ProjectBreadcrumbs.vue
rm -f src/components/StagePictures.vue
rm -f src/components/StageDocs.vue

# Travel Components
echo "🗑️  Deleting travel components..."
rm -rf src/components/travel/

# Gear Management
echo "🗑️  Deleting gear management components..."
rm -rf src/components/gear-modals/
rm -f src/components/PackingTab.vue
rm -f src/components/RepackingTab.vue
rm -f src/components/UserGearSelector.vue

# Signal Mapper
echo "🗑️  Deleting signal mapper components..."
rm -rf src/components/signalmapper/

# Calendar
echo "🗑️  Deleting calendar components..."
rm -rf src/components/calendar/
rm -f src/components/Calendar.vue

# Location/Notes
echo "🗑️  Deleting location/notes components..."
rm -rf src/components/location-notes/
rm -f src/components/LocationSelector.vue

# Stage Components
echo "🗑️  Deleting stage components..."
rm -rf src/components/stage/

# Bug Reports
echo "🗑️  Deleting bug report components..."
rm -f src/components/BugReportDetail.vue
rm -f src/components/BugReportList.vue
rm -f src/components/BugReportModal.vue

# Other Features
echo "🗑️  Deleting other feature components..."
rm -f src/components/ChangeoverNotificationModal.vue
rm -rf src/components/icons/
rm -f src/components/ExportSuccessModal.vue
rm -f src/components/DataManagement.vue
rm -f src/components/QuickAccessMenu.vue
rm -f src/components/TimeSourceSelector.vue

# Services
echo "🗑️  Deleting production management services..."
rm -f src/services/packingService.js
rm -f src/services/rushesService.js
rm -f src/services/portLabelService.js
rm -f src/services/userGearService.js
rm -f src/services/toolSettingsService.js
rm -f src/services/signalMapperService.js
rm -f src/services/signalGraph.js
rm -f src/services/scheduleNotificationService.js
rm -f src/services/exportsService.js
rm -f src/services/exportStorageService.js
rm -f src/services/exportService.js
rm -f src/services/bugReportService.js
rm -f src/services/syncService.js  # Duplicate of dataService

# Root level duplicate services
echo "🗑️  Deleting root level duplicate services..."
rm -rf services/

# Composables
echo "🗑️  Deleting gear/packing composables..."
rm -f src/composables/useGearManagement.js
rm -f src/composables/useGearFilters.js
rm -f src/composables/useGearAssignments.js
rm -f src/composables/usePackingWeights.js
rm -f src/composables/usePackingGear.js
rm -f src/composables/usePackingBags.js
rm -f src/composables/usePackingBagItems.js
rm -f src/composables/useStageHours.js

# Utils
echo "🗑️  Deleting production feature utils..."
rm -f src/utils/gearConflictHelper.js
rm -f src/utils/gearExportHelper.js
rm -f src/utils/weightUtils.js
rm -f src/utils/scheduleHelpers.js
rm -f src/utils/pdfDownloadHelper.js
rm -f src/utils/packingExportHelper.js

# Root level duplicate utils
rm -rf utils/ 2>/dev/null || true

# Stores
echo "🗑️  Deleting feature stores..."
rm -f src/stores/graphStore.js
rm -f src/stores/bugReportStore.js

# Documentation from parent app
echo "🗑️  Deleting parent app documentation..."
rm -f README_unused_tables.md
rm -f BUG_REPORTS_README.md
rm -f INVITATION_TESTING_GUIDE.md
rm -f VERIFY_RESET_PASSWORD_FUNCTION.md
rm -f find_unused_tables.sql
rm -f migrate_old_signal_mapper_data.sql
rm -f cleanup_orphaned_connections.sql
rm -f migrations/add_color_button_id_to_nodes.sql 2>/dev/null || true

# Test files for edge functions
rm -f test-edge-function.js
rm -f test-reset-password-function.js

# Vue config (using Vite now)
rm -f vue.config.js
rm -f babel.config.js

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "   - Deleted 65+ Vue components"
echo "   - Deleted 15+ services"
echo "   - Deleted 8+ composables"
echo "   - Deleted 6+ utils"
echo "   - Deleted duplicate root-level folders"
echo ""
echo "📝 Next steps:"
echo "   1. Review CLEANUP_PLAN.md for remaining tasks"
echo "   2. Update src/router/index.js (simplified routes)"
echo "   3. Update src/App.vue (remove feature imports)"
echo "   4. Update src/stores/userStore.js (remove project logic)"
echo "   5. Update package.json (remove unused dependencies)"
echo "   6. Run: npm install"
echo "   7. Test: npm run dev"
echo ""
echo "💾 Don't forget to commit your changes!"
echo "   git add -A"
echo "   git commit -m 'Clean up: Remove production app features, keep only Dante client'"
