import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  console.log('🚀 Reset Password Edge Function started');
  console.log('📝 Request method:', req.method);
  console.log('🌐 Request URL:', req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log('✅ Handling CORS preflight');
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
      }
    });
  }

  try {
    console.log('📦 Parsing request body...');
    const body = await req.json();
    console.log('📋 Request body:', JSON.stringify(body, null, 2));
    
    const { email } = body;
    
    // Validate required fields
    if (!email) {
      throw new Error('Missing required field: email');
    }
    
    console.log('✅ Required fields validated');
    console.log('📧 Email:', email);

    // Check environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log('🔧 Environment check:');
    console.log('   SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.log('   SERVICE_ROLE_KEY:', serviceRoleKey ? '✅ Set' : '❌ Missing');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    console.log('🔗 Creating Supabase admin client...');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    console.log('✅ Supabase admin client created');

    // Find existing user by email (admin-only)
    console.log('🔍 Searching for existing user...');
    const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listErr) {
      console.error('❌ Error searching for user:', listErr);
      throw new Error(`Error searching for user: ${listErr.message}`);
    }
    
    console.log('👥 Total users in system:', userList.users.length);
    
    // Filter users by email address
    const existingUser = userList.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
    
    if (!existingUser) {
      throw new Error('User not found. Please use the invite function to add new users.');
    }
    
    console.log('✅ User found, ID:', existingUser.id);
    console.log('📧 Email confirmed:', existingUser.email_confirmed_at ? 'Yes' : 'No');
    
    let responseMessage = '';
    
    // Check if user has confirmed their email
    if (existingUser.email_confirmed_at) {
      // User is fully registered - send password reset email
      console.log('🔐 User is fully registered, sending password reset email...');
      
      // Use client-side resetPasswordForEmail (works with anon key)
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!anonKey) {
        throw new Error('Missing SUPABASE_ANON_KEY environment variable');
      }
      
      const supabaseClient = createClient(supabaseUrl, anonKey);
      const { error: resetErr } = await supabaseClient.auth.resetPasswordForEmail(email.toLowerCase(), {
        redirectTo: "https://pro.soundrolling.com/auth/set-password"
      });
      
      if (resetErr) {
        console.error('❌ Error sending password reset email:', resetErr);
        throw new Error(`Password reset error: ${resetErr.message}`);
      }
      
      console.log('✅ Password reset email sent');
      responseMessage = 'reset';
    } else {
      // User exists but hasn't confirmed - resend invitation
      console.log('📨 User exists but not confirmed, resending invitation...');
      const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.toLowerCase(), {
        redirectTo: "https://pro.soundrolling.com/auth/set-password",
        data: {
          invitedBy: "admin"
        }
      });
      
      if (inviteErr) {
        console.error('❌ Invite error:', inviteErr);
        throw new Error(`Invite error: ${inviteErr.message}`);
      }
      
      console.log('✅ Invitation resent successfully');
      responseMessage = 'invited';
    }
    
    const response = {
      message: responseMessage === 'reset' 
        ? `Password reset email sent to ${email}. They will receive an email to reset their password.`
        : `Invitation resent to ${email}. They will receive an email to set their password.`,
      userStatus: responseMessage
    };
    
    console.log('📤 Sending success response:', response);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
      }
    });
    
  } catch (err) {
    console.error('💥 Edge Function error:', err);
    console.error('📊 Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    
    const errorResponse = {
      error: err.message,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
      }
    });
  }
});

