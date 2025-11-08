# Authentication Routing Guide

## Overview
This guide documents the authentication and account setup flow for Spatial Notes, including the necessary Supabase configuration.

## Supabase Redirect URL Configuration

In your Supabase Dashboard → Authentication → URL Configuration, you need to configure the following redirect URLs:

### Required Redirect URLs
```
https://pro.soundrolling.com/auth/confirm
https://pro.soundrolling.com/auth/set-password
https://pro.soundrolling.com/auth/*
```

**Note**: The wildcard `auth/*` should cover all auth routes, but it's recommended to explicitly list the specific URLs as well.

### Site URL
Make sure your Site URL is set to:
```
https://pro.soundrolling.com
```

## Authentication Flows

### 1. New User Invitation Flow
**When**: An admin invites a new user who doesn't have an account yet

**Flow**:
1. Admin invites user via Project Settings → Members
2. Supabase sends invitation email with link to: `https://pro.soundrolling.com/auth/confirm#access_token=...&type=invite`
3. User clicks link → `ConfirmEmail.vue` component loads
4. Component detects `type=invite` and redirects to `/auth/set-password` with tokens
5. User sets password in `SetPassword.vue`
6. Component:
   - Calls `supabase.auth.setSession()` to establish session
   - Calls `supabase.auth.updateUser()` to set password
   - Initializes user store (`fetchUserSession()`, `initDB()`, `loadProjectFromLocalStorage()`)
   - Redirects to `/projects`
7. User is now logged in and can access their projects

### 2. Password Reset Flow
**When**: A user requests a password reset from the login page

**Flow**:
1. User goes to `/auth/reset-password`
2. Enters email and clicks "Send Reset Link"
3. Supabase sends email with link to: `https://pro.soundrolling.com/auth/set-password#access_token=...&type=recovery`
4. User clicks link → lands directly on `SetPassword.vue`
5. User sets new password
6. Component initializes session and user store
7. Redirects to `/projects`

### 3. Email Confirmation Flow (Regular Signup)
**When**: A new user signs up directly (if enabled)

**Flow**:
1. User signs up
2. Supabase sends confirmation email with link to: `https://pro.soundrolling.com/auth/confirm#access_token=...`
3. User clicks link → `ConfirmEmail.vue` component loads
4. Component verifies email and establishes session
5. Shows success message and redirects to `/` (login page)
6. User can now log in with their credentials

### 4. Standard Login Flow
**When**: An existing user with a password logs in

**Flow**:
1. User enters email and password on `/` (login page)
2. Calls `supabase.auth.signInWithPassword()`
3. On success:
   - Calls `userStore.fetchUserSession()`
   - Calls `userStore.initDB()`
   - Calls `userStore.loadProjectFromLocalStorage()`
   - Redirects to `/projects`

## Router Configuration

### Public Routes (No Authentication Required)
- `/` - Login page
- `/auth/confirm` - Email confirmation handler
- `/auth/set-password` - Password setup page
- `/auth/reset-password` - Password reset request page
- `/offline` - Offline fallback page

### Protected Routes
All other routes require authentication. The router guard will redirect unauthenticated users to `/` (login page).

### Router Guard Logic
```javascript
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();
  const publicPages = ['Login','ConfirmEmail','SetPassword','ResetPassword','Offline'];
  const isPublicPage = publicPages.includes(to.name);

  // Check authentication
  if (!userStore.isAuthenticated) {
    await userStore.fetchUserSession();
  }
  
  // Redirect unauthenticated users to login
  if (!userStore.isAuthenticated && !isPublicPage) {
    return next({ name: 'Login' });
  }
  
  // Redirect authenticated users away from public pages
  if (userStore.isAuthenticated && isPublicPage) {
    return next({ name: 'Projects' });
  }

  // Check project membership for project routes
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
```

## Key Components

### SetPassword.vue
**Purpose**: Handles password setup for new users and password resets

**Key Features**:
- Parses `access_token` and `refresh_token` from URL hash
- Sets session using `supabase.auth.setSession()`
- Updates password using `supabase.auth.updateUser()`
- Initializes user store (critical for proper authentication)
- Redirects to `/projects` after success

**Recent Fixes**:
- ✅ Now properly initializes user store after setting password
- ✅ Redirects to `/projects` instead of `/` to avoid unnecessary redirects
- ✅ Reduced redirect delay from 3s to 1.5s for better UX

### ConfirmEmail.vue
**Purpose**: Handles email confirmation and routes to appropriate flow

**Key Features**:
- Detects token type (`invite`, `recovery`, or email verification)
- Routes invite and recovery flows to `/auth/set-password`
- Handles standard email verification with session establishment
- Uses `window.location.href` for redirects to preserve hash parameters

**Recent Fixes**:
- ✅ Uses `window.location.href` instead of `router.push()` for better hash preservation
- ✅ Improved messaging to indicate redirects
- ✅ Reduced redirect delay from 3s to 2s

### Login.vue
**Purpose**: Standard email/password login

**Key Features**:
- Handles standard authentication with `signInWithPassword()`
- Properly initializes user store after successful login
- Includes password visibility toggle
- Links to password reset page

## Troubleshooting

### Issue: "User sets password but can't log in"
**Cause**: User store wasn't initialized after setting password
**Fix**: ✅ SetPassword.vue now calls `fetchUserSession()`, `initDB()`, and `loadProjectFromLocalStorage()`

### Issue: "Redirect URLs not working"
**Cause**: Redirect URLs not configured in Supabase dashboard
**Fix**: Add all required URLs to Supabase → Authentication → URL Configuration

### Issue: "Token not found in URL"
**Cause**: Hash parameters lost during navigation
**Fix**: ✅ ConfirmEmail.vue now uses `window.location.href` instead of `router.push()`

### Issue: "User stuck on set-password page"
**Cause**: Router guard redirecting before password is set
**Fix**: ✅ All password setting happens in one component before navigation

### Issue: "Session expires too quickly"
**Cause**: Session not properly persisted
**Fix**: Ensure `persistSession: true` in Supabase client config (already set in `supabase.js`)

## Configuration Files

### supabase.js
```javascript
export const supabase = createClient(URL, ANON_KEY, {
  auth: {
    persistSession: true,        // ✅ Session persists in localStorage
    autoRefreshToken: true,      // ✅ Auto-refresh expired tokens
    detectSessionInUrl: false,   // ✅ We handle URL tokens manually
    storage: window.localStorage,
    flowType: 'pkce',            // ✅ PKCE flow for security
  },
});
```

### router/index.js
- Routes for all auth pages
- Router guard for authentication and project membership checks
- Proper handling of public vs. protected routes

## Testing Checklist

### New User Invitation
- [ ] Admin can send invitation
- [ ] User receives email with correct link
- [ ] Link goes to `/auth/confirm` with correct tokens
- [ ] Redirects to `/auth/set-password`
- [ ] User can set password
- [ ] User is logged in automatically
- [ ] User is redirected to `/projects`
- [ ] User can access projects they're invited to

### Password Reset
- [ ] User can request password reset from login page
- [ ] User receives email with correct link
- [ ] Link goes to `/auth/set-password` with recovery tokens
- [ ] User can set new password
- [ ] User is logged in automatically
- [ ] User is redirected to `/projects`

### Standard Login
- [ ] User can log in with email and password
- [ ] Session persists across page refreshes
- [ ] User is redirected to `/projects` after login
- [ ] Protected routes are accessible after login
- [ ] Public routes redirect to `/projects` when authenticated

### Session Management
- [ ] Session persists in localStorage
- [ ] Session auto-refreshes before expiration
- [ ] Expired sessions redirect to login
- [ ] Sign out properly clears session and redirects to login

## Recent Changes

### December 2024 - Authentication Flow Improvements
1. **SetPassword.vue**: Added proper user store initialization after password setup
2. **ConfirmEmail.vue**: Improved redirect handling to preserve hash parameters
3. **Created AUTH_ROUTING_GUIDE.md**: Comprehensive documentation of auth flows
4. **Better error messages**: Clearer feedback for users during auth flows
5. **Faster redirects**: Reduced delays for better user experience

## Additional Notes

### PKCE Flow
The app uses PKCE (Proof Key for Code Exchange) for enhanced security. This is configured in `supabase.js` with `flowType: 'pkce'`.

### Session Storage
Sessions are stored in `localStorage` and automatically refreshed. The user store also encrypts sensitive data before storing in IndexedDB.

### Token Handling
- Tokens are parsed from URL hash fragments (`#access_token=...`)
- `detectSessionInUrl: false` means we manually handle tokens
- This gives us full control over the auth flow and prevents race conditions

### Security Considerations
- Service role key is never exposed in the frontend
- User invitations are handled via Edge Functions
- RLS (Row Level Security) policies protect database access
- Sessions expire after inactivity (configurable in Supabase)
- Passwords must meet Supabase's minimum requirements

