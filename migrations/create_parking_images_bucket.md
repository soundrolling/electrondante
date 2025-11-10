# Create parking-images Storage Bucket

The `parking-images` storage bucket needs to be created in Supabase for parking photo uploads to work.

## Steps to Create the Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** or **"Create bucket"**
4. Configure the bucket:
   - **Name**: `parking-images`
   - **Public bucket**: Unchecked (private bucket - uses signed URLs)
   - **File size limit**: 5MB (or your preferred limit)
   - **Allowed MIME types**: `image/*` (or specific types like `image/jpeg,image/png,image/webp`)

## Storage Policies (RLS)

After creating the bucket, you'll need to set up Row Level Security (RLS) policies.

### Method 1: Using Supabase Dashboard (RECOMMENDED - No special permissions needed)

1. Go to **Storage** in the Supabase Dashboard
2. Click on the **`parking-images`** bucket
3. Click on the **"Policies"** tab
4. Click **"New Policy"**
5. Select **"For full customization"** template
6. Create each of the following 4 policies:

#### Policy 1: Upload (INSERT)
- **Policy name**: `Users can upload parking images`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: Leave empty
- **WITH CHECK expression**: `bucket_id = 'parking-images'`

#### Policy 2: Read (SELECT)
- **Policy name**: `Users can read parking images`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'parking-images'`
- **WITH CHECK expression**: Leave empty

#### Policy 3: Update (UPDATE)
- **Policy name**: `Users can update parking images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'parking-images'`
- **WITH CHECK expression**: `bucket_id = 'parking-images'`

#### Policy 4: Delete (DELETE)
- **Policy name**: `Users can delete parking images`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'parking-images'`
- **WITH CHECK expression**: Leave empty

### Method 2: Using SQL (Requires SERVICE ROLE permissions)

If you have SERVICE ROLE access, you can run the SQL in `create_parking_images_bucket.sql`. 

⚠️ **Note**: Regular SQL Editor access may not have permissions. If you get "must be owner of relation objects" error, use Method 1 (Dashboard) instead.

## Verification

After creating the bucket and policies, test by:
1. Going to the Parking page in your app
2. Adding a new parking entry
3. Uploading a photo
4. The upload should succeed without the "Bucket not found" error

