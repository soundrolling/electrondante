# User Invitation System - Testing Guide

## Prerequisites

1. **Run the RLS Migration**: Execute `project_members_rls.sql` in your Supabase SQL editor
2. **Verify Edge Function**: Ensure your "invite-user" edge function is deployed and accessible
3. **Check Environment Variables**: 
   - Frontend: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel
   - Edge Function: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Supabase dashboard

## Test Scenarios

### 1. Test Admin User Invitation (New User)
**Goal**: Verify that admins can invite users who don't have accounts yet

**Steps**:
1. Log in as a user with `admin` or `owner` role in a project
2. Navigate to Project Settings → Members tab
3. Enter a new email address (not in your system)
4. Select a role (viewer, contributor, or admin)
5. Click "Invite & Add User"

**Expected Results**:
- ✅ Success toast message appears
- ✅ User appears in project members list
- ✅ Email invitation is sent to the new user
- ✅ User can click email link to set password and access project

### 2. Test Admin User Addition (Existing User)
**Goal**: Verify that admins can add users who already have accounts

**Steps**:
1. Log in as a user with `admin` or `owner` role in a project
2. Navigate to Project Settings → Members tab
3. Enter an email address of an existing user
4. Select a role
5. Click "Invite & Add User"

**Expected Results**:
- ✅ Success toast message appears
- ✅ User appears in project members list immediately
- ✅ No email sent (user already exists)

### 3. Test Duplicate Prevention
**Goal**: Verify that duplicate memberships are prevented

**Steps**:
1. Try to add a user who is already a project member
2. Click "Invite & Add User"

**Expected Results**:
- ✅ Info toast: "This user is already a member of the project"
- ✅ No duplicate entries created

### 4. Test Non-Admin Access
**Goal**: Verify that non-admin users cannot manage members

**Steps**:
1. Log in as a user with `viewer` or `contributor` role
2. Navigate to Project Settings → Members tab

**Expected Results**:
- ✅ Invite form is not visible
- ✅ Can only view existing members (no management options)

### 5. Test Role-Based Permissions
**Goal**: Verify that different roles have appropriate access levels

**Test Cases**:
- **Viewer**: Read-only access to project data
- **Contributor**: Can edit/delete own items, cannot manage members
- **Admin**: Full access including member management (except project deletion)

### 6. Test RLS Policies
**Goal**: Verify that Row Level Security policies work correctly

**Steps**:
1. Create a test user with limited access
2. Try to access project_members table directly via Supabase client
3. Verify they can only see members of projects they belong to

**Expected Results**:
- ✅ Users can only see project members for projects they're part of
- ✅ Unauthorized access attempts are blocked

## Troubleshooting

### Common Issues

**"Invite unavailable: service-role key missing"**
- ✅ **Fixed**: This error should no longer appear as we removed adminClient usage

**"Failed to call invite function"**
- Check that your edge function is deployed and accessible
- Verify edge function has proper environment variables
- Check Supabase function logs for detailed error messages

**"User not added to project"**
- Check RLS policies are applied correctly
- Verify the edge function completed successfully
- Check project_members table for the new entry

**"Email not sent"**
- Check Supabase Auth settings for email templates
- Verify SMTP configuration in Supabase dashboard
- Check edge function logs for email sending errors

### Debug Steps

1. **Check Browser Console**: Look for any JavaScript errors
2. **Check Supabase Logs**: Monitor function execution and database queries
3. **Check Network Tab**: Verify edge function calls are successful
4. **Test Edge Function Directly**: Use Supabase dashboard to test the function

## Success Criteria

- ✅ Admins can invite new users (sends email)
- ✅ Admins can add existing users to projects
- ✅ Proper role assignment works (viewer, contributor, admin)
- ✅ RLS prevents unauthorized access to project_members table
- ✅ Duplicate memberships are prevented
- ✅ Non-admin users cannot manage members
- ✅ All error cases are handled gracefully with appropriate user feedback
