// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { defineAsyncComponent }      from 'vue';
import { useUserStore }              from '../stores/userStore';

import Projects      from '../components/Projects.vue';
import ProjectDetail from '../components/ProjectDetail.vue';

// Public / Auth
const Login         = defineAsyncComponent(() => import('../components/Login.vue'));
const MagicLink     = defineAsyncComponent(() => import('../components/MagicLink.vue'));
const ConfirmEmail  = defineAsyncComponent(() => import('../components/ConfirmEmail.vue'));
const SetPassword   = defineAsyncComponent(() => import('../components/SetPassword.vue'));
const ResetPassword = defineAsyncComponent(() => import('../components/ResetPassword.vue'));
const OfflinePage   = defineAsyncComponent(() => import('../components/OfflinePage.vue'));

// Project sub-pages
const ProjectLocations = defineAsyncComponent(() => import('../components/ProjectLocations.vue'));
const ProjectNotes     = defineAsyncComponent(() => import('../components/ProjectNotes.vue'));
const ProjectSchedule  = defineAsyncComponent(() => import('../components/ProjectSchedule.vue'));
const Calendar         = defineAsyncComponent(() => import('../components/Calendar.vue'));
const ProjectQuickfire = defineAsyncComponent(() => import('../components/ProjectQuickfire.vue'));
const ProjectPatchBay  = defineAsyncComponent(() => import('../components/patchbay/ProjectPatchBay.vue'));

// Travel
const TravelDashboard = defineAsyncComponent(() => import('../components/travel/TravelDashboard.vue'));
const FlightDetails   = defineAsyncComponent(() => import('../components/travel/FlightDetails.vue'));
const Accommodations  = defineAsyncComponent(() => import('../components/travel/Accommodations.vue'));
const Documents       = defineAsyncComponent(() => import('../components/travel/Documents.vue'));
const Expenses        = defineAsyncComponent(() => import('../components/travel/Expenses.vue'));
const TravelTripDetail = defineAsyncComponent(() => import('../components/travel/TravelTripDetail.vue'));
const Parking         = defineAsyncComponent(() => import('../components/travel/Parking.vue'));

// Other project components
const ProjectGear     = defineAsyncComponent(() => import('../components/ProjectGear.vue'));
const ProjectContacts = defineAsyncComponent(() => import('../components/ProjectContacts.vue'));
const ProjectSettings = defineAsyncComponent(() => import('../components/ProjectSettings.vue'));
const UserProfile     = defineAsyncComponent(() => import('../components/UserProfile.vue'));

const LocationNotes = defineAsyncComponent(() => import('../components/location-notes/LocationNotes.vue'));
const StagePictures = defineAsyncComponent(() => import('../components/StagePictures.vue'));
const StageDocs     = defineAsyncComponent(() => import('../components/StageDocs.vue'));
const ProjectDocs   = defineAsyncComponent(() => import('../components/ProjectDocs.vue'));

const SignalMapper = defineAsyncComponent(() => import('../components/signalmapper/SignalMapper.vue'));

const routes = [
  // Public / Auth
  { path: '/',                    name: 'Login',            component: Login },
  { path: '/magic-link',          name: 'MagicLink',        component: MagicLink },
  { path: '/auth/confirm',        name: 'ConfirmEmail',     component: ConfirmEmail },
  { path: '/auth/set-password',   name: 'SetPassword',      component: SetPassword },
  { path: '/auth/reset-password', name: 'ResetPassword',    component: ResetPassword },
  { path: '/offline',             name: 'Offline',          component: OfflinePage },

  // Top-level
  { path: '/projects', name: 'Projects',    component: Projects },
  { path: '/profile', redirect: '/profile/profile' },
  { path: '/profile/:tab', name: 'UserProfile', component: UserProfile, props: true },

  // Project hierarchy
  { path: '/projects/:id',            name: 'ProjectDetail',    component: ProjectDetail,     props: true },
  { path: '/projects/:id/locations',  name: 'ProjectLocations', component: ProjectLocations, props: true },
  { path: '/projects/:id/notes',      name: 'ProjectNotes',     component: ProjectNotes,     props: r => ({ locationId: r.query.locationId }) },
  { path: '/projects/:id/schedule',   name: 'ProjectSchedule',  component: ProjectSchedule,  props: r => ({ locationId: r.query.locationId }) },
  { path: '/projects/:id/calendar',   name: 'Calendar',         component: Calendar,         props: true },

  // Quickfire / micmapper
  { path: '/projects/:id/quickfire',  name: 'ProjectQuickfire', component: ProjectQuickfire, props: r => ({ locationId: r.query.locationId }) },
  { path: '/projects/:id/signal-mapper', name: 'SignalMapper', component: SignalMapper, props: r => ({
      projectId: r.params.id,
      venueId:   r.query.venueId,
      stageId:   r.query.stageId,
      locationId: r.query.locationId
    })
  },

  // Docs & pictures
  { path: '/projects/:id/photos',     name: 'StagePictures',    component: StagePictures,    props: r => ({
      projectId: r.params.id,
      venueId:   r.query.venueId,
      stageId:   r.query.stageId
    })
  },
  { path: '/projects/:id/docs',       name: 'ProjectDocs',      component: ProjectDocs,      props: r => ({ projectId: r.params.id }) },
  { path: '/projects/:id/stage-docs', name: 'StageDocs',        component: StageDocs,        props: r => ({
      projectId: r.params.id,
      venueId:   r.query.venueId,
      stageId:   r.query.stageId
    })
  },

  // Travel detail pages
  { path: '/projects/:id/travel-dashboard',          name: 'TravelDashboard', component: TravelDashboard, props: true },
  { path: '/projects/:id/flightdetails/:tripId',     name: 'FlightDetails',   component: FlightDetails,   props: true },
  { path: '/projects/:id/accommodations/:tripId',    name: 'Accommodations',  component: Accommodations,  props: true },
  { path: '/projects/:id/documents/:tripId',         name: 'Documents',       component: Documents,       props: true },
  { path: '/projects/:id/expenses/:tripId',          name: 'Expenses',        component: Expenses,        props: true },

  // Gear, Contacts, Settings
  { path: '/projects/:id/gear',      name: 'ProjectGear',     component: ProjectGear,     props: r => ({ locationId: r.query.locationId, tab: r.query.tab }) },
  { path: '/projects/:id/packing',    name: 'ProjectPacking',  component: ProjectGear,     props: r => ({ locationId: r.query.locationId, tab: 'packing' }) },
  { path: '/projects/:id/contacts',  name: 'ProjectContacts', component: ProjectContacts, props: true },
  { path: '/projects/:id/settings',  name: 'ProjectSettings', component: ProjectSettings, props: true },

  // Location-specific notes
  { path: '/projects/:id/locations/:locationId/notes', name: 'LocationNotes', component: LocationNotes, props: true },

  // Travel trip detail
  { path: '/projects/:projectId/trips/:tripId/detail', name: 'TravelTripDetail', component: TravelTripDetail, props: route => ({
    projectId: route.params.projectId,
    tripId: route.params.tripId,
    tripName: route.params.tripName,
    tripDates: route.params.tripDates,
    tripDestination: route.params.tripDestination
  }) },

  // Parking
  { path: '/projects/:id/parking/:tripId', name: 'Parking', component: Parking, props: true },

  // 404 fallback
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: OfflinePage }
];

const router = createRouter({
  // No env.BASE_URL here—just default history
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const userStore    = useUserStore();
  const publicPages  = ['Login','MagicLink','ConfirmEmail','SetPassword','ResetPassword','Offline'];
  const isPublicPage = publicPages.includes(to.name);

  if (!userStore.isAuthenticated) {
    await userStore.fetchUserSession();
  }
  if (!userStore.isAuthenticated && !isPublicPage) {
    return next({ name: 'Login' });
  }
  if (userStore.isAuthenticated && isPublicPage) {
    return next({ name: 'Projects' });
  }

  // ensure project membership
  const pid = to.params.id;
  if (pid && !userStore.getCurrentProject) {
    const mem = await userStore.checkProjectMember(userStore.user.email, pid);
    if (mem) {
      userStore.setCurrentProject({ id: pid, role: mem.role });
    } else {
      return next({ name: 'Projects' });
    }
  }

  next();
});

export default router;