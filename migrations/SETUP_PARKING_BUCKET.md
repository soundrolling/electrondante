# Quick Setup Guide: parking-images Storage Bucket

## ⚠️ If you got "must be owner of relation objects" error

**DO NOT use the SQL file.** Use the Dashboard method below instead.

---

## Step 1: Create the Bucket

1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** or **"Create bucket"**
4. Configure:
   - **Name**: `parking-images`
   - **Public bucket**: ❌ Unchecked (keep it private)
   - **File size limit**: 5MB (or your preference)
   - **Allowed MIME types**: `image/*` (or `image/jpeg,image/png,image/webp`)
5. Click **"Create bucket"**

---

## Step 2: Create Storage Policies (4 policies needed)

1. Go to **Storage** → Click on **`parking-images`** bucket
2. Click the **"Policies"** tab
3. Click **"New Policy"**
4. For each policy below, select **"For full customization"** template

### Policy 1: Upload Images (INSERT)

- **Policy name**: `Users can upload parking images`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: (leave empty)
- **WITH CHECK expression**: `bucket_id = 'parking-images'`
- Click **"Review"** → **"Save policy"**

### Policy 2: Read Images (SELECT)

- **Policy name**: `Users can read parking images`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'parking-images'`
- **WITH CHECK expression**: (leave empty)
- Click **"Review"** → **"Save policy"**

### Policy 3: Update Images (UPDATE)

- **Policy name**: `Users can update parking images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'parking-images'`
- **WITH CHECK expression**: `bucket_id = 'parking-images'`
- Click **"Review"** → **"Save policy"**

### Policy 4: Delete Images (DELETE)

- **Policy name**: `Users can delete parking images`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'parking-images'`
- **WITH CHECK expression**: (leave empty)
- Click **"Review"** → **"Save policy"**

---

## Step 3: Test It

1. Go to your app's Parking page
2. Add a new parking entry
3. Upload a photo
4. ✅ Should work without "Bucket not found" error!

---

## Troubleshooting

- **"Bucket not found"**: Make sure you created the bucket in Step 1
- **"Permission denied"**: Make sure all 4 policies are created in Step 2
- **Still having issues?**: Check that the bucket name is exactly `parking-images` (no spaces, correct spelling)

