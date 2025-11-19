# ElectroDante Standalone Cleanup Plan

## Goal
Transform from production management app with Dante features → Standalone Dante audio client

## What ElectroDante IS
- Electron app for capturing audio from Dante Virtual Soundcard
- Railway bridge server for relaying audio streams
- Web UI for monitoring/mixing Dante audio channels
- Supabase authentication for broadcasters and listeners
- Room-based broadcasting (one broadcaster, multiple listeners)

## What ElectroDante IS NOT
- Project management system
- Travel planning tool
- Gear/equipment tracker
- Signal flow mapper
- Calendar/scheduling app
- Note-taking app

---

## 🗑️ COMPONENTS TO DELETE (65+ files)

### Project Management Components (DELETE ALL)
```
src/components/Projects.vue
src/components/ProjectDetail.vue
src/components/ProjectLocations.vue
src/components/ProjectNotes.vue
src/components/ProjectSchedule.vue
src/components/ProjectQuickfire.vue
src/components/ProjectSettings.vue
src/components/ProjectContacts.vue
src/components/ProjectGear.vue
src/components/ProjectDocs.vue
src/components/ProjectBreadcrumbs.vue
src/components/StagePictures.vue
src/components/StageDocs.vue
```

### Travel Components (DELETE ALL)
```
src/components/travel/TravelDashboard.vue
src/components/travel/FlightDetails.vue
src/components/travel/Accommodations.vue
src/components/travel/Documents.vue
src/components/travel/Expenses.vue
src/components/travel/Parking.vue
src/components/travel/Packing.vue
src/components/travel/Weather.vue
src/components/travel/TravelTripDetail.vue
```

### Gear Management (DELETE ALL)
```
src/components/gear-modals/AddGearModal.vue
src/components/gear-modals/EditGearModal.vue
src/components/gear-modals/GearAssignmentModal.vue
src/components/gear-modals/GearInfoModal.vue
src/components/gear-modals/ReorderGearModal.vue
src/components/PackingTab.vue
src/components/RepackingTab.vue
src/components/UserGearSelector.vue
```

### Signal Mapper Components (DELETE ALL)
```
src/components/signalmapper/SignalMapper.vue
src/components/signalmapper/SignalMapperParent.vue
src/components/signalmapper/SignalFlow.vue
src/components/signalmapper/MicPlacement.vue
src/components/signalmapper/NodeInspector.vue
src/components/signalmapper/TrackList.vue
src/components/signalmapper/DanteConfig.vue
src/components/signalmapper/InputModal.vue
src/components/signalmapper/ConnectionDetailsModal.vue
src/components/signalmapper/NodeConnectionMatrixModal.vue
src/components/signalmapper/SignalMapperDocumentation.vue
src/components/signalmapper/VenueSourcesConfigModal.vue
```

### Calendar Components (DELETE ALL)
```
src/components/calendar/Calendar.vue
src/components/calendar/CalendarMain.vue
src/components/calendar/CalendarGridView.vue
src/components/calendar/CalendarListView.vue
src/components/calendar/CalendarTimelineView.vue
src/components/calendar/CalendarFilters.vue
src/components/calendar/CalendarLegend.vue
src/components/calendar/CalendarViewSelector.vue
src/components/calendar/NewEventModal.vue
src/components/calendar/EventDetailsModal.vue
src/components/calendar/ConfirmationModal.vue
```

### Location/Notes Components (DELETE ALL)
```
src/components/location-notes/LocationNotes.vue
src/components/location-notes/LNTabNotes.vue
src/components/location-notes/LNTabQuickfire.vue
src/components/location-notes/LNTabSchedule.vue
src/components/LocationSelector.vue
```

### Stage Components (DELETE ALL)
```
src/components/stage/StageQuickAccessMenu.vue
```

### Bug Reports (DELETE ALL)
```
src/components/BugReportDetail.vue
src/components/BugReportList.vue
src/components/BugReportModal.vue
```

### Other Feature Components (DELETE)
```
src/components/ChangeoverNotificationModal.vue
src/components/icons/ChangeoverIcon.vue
src/components/ExportSuccessModal.vue
src/components/DataManagement.vue
src/components/QuickAccessMenu.vue
src/components/TimeSourceSelector.vue
```

---

## ✅ COMPONENTS TO KEEP (Essential)

### Authentication (KEEP)
```
src/components/Login.vue
src/components/SetPassword.vue
src/components/ResetPassword.vue
src/components/ConfirmEmail.vue
```

### Dante Audio Core (KEEP - THE MAIN APP)
```
src/components/tools/DanteMonitorMixer.vue
src/components/tools/DanteChannelStrip.vue
```

### Layout (KEEP - Simplified)
```
src/components/Header.vue
src/components/Footer.vue
src/components/OfflinePage.vue
```

### User Management (KEEP - Basic profile)
```
src/components/UserProfile.vue
```

### Optional Tools (EVALUATE)
```
src/components/tools/AudioSignalGenerator.vue - Keep for testing?
src/components/tools/LTCTimecodeGenerator.vue - Keep if needed for Dante?
```

---

## 🗑️ SERVICES TO DELETE

```bash
# Project/Production management
src/services/packingService.js
src/services/rushesService.js
src/services/portLabelService.js
src/services/userGearService.js
src/services/toolSettingsService.js
src/services/signalMapperService.js
src/services/signalGraph.js
src/services/scheduleNotificationService.js
src/services/exportsService.js
src/services/exportStorageService.js
src/services/exportService.js

# Bug reports
src/services/bugReportService.js

# Root level duplicates (if bridge-server has versions)
services/packingService.js
services/dataService.js
services/bugReportService.js
services/userGearService.js
services/syncService.js
services/signalMapperService.js
services/pwaService.js
```

---

## ✅ SERVICES TO KEEP

```bash
# Core functionality
src/services/dataService.js - Basic CRUD operations
src/services/cacheService.js - Offline support
src/services/pwaService.js - PWA features (if needed)

# Bridge server services (CRITICAL)
bridge-server/server.js
bridge-server/client.js
bridge-server/electron-app/services/auth-client.js
bridge-server/electron-app/services/audio-listener.js
```

---

## 🗑️ COMPOSABLES TO DELETE

```bash
src/composables/useGearManagement.js
src/composables/useGearFilters.js
src/composables/useGearAssignments.js
src/composables/usePackingWeights.js
src/composables/usePackingGear.js
src/composables/usePackingBags.js
src/composables/usePackingBagItems.js
src/composables/useStageHours.js
```

---

## ✅ COMPOSABLES TO KEEP

```bash
src/composables/useDanteMixer.js - CORE
src/composables/useConnectionQuality.js - CORE
src/composables/useAudioCapture.js - CORE
src/composables/useJitterBuffer.js - CORE
src/composables/useOpusDecoder.js - CORE
src/composables/useAuth.js - Authentication
src/composables/useOnline.js - Network status
src/composables/useSupabase.js - Database
```

---

## 🗑️ UTILS TO DELETE

```bash
src/utils/gearConflictHelper.js
src/utils/gearExportHelper.js
src/utils/weightUtils.js
src/utils/scheduleHelpers.js
src/utils/pdfDownloadHelper.js
src/utils/packingExportHelper.js

# Root level duplicates
utils/gearConflictHelper.js
utils/weightUtils.js
utils/scheduleHelpers.js
utils/indexedDB.js (if duplicate of src/utils/indexedDB.js)
```

---

## ✅ UTILS TO KEEP

```bash
src/utils/indexedDB.js - Offline storage
```

---

## 🗑️ STORES TO DELETE

```bash
src/stores/graphStore.js - Signal mapper feature
src/stores/bugReportStore.js - Bug reports feature
```

---

## ✅ STORES TO KEEP

```bash
src/stores/userStore.js - But needs SIMPLIFICATION (remove project logic)
src/stores/themeStore.js - UI theme
```

---

## 🗑️ DEPENDENCIES TO REMOVE

From `package.json`:

```json
// Document/PDF generation (not needed)
"html2canvas": "^1.4.1",
"html2pdf.js": "^0.10.2",
"jspdf": "^3.0.1",
"jspdf-autotable": "^5.0.2",
"jszip": "^3.10.1",
"papaparse": "^5.4.1",
"pdfjs-dist": "^4.6.82",

// Drawing/canvas (signal mapper feature)
"konva": "^9.3.20",
"vue-konva": "^3.2.1",
"panzoom": "^9.4.3",

// Maps (travel feature)
"leaflet": "^1.9.4",
"vue-leaflet": "^0.1.0",

// Flow charts (signal mapper)
"@vue-flow/controls": "^1.1.2",
"@vue-flow/core": "^1.42.5",
"@vueuse/gesture": "^2.0.0",

// Alerts (can use native browser or simpler alternative)
"sweetalert2": "^11.6.13",

// Drag and drop (gear/packing feature)
"vuedraggable": "^4.1.0",

// HCaptcha (if not using)
"@hcaptcha/vue3-hcaptcha": "^1.3.0",

// Auth UI React (wrong framework, not needed)
"@supabase/auth-ui-react": "^0.4.7",

// Axios (if not using, Supabase handles requests)
"axios": "^1.7.7"
```

**Estimated reduction:** ~15-20 dependencies removed

---

## 📝 NEW SIMPLIFIED STRUCTURE

```
electrondante/
├── bridge-server/              # Railway relay server + Electron app
│   ├── server.js              # WebSocket relay server
│   ├── client.js              # Test client
│   ├── electron-app/          # Desktop app for broadcasters
│   │   ├── main.js           # Electron main process
│   │   ├── preload.js        # IPC bridge
│   │   ├── index.html        # Broadcaster UI
│   │   ├── admin.html        # Admin panel
│   │   ├── client-core.js    # Audio capture
│   │   ├── opus-encoder.js   # Audio encoding
│   │   ├── opus-decoder.js   # Audio decoding
│   │   └── services/
│   │       ├── auth-client.js
│   │       └── audio-listener.js
│   └── package.json
│
├── src/
│   ├── components/
│   │   ├── Login.vue          # Auth
│   │   ├── SetPassword.vue    # Auth
│   │   ├── ResetPassword.vue  # Auth
│   │   ├── ConfirmEmail.vue   # Auth
│   │   ├── Header.vue         # Layout
│   │   ├── Footer.vue         # Layout
│   │   ├── UserProfile.vue    # Basic profile
│   │   ├── OfflinePage.vue    # Error page
│   │   └── tools/
│   │       ├── DanteMonitorMixer.vue      # MAIN APP
│   │       └── DanteChannelStrip.vue
│   │
│   ├── composables/
│   │   ├── useDanteMixer.js       # Audio mixing
│   │   ├── useAudioCapture.js     # Audio capture
│   │   ├── useConnectionQuality.js
│   │   ├── useJitterBuffer.js
│   │   ├── useOpusDecoder.js
│   │   ├── useAuth.js
│   │   ├── useOnline.js
│   │   └── useSupabase.js
│   │
│   ├── services/
│   │   ├── dataService.js        # CRUD + sync
│   │   └── cacheService.js
│   │
│   ├── stores/
│   │   ├── userStore.js          # User state (simplified)
│   │   └── themeStore.js
│   │
│   ├── utils/
│   │   └── indexedDB.js
│   │
│   ├── router/
│   │   └── index.js              # Simplified routes
│   │
│   ├── App.vue                   # Simplified
│   ├── main.js                   # Entry point
│   ├── supabase.js              # Supabase client
│   └── config.js                # Configuration
│
├── public/
│   └── service-worker.js
│
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env                          # Environment variables
```

---

## 🎯 SIMPLIFIED ROUTER

New `src/router/index.js`:

```javascript
import { createRouter, createWebHistory } from 'vue-router';
import { defineAsyncComponent } from 'vue';
import { useUserStore } from '../stores/userStore';

// Auth components
const Login = defineAsyncComponent(() => import('../components/Login.vue'));
const ConfirmEmail = defineAsyncComponent(() => import('../components/ConfirmEmail.vue'));
const SetPassword = defineAsyncComponent(() => import('../components/SetPassword.vue'));
const ResetPassword = defineAsyncComponent(() => import('../components/ResetPassword.vue'));
const OfflinePage = defineAsyncComponent(() => import('../components/OfflinePage.vue'));

// Main app component
const DanteMonitorMixer = defineAsyncComponent(() => import('../components/tools/DanteMonitorMixer.vue'));

// User profile
const UserProfile = defineAsyncComponent(() => import('../components/UserProfile.vue'));

const routes = [
  // Auth routes
  { path: '/', name: 'Login', component: Login },
  { path: '/auth/confirm', name: 'ConfirmEmail', component: ConfirmEmail },
  { path: '/auth/set-password', name: 'SetPassword', component: SetPassword },
  { path: '/auth/reset-password', name: 'ResetPassword', component: ResetPassword },
  { path: '/offline', name: 'Offline', component: OfflinePage },

  // Main app
  { path: '/mixer', name: 'DanteMonitorMixer', component: DanteMonitorMixer },

  // User profile
  { path: '/profile/:tab?', name: 'UserProfile', component: UserProfile, props: true },

  // 404
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: OfflinePage }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();
  const publicPages = ['Login', 'ConfirmEmail', 'SetPassword', 'ResetPassword', 'Offline'];
  const isPublicPage = publicPages.includes(to.name);

  if (!userStore.isAuthenticated) {
    await userStore.fetchUserSession();
  }

  if (!userStore.isAuthenticated && !isPublicPage) {
    return next({ name: 'Login' });
  }

  if (userStore.isAuthenticated && isPublicPage) {
    return next({ name: 'DanteMonitorMixer' });
  }

  next();
});

export default router;
```

---

## 📋 EXECUTION CHECKLIST

### Phase 1: Backup
- [ ] Commit current state to git
- [ ] Create backup branch: `git checkout -b backup-before-cleanup`
- [ ] Push backup: `git push -u origin backup-before-cleanup`

### Phase 2: Delete Components (65+ files)
- [ ] Delete project management components (13 files)
- [ ] Delete travel components (9 files)
- [ ] Delete gear components (8 files)
- [ ] Delete signal mapper components (12 files)
- [ ] Delete calendar components (11 files)
- [ ] Delete location/notes components (5 files)
- [ ] Delete bug report components (3 files)
- [ ] Delete other feature components (4 files)

### Phase 3: Delete Services
- [ ] Delete production management services (11 files)
- [ ] Delete root-level duplicate services
- [ ] Fix duplicate syncOfflineChanges

### Phase 4: Delete Composables
- [ ] Delete gear/packing composables (8 files)

### Phase 5: Delete Utils
- [ ] Delete production feature utils (6 files)
- [ ] Remove root-level duplicate utils

### Phase 6: Update Configuration
- [ ] Simplify `src/router/index.js` (use new version above)
- [ ] Simplify `src/App.vue` (remove project features)
- [ ] Simplify `src/stores/userStore.js` (remove project logic)
- [ ] Update `package.json` (remove unused dependencies)
- [ ] Remove unused stores

### Phase 7: Test
- [ ] Run `npm install` to update dependencies
- [ ] Test authentication flow
- [ ] Test DanteMonitorMixer component
- [ ] Test Electron app
- [ ] Test bridge server

---

## 💾 ESTIMATED SIZE REDUCTION

- **Components:** 80 → 10 (87% reduction)
- **Services:** 15 → 2 (86% reduction)
- **Composables:** 16 → 8 (50% reduction)
- **Dependencies:** ~45 → ~25 (44% reduction)
- **Total bundle size:** Estimated 60-70% reduction

---

## 🚀 POST-CLEANUP TASKS

1. Create proper README for standalone Dante client
2. Remove all project-related documentation
3. Update package.json name/description
4. Create environment variable template (.env.example)
5. Simplify landing page to go directly to mixer
6. Remove project selection logic from userStore
7. Update branding (currently "Spatial HQ" → "Dante Audio Client")
