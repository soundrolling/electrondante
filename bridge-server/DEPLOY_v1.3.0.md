# Deploy v1.3.0 to Production

## Step-by-Step Deployment Guide

### Step 1: Commit Changes ✅

```bash
cd /Users/matt/Movies/proapp2149-main/bridge-server

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Release v1.3.0 - Supabase auth, multi-channel selection, UI fixes

- Integrated Supabase authentication
- Added broadcaster channel selection (1-32)
- Added listener channel selection and mixing
- Fixed button handlers and DevTools access
- Optimized jitter buffer for 400ms delay
- Added comprehensive logging and error handling
- Updated .gitignore and cleaned up repository"

# Push to main branch
git push origin main
```

### Step 2: Create Release Tag 🏷️

```bash
# Create annotated tag
git tag -a v1.3.0 -m "Release v1.3.0 - Multi-channel selection and Supabase auth"

# Push tag to GitHub
git push origin v1.3.0
```

### Step 3: Verify GitHub Actions Build 🔨

1. Go to: https://github.com/soundrolling/electrondante/actions
2. You should see a new workflow running for tag `v1.3.0`
3. Wait for build to complete (usually 5-15 minutes)
4. Check for build artifacts:
   - macOS: `Dante-Audio-Client-1.3.0-mac.dmg`
   - Windows: `Dante-Audio-Client-1.3.0-win.exe`
   - Linux: `Dante-Audio-Client-1.3.0-linux.AppImage`

### Step 4: Create GitHub Release 📦

**Option A: Automatic (if workflow creates release)**
- GitHub Actions should create release automatically
- Go to: https://github.com/soundrolling/electrondante/releases
- Verify v1.3.0 is published

**Option B: Manual**
1. Go to: https://github.com/soundrolling/electrondante/releases/new
2. Choose tag: `v1.3.0`
3. Release title: `v1.3.0 - Multi-Channel Selection & Supabase Auth`
4. Copy contents from `RELEASE_NOTES_v1.3.0.md`
5. Upload build artifacts from GitHub Actions
6. Click "Publish release"

### Step 5: Deploy Railway Server 🚂

Railway should auto-deploy from main branch, but verify:

```bash
# Check Railway deployment status
railway status

# Or manually trigger deployment
railway up
```

**Verify in Railway Dashboard:**
1. Go to: https://railway.app/project/your-project
2. Check deployment logs
3. Verify environment variables are set:
   - ✅ SUPABASE_URL
   - ✅ SUPABASE_SERVICE_KEY
   - ✅ CHANNEL_COUNT

### Step 6: Verify Deployment ✅

**Test Electron App:**
1. Download the built DMG/EXE from GitHub Releases
2. Install and launch
3. Check DevTools opens automatically
4. Try broadcaster login with pro.soundrolling.com credentials
5. Verify channel selection UI appears
6. Test creating a room

**Test Railway Server:**
```bash
# Check server health
curl https://your-app.railway.app/health

# Should return:
# {"status":"ok","uptime":123.45,"rooms":0,...}
```

### Step 7: Monitor & Test 👀

**Watch for errors:**
- GitHub Actions build logs
- Railway deployment logs
- Electron app DevTools console
- User reports

**Test checklist:**
- [ ] App opens without crashes
- [ ] DevTools shows initialization logs
- [ ] Login works with Supabase
- [ ] Room creation succeeds
- [ ] Channel selection UI works
- [ ] Broadcasting starts
- [ ] Listener can join
- [ ] Audio plays with ~400ms delay

---

## Quick Commands Summary

```bash
# 1. Commit and push
cd /Users/matt/Movies/proapp2149-main/bridge-server
git add .
git commit -m "Release v1.3.0 - Supabase auth, multi-channel selection, UI fixes"
git push origin main

# 2. Create and push tag
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin v1.3.0

# 3. Watch GitHub Actions
# Go to: https://github.com/soundrolling/electrondante/actions

# 4. Download builds from Actions artifacts or create GitHub Release

# 5. Test downloaded app
# Install DMG and verify all features work
```

---

## Rollback Plan (If Issues Found)

```bash
# Revert to v1.2.2
git tag -d v1.3.0  # Delete local tag
git push origin :refs/tags/v1.3.0  # Delete remote tag

# Reset to previous version
git reset --hard v1.2.2
git push origin main --force  # Caution: Force push

# Railway will auto-redeploy v1.2.2
```

---

## Post-Deployment

1. **Announce release** to users
2. **Update download links** on pro.soundrolling.com
3. **Monitor error logs** for first 24 hours
4. **Gather feedback** from beta testers
5. **Plan hotfix** if critical issues found

---

## Support & Troubleshooting

If builds fail:
- Check GitHub Secrets are set correctly
- Verify native modules rebuild in Actions
- Check signing certificates are valid

If app crashes on launch:
- User should check DevTools console
- Look for `[Init]` error logs
- Verify Supabase credentials in constants.js

If Railway deployment fails:
- Check environment variables
- Verify Supabase connection
- Review Railway logs

---

**Ready to deploy?** Run the commands above! 🚀

