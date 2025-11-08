// Test script for the reset-password Edge Function
// Run this with: node test-reset-password-function.js

const SUPABASE_URL = 'https://mcetzgzwldytnalfaldo.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'your-anon-key-here' // Replace with your actual anon key

async function testResetPasswordFunction() {
  console.log('🧪 Testing reset-password Edge Function...')
  console.log('🌐 Function URL:', `${SUPABASE_URL}/functions/v1/reset-password`)
  
  const testData = {
    email: 'test@example.com' // Replace with a real email to test
  }
  
  try {
    console.log('\n📤 Sending POST request...')
    const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-client-info': 'supabase-js/2.x'
      },
      body: JSON.stringify(testData)
    })
    
    console.log('📊 Response status:', response.status)
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()))
    
    const responseText = await response.text()
    console.log('📊 Response body:', responseText)
    
    let responseData
    try {
      responseData = JSON.parse(responseText)
      console.log('📊 Parsed response:', JSON.stringify(responseData, null, 2))
    } catch (e) {
      console.log('⚠️ Response is not valid JSON')
    }
    
    if (response.ok) {
      console.log('\n✅ Edge Function is accessible and responding!')
      if (responseData?.userStatus) {
        console.log(`   User status: ${responseData.userStatus}`)
      }
    } else {
      console.log('\n❌ Edge Function returned an error status')
      if (responseData?.error) {
        console.log(`   Error: ${responseData.error}`)
      }
    }
    
  } catch (error) {
    console.error('\n💥 Failed to call Edge Function:', error.message)
    console.error('🔍 This could indicate:')
    console.error('   - Edge Function is not deployed')
    console.error('   - Network connectivity issues')
    console.error('   - CORS issues')
    console.error('   - Authentication problems')
    console.error('   - Wrong URL or endpoint')
  }
}

// Test CORS preflight
async function testCORS() {
  console.log('\n🌐 Testing CORS preflight...')
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization, x-client-info'
      }
    })
    
    console.log('📊 CORS preflight status:', response.status)
    console.log('📊 CORS headers:', {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    })
    
    if (response.ok) {
      console.log('✅ CORS preflight successful')
    } else {
      console.log('❌ CORS preflight failed')
    }
  } catch (error) {
    console.error('💥 CORS preflight error:', error.message)
  }
}

// Run tests
async function runTests() {
  console.log('='.repeat(60))
  console.log('🧪 Testing reset-password Edge Function')
  console.log('='.repeat(60))
  
  await testCORS()
  await testResetPasswordFunction()
  
  console.log('\n' + '='.repeat(60))
  console.log('📝 Next steps:')
  console.log('1. Check Supabase dashboard → Edge Functions → reset-password')
  console.log('2. Verify the function is deployed')
  console.log('3. Check function logs: npx supabase functions logs reset-password')
  console.log('4. Verify environment variables are set in Supabase dashboard')
  console.log('='.repeat(60))
}

runTests()

