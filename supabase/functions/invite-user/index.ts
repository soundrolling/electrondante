import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  console.log('🚀 Edge Function started');
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
    
    const { email, projectId, role } = body;
    
    // Validate required fields
    if (!email || !projectId || !role) {
      const missing = [];
      if (!email) missing.push('email');
      if (!projectId) missing.push('projectId');
      if (!role) missing.push('role');
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    console.log('✅ Required fields validated');
    console.log('📧 Email:', email);
    console.log('🏗️ Project ID:', projectId);
    console.log('👤 Role:', role);

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

    // 1) Try to find existing user by email (admin-only)
    console.log('🔍 Searching for existing user...');
    const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listErr) {
      console.error('❌ Error searching for user:', listErr);
      throw new Error(`Error searching for user: ${listErr.message}`);
    }
    
    console.log('👥 Total users in system:', userList.users.length);
    
    // Filter users by email address
    const existingUser = userList.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
    
    let userId = null;
    let isExistingUser = false;
    let responseMessage = '';
    
    if (existingUser) {
      // User already exists in Auth
      userId = existingUser.id;
      isExistingUser = true;
      console.log('✅ User exists, ID:', userId);
      console.log('📧 Email confirmed:', existingUser.email_confirmed_at ? 'Yes' : 'No');
      
      // Check if user has confirmed their email
      if (existingUser.email_confirmed_at) {
        // User is fully registered - just add to project
        console.log('✅ User is fully registered, adding to project only');
        responseMessage = 'existing';
      } else {
        // User exists but hasn't confirmed - resend invitation
        console.log('📨 User exists but not confirmed, resending invitation...');
        const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: "https://pro.soundrolling.com/auth/set-password",
          data: {
            invitedBy: "system"
          }
        });
        
        if (inviteErr) {
          console.error('❌ Invite error:', inviteErr);
          throw new Error(`Invite error: ${inviteErr.message}`);
        }
        
        console.log('✅ Invitation resent successfully');
        responseMessage = 'invited';
      }
    } else {
      // 2) User doesn't exist - create and invite them
      console.log('📨 User does not exist, sending invitation...');
      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: "https://pro.soundrolling.com/auth/set-password",
        data: {
          invitedBy: "system"
        }
      });
      
      if (inviteErr) {
        console.error('❌ Invite error:', inviteErr);
        throw new Error(`Invite error: ${inviteErr.message}`);
      }
      
      userId = inviteData.user.id;
      console.log('✅ User invited successfully, ID:', userId);
      responseMessage = 'invited';
    }

    // 3) Insert/Upsert into `project_members`
    console.log('💾 Adding user to project_members table...');
    const { error: insertErr } = await supabaseAdmin.from("project_members").upsert({
      project_id: projectId,
      user_id: userId,
      user_email: email.toLowerCase(),
      role: role
    }, {
      onConflict: "project_id,user_email"
    });
    
    if (insertErr) {
      console.error('❌ Failed to insert project membership:', insertErr);
      throw new Error(`Failed to insert project membership: ${insertErr.message}`);
    }
    
    console.log('✅ Project membership added successfully');
    
    const response = {
      message: responseMessage === 'existing' 
        ? `User ${email} successfully added to project. They already have an account.`
        : `Invitation sent to ${email}. They will receive an email to set their password.`,
      userId,
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
