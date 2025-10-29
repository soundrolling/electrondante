// Test script for the invite-user Edge Function
// Run this with: node test-edge-function.js

const SUPABASE_URL = 'https://mcetzgzwldytnalfaldo.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key-here' // Replace with your actual anon key

async function testEdgeFunction() {
  console.log('🧪 Testing Edge Function...')
  
  const testData = {
    email: 'test@example.com',
    projectId: 'test-project-id',
    role: 'viewer'
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
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
    
    if (response.ok) {
      console.log('✅ Edge Function is accessible and responding')
    } else {
      console.log('❌ Edge Function returned an error')
    }
    
  } catch (error) {
    console.error('💥 Failed to call Edge Function:', error.message)
    console.error('🔍 This could indicate:')
    console.error('   - Edge Function is not deployed')
    console.error('   - Network connectivity issues')
    console.error('   - CORS issues')
    console.error('   - Authentication problems')
  }
}

// Test CORS preflight
async function testCORS() {
  console.log('\n🌐 Testing CORS preflight...')
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization, x-client-info, apikey'
      }
    })
    
    console.log('📊 CORS status:', response.status)
    console.log('📊 CORS headers:', Object.fromEntries(response.headers.entries()))
    
    if (response.ok) {
      console.log('✅ CORS preflight successful')
    } else {
      console.log('❌ CORS preflight failed')
    }
    
  } catch (error) {
    console.error('💥 CORS test failed:', error.message)
  }
}

// Run tests
console.log('🚀 Starting Edge Function tests...\n')
testCORS().then(() => {
  console.log('\n' + '='.repeat(50) + '\n')
  return testEdgeFunction()
}).then(() => {
  console.log('\n🏁 Tests completed')
}).catch(error => {
  console.error('💥 Test suite failed:', error)
})
