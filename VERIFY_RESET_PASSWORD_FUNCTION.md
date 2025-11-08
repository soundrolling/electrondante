# Verifying reset-password Edge Function

This guide helps you verify that the `reset-password` Edge Function is being triggered correctly at:
**https://mcetzgzwldytnalfaldo.supabase.co/functions/v1/reset-password**

## Quick Verification Steps

### 1. Check Browser Console
When you click "Reinvite/Reset Password" in Project Settings:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for these log messages:
   - `🔄 Calling reset-password Edge Function for: [email]`
   - `🌐 Expected Function URL: https://mcetzgzwldytnalfaldo.supabase.co/functions/v1/reset-password`
   - `✅ Supabase URL matches expected endpoint`

### 2. Check Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Reinvite/Reset Password" button
4. Look for a request to:
   - `reset-password` or
   - `functions/v1/reset-password`
5. Check the request:
   - **Status**: Should be 200 (success) or 400 (error with message)
   - **Method**: POST
   - **Request URL**: Should match `https://mcetzgzwldytnalfaldo.supabase.co/functions/v1/reset-password`
   - **Request Payload**: Should contain `{ "email": "user@example.com" }`

### 3. Check Edge Function Logs
Run this command to see real-time logs:
```bash
npx supabase functions logs reset-password
```

You should see logs like:
- `🚀 Reset Password Edge Function started`
- `📝 Request method: POST`
- `🌐 Request URL: [url]`
- `📧 Email: [email]`

### 4. Test Function Directly
Run the test script:
```bash
node test-reset-password-function.js
```

Make sure to set your `VITE_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` environment variable first.

## Common Issues

### Issue: Function returns 404
**Cause**: Function not deployed
**Fix**: 
```bash
npx supabase functions deploy reset-password
```

### Issue: Function returns 500 or error
**Cause**: Missing environment variables
**Fix**: 
1. Go to Supabase Dashboard → Edge Functions → reset-password
2. Set environment variables:
   - `SUPABASE_URL`: `https://mcetzgzwldytnalfaldo.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key
   - `SUPABASE_ANON_KEY`: Your anon key

### Issue: CORS error
**Cause**: CORS headers not configured
**Fix**: The function already includes CORS headers. If you still see errors, check:
1. Function is deployed with latest code
2. Browser is not blocking the request
3. Network tab shows the actual error

### Issue: Function not being called
**Cause**: Supabase client URL mismatch
**Fix**: 
1. Check `src/config.js` - verify `SUPABASE_URL` is set correctly
2. Check browser console for the logged URL
3. Verify it matches: `https://mcetzgzwldytnalfaldo.supabase.co`

## Verification Checklist

- [ ] Browser console shows function URL matches expected endpoint
- [ ] Network tab shows POST request to reset-password
- [ ] Request status is 200 (success) or 400 (error with message)
- [ ] Edge function logs show the request being received
- [ ] Toast notification appears in the UI
- [ ] Test script runs successfully

## Expected Behavior

When working correctly:
1. User clicks "Reinvite/Reset Password" button
2. Console logs show the function URL
3. Network request is made to the correct endpoint
4. Edge function receives the request and processes it
5. Toast notification shows success or error message
6. User receives email (if email service is configured)

## Debugging Tips

1. **Enable verbose logging**: The function already has comprehensive logging
2. **Check Supabase Dashboard**: Go to Edge Functions → reset-password → Logs
3. **Test with curl**: 
   ```bash
   curl -X POST https://mcetzgzwldytnalfaldo.supabase.co/functions/v1/reset-password \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -d '{"email":"test@example.com"}'
   ```
4. **Check function deployment**: 
   ```bash
   npx supabase functions list
   ```

