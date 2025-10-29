#!/bin/bash

# Deploy the invite-user Edge Function to Supabase
# Make sure you have the Supabase CLI installed and are logged in

echo "🚀 Deploying invite-user Edge Function..."

# Check if supabase CLI is available
if ! npx supabase --version &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! npx supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   npx supabase login"
    exit 1
fi

# Deploy the function
echo "📦 Deploying function..."
npx supabase functions deploy invite-user

if [ $? -eq 0 ]; then
    echo "✅ Edge Function deployed successfully!"
    echo ""
    echo "🔧 Next steps:"
    echo "1. Set environment variables in your Supabase dashboard:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "2. Test the function with:"
    echo "   node test-edge-function.js"
    echo ""
    echo "3. Check the function logs:"
    echo "   npx supabase functions logs invite-user"
else
    echo "❌ Deployment failed!"
    echo "Check the error messages above and try again."
    exit 1
fi
