<!-- src/components/ProjectSettings.vue -->
<template>
<div class="container">
  <!-- Project Header & User Info -->
  <div class="card ui-page-header">
    <h3>Project Settings for {{ currentProject?.project_name || 'Loading…' }}</h3>
    <div class="user-info">
      <p><strong>Logged in as:</strong> {{ currentUserEmail }}</p>
      <p><strong>Your Role:</strong> {{ currentUserRole || 'Loading…' }}</p>
      <p><strong>Project ID:</strong> {{ currentProject?.id || 'Loading…' }}</p>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button 
      @click="activeTab = 'members'"
      :class="['tab-btn', { active: activeTab === 'members' }]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      Members
    </button>
    <button 
      @click="activeTab = 'details'"
      :class="['tab-btn', { active: activeTab === 'details' }]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14,2 14,8 20,8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10,9 9,9 8,9"></polyline>
      </svg>
      Details
    </button>
    <button 
      @click="activeTab = 'bug-reports'"
      :class="['tab-btn', { active: activeTab === 'bug-reports' }]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Bug Reports
    </button>
  </div>

  <!-- Tab Content -->
  <div class="tab-content">
    <!-- Members Tab -->
    <div v-if="activeTab === 'members'" class="tab-panel">
      <!-- Invite / Add Section -->
      <div v-if="canManageProject" class="card">
        <h4>Invite or Add a User to This Project</h4>
        <p>
          Enter the user's email and select a role.
          If they already have an account, they'll be added immediately;
          otherwise we'll send them a "set password" invite.
        </p>

        <div class="invite-form">
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="Enter user's email"
          />
          <select v-model="selectedRole">
            <option value="viewer">Viewer</option>
            <option value="contributor">Contributor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            @click="inviteUserToProject"
            class="invite-button"
            :disabled="isInviting || !isInviteFormValid"
          >
            {{ isInviting ? 'Processing…' : 'Invite & Add User' }}
          </button>
        </div>

        <hr />

        <button
          @click="showRoleDescriptions = !showRoleDescriptions"
          class="btn btn-warning toggle-btn"
        >
          {{ showRoleDescriptions ? 'Hide Role Descriptions' : 'Show Role Descriptions' }}
        </button>
        <div v-if="showRoleDescriptions" class="role-descriptions">
          <h5>Role Descriptions</h5>
          <ul>
            <li><strong>Viewer:</strong> read-only access.</li>
            <li><strong>Contributor:</strong> edit/delete own items.</li>
            <li><strong>Admin:</strong> owner-like powers (no project deletion).</li>
          </ul>
        </div>
      </div>

      <!-- Members Table or Loading -->
      <div v-if="loadingMembers" class="card">
        Loading project members…
      </div>
      <div v-else-if="projectMembers.length" class="card">
        <h4>Project Members</h4>
        <p class="scroll-hint-text">Scroll horizontally →</p>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in projectMembers" :key="m.id">
                <td>{{ m.user_email }}</td>
                <td>{{ m.role }}</td>
                <td>
                  <div class="action-buttons">
                    <button
                      v-if="canManageProject"
                      @click="reinviteOrResetPassword(m.user_email, m.id)"
                      class="btn btn-secondary reinvite-btn"
                      :disabled="isResettingPassword === m.id"
                    >
                      {{ isResettingPassword === m.id ? 'Sending…' : 'Reinvite/Reset Password' }}
                    </button>
                    <button
                      v-if="canManageProject && m.role !== 'owner'"
                      @click="removeMember(m.id)"
                      class="btn btn-danger remove-btn"
                    >Remove</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="card">
        <p>No members found. Invite users to get started.</p>
      </div>
    </div>

    <!-- Details Tab -->
    <div v-if="activeTab === 'details'" class="tab-panel">
      <div class="card">
        <h4>Project Details</h4>
        <div v-if="projectDetails">
          <p><strong>Sample Rate:</strong> {{ projectDetails.sample_rate }} Hz</p>
          <p><strong>Bit Depth:</strong> {{ projectDetails.bit_depth }} bits</p>
          <p><strong>Frame Rate:</strong> {{ projectDetails.frame_rate }} FPS</p>
        </div>
        <div v-else><p>No details yet. Click below to add.</p></div>
        <button @click="showForm = !showForm" class="toggle-btn">
          {{ showForm ? 'Hide Form' : 'Edit Project Details' }}
        </button>
        <div v-if="showForm" class="form-container">
          <label for="sampleRate">Sample Rate (Hz):</label>
          <select v-model="sampleRate" id="sampleRate">
            <option value="44100">44.1 kHz</option>
            <option value="48000">48 kHz</option>
            <option value="96000">96 kHz</option>
          </select>

          <label for="bitDepth">Bit Depth (bits):</label>
          <select v-model="bitDepth" id="bitDepth">
            <option value="16">16 bits</option>
            <option value="24">24 bits</option>
            <option value="32">32 bits</option>
          </select>

          <label for="frameRate">Frame Rate (FPS):</label>
          <select v-model="frameRate" id="frameRate">
            <option value="23.98">23.976 FPS</option>
            <option value="24">24 FPS</option>
            <option value="25">25 FPS</option>
            <option value="30">30 FPS</option>
            <option value="60">60 FPS</option>
          </select>

          <button @click="saveProjectDetails" class="btn btn-positive save-button">
            Save Details
          </button>
        </div>
      </div>
    </div>

    <!-- Bug Reports Tab -->
    <div v-if="activeTab === 'bug-reports'" class="tab-panel">
      <BugReportList />
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import { config } from '../config'
import { useUserStore } from '../stores/userStore'
import { useToast } from 'vue-toastification'
import BugReportList from './BugReportList.vue'

export default {
  components: {
    BugReportList
  },
  setup() {
    const route = useRoute()
    const userStore = useUserStore()
    const currentProject = computed(() => userStore.getCurrentProject)
    const toast = useToast()

    // Tab management - check query param for tab
    const activeTab = ref(route.query.tab || 'members')
    
    // Watch for tab query changes
    watch(() => route.query.tab, (newTab) => {
      if (newTab && ['members', 'details', 'bug-reports'].includes(newTab)) {
        activeTab.value = newTab
      }
    })

  const projectMembers = ref([])
  const loadingMembers = ref(false)

  const inviteEmail = ref('')
  const selectedRole = ref('viewer')
  const isInviting = ref(false)
  const isResettingPassword = ref(null) // Track which member is being reset
  const showRoleDescriptions = ref(false)

  const currentUserEmail = ref('')
  const currentUserRole = ref('')
  const canManageProject = ref(false)

  const projectDetails = ref(null)
  const sampleRate = ref('48000')
  const bitDepth = ref('24')
  const frameRate = ref('25')
  const showForm = ref(false)

  const isInviteFormValid = computed(() =>
    /\S+@\S+\.\S+/.test(inviteEmail.value)
  )

  // 1) Load current user & their role in this project
  const checkUserRole = async () => {
    const { data: sess, error: sessErr } = await supabase.auth.getSession()
    if (sessErr) throw sessErr
    const email = sess.session?.user?.email.toLowerCase() || ''
    currentUserEmail.value = email
    if (!currentProject.value?.id) return

    const { data: mem, error: mErr } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', currentProject.value.id)
      .eq('user_email', email)
      .single()
    if (mErr) throw mErr

    currentUserRole.value = mem.role
    canManageProject.value = ['owner','admin'].includes(mem.role)
  }

  // 2) Fetch members list
  const fetchProjectMembers = async () => {
    if (!currentProject.value?.id) return
    loadingMembers.value = true
    const { data, error } = await supabase
      .from('project_members')
      .select('id,user_email,role')
      .eq('project_id', currentProject.value.id)
    loadingMembers.value = false
    if (error) throw error
    projectMembers.value = data
  }

  // 3) Fetch & save project details
  const fetchProjectDetails = async () => {
    if (!currentProject.value?.id) return
    const { data, error } = await supabase
      .from('project_details')
      .select('*')
      .eq('project_id', currentProject.value.id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    if (data) {
      projectDetails.value = data
      sampleRate.value = data.sample_rate
      bitDepth.value = data.bit_depth
      frameRate.value = data.frame_rate
    }
  }
  const saveProjectDetails = async () => {
    if (!currentProject.value?.id) return
    const payload = {
      project_id:  currentProject.value.id,
      sample_rate: sampleRate.value,
      bit_depth:   bitDepth.value,
      frame_rate:  frameRate.value,
    }
    let error
    if (projectDetails.value) {
      ({ error } = await supabase
        .from('project_details')
        .update(payload)
        .eq('id', projectDetails.value.id))
    } else {
      ({ error } = await supabase.from('project_details').insert(payload))
    }
    if (error) {
      console.error('Save details failed:', error)
      alert('Could not save project details.')
    } else {
      await fetchProjectDetails()
      showForm.value = false
    }
  }

  // 4) Call Edge Function for user invitation
  const callInviteUserFunction = async (email, projectId, role) => {
    console.log('🚀 Calling invite-user Edge Function with:', { email, projectId, role })
    
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email,
          projectId,
          role
        }
      })

      console.log('📤 Edge Function response:', { data, error })

      if (error) {
        console.error('❌ Edge Function error:', error)
        // Check if error has a message in the response body
        let errorMessage = error.message || 'Failed to call invite function'
        if (data?.error) {
          errorMessage = data.error
        }
        throw new Error(errorMessage)
      }

      // Check if response indicates an error (edge function returns 200 but with error in body)
      if (data?.error) {
        console.error('❌ Error in response data:', data.error)
        throw new Error(data.error)
      }

      console.log('✅ Edge Function success:', data)
      return data
    } catch (err) {
      console.error('💥 Edge Function call failed:', err)
      throw err
    }
  }

  // 5) Invite/Add flow using Edge Function
  const inviteUserToProject = async () => {
    const email = inviteEmail.value.trim().toLowerCase()
    console.log('🎯 Starting invite process for:', email)
    
    if (!isInviteFormValid.value) {
      toast.error('Please enter a valid email address.')
      return
    }
    if (!currentProject.value?.id) {
      console.error('❌ No current project ID')
      toast.error('No project selected.')
      return
    }

    isInviting.value = true
    try {
      console.log('🔍 Checking for existing membership...')
      // a) prevent duplicate membership
      const { data: existingMember, error: checkError } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', currentProject.value.id)
        .eq('user_email', email)
        .single()
        
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error checking existing membership:', checkError)
        throw new Error('Failed to check existing membership')
      }
      
      if (existingMember) {
        console.log('ℹ️ User already a member')
        toast.info('This user is already a member of the project.')
        return
      }

      console.log('📞 Calling Edge Function...')
      // b) call edge function to handle invitation and project membership
      const result = await callInviteUserFunction(email, currentProject.value.id, selectedRole.value)
      
      console.log('🔄 Refreshing members list...')
      // c) refresh members list
      await fetchProjectMembers()
      inviteEmail.value = ''
      selectedRole.value = 'viewer'
      
      // Show different messages based on user status
      if (result?.userStatus === 'existing') {
        toast.success(`${email} successfully added to project! Please let them know they can now access it from their account.`)
      } else if (result?.userStatus === 'invited') {
        toast.success(`Invitation sent to ${email}! The user will receive an email to set their password and join the project.`)
      } else {
        // Fallback success message
        toast.success(`User ${email} has been added to the project.`)
      }
      console.log('✅ Invite process completed successfully')
    } catch (err) {
      console.error('💥 Invite process failed:', err)
      toast.error(err.message || 'Failed to invite/add user.')
    } finally {
      isInviting.value = false
    }
  }

  // 6) Reinvite or reset password for a member
  const reinviteOrResetPassword = async (email, memberId) => {
    if (!confirm(`Send password reset/reinvite email to ${email}?`)) return
    
    isResettingPassword.value = memberId
    try {
      // Get the Supabase URL to verify the endpoint
      const supabaseUrl = config.supabase.url || 'Unknown'
      const functionUrl = `${supabaseUrl}/functions/v1/reset-password`
      console.log('🔄 Calling reset-password Edge Function for:', email)
      console.log('🌐 Expected Function URL:', functionUrl)
      console.log('📦 Request body:', { email })
      console.log('🔍 Verifying endpoint matches: https://mcetzgzwldytnalfaldo.supabase.co/functions/v1/reset-password')
      
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          email
        }
      })

      console.log('📤 Reset password response:', { data, error })
      console.log('✅ Function call completed. Check Network tab to verify the exact URL called.')
      
      // Verify the URL matches expected endpoint
      if (supabaseUrl.includes('mcetzgzwldytnalfaldo.supabase.co')) {
        console.log('✅ Supabase URL matches expected endpoint')
      } else {
        console.warn('⚠️ Supabase URL does not match expected endpoint. Expected: mcetzgzwldytnalfaldo.supabase.co')
      }

      // Handle error response from edge function
      if (error) {
        console.error('❌ Reset password error:', error)
        // Check if error has a message in the response body
        let errorMessage = error.message || 'Failed to send reset/reinvite email'
        if (data?.error) {
          errorMessage = data.error
        }
        toast.error(errorMessage)
        return // Don't throw, we've already shown the error
      }

      // Check if response indicates an error (edge function returns 200 but with error in body)
      if (data?.error) {
        console.error('❌ Error in response data:', data.error)
        toast.error(data.error)
        return // Don't throw, we've already shown the error
      }

      console.log('✅ Reset/reinvite email sent successfully')
      
      // Show different messages based on user status
      if (data?.userStatus === 'reset') {
        toast.success(`Password reset email sent to ${email}! The user will receive an email to reset their password.`)
      } else if (data?.userStatus === 'invited') {
        toast.success(`Invitation resent to ${email}! The user will receive an email to set their password.`)
      } else {
        // Fallback success message
        toast.success(`Email sent to ${email}!`)
      }
    } catch (err) {
      console.error('💥 Reset password process failed:', err)
      // Show error toast for unexpected errors
      toast.error(err.message || 'Failed to send reset/reinvite email.')
    } finally {
      isResettingPassword.value = null
    }
  }

  // 7) Remove a member
  const removeMember = async (id) => {
    if (!confirm('Remove this user from the project?')) return
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Remove failed:', error)
      alert('Could not remove member.')
    } else {
      projectMembers.value = projectMembers.value.filter(m => m.id !== id)
    }
  }

  // init & watch
  const reloadAll = () => {
    checkUserRole()
    fetchProjectMembers()
    fetchProjectDetails()
  }
  onMounted(async () => {
    if (!currentProject.value?.id && route.params.id) {
      await userStore.fetchProjectById(route.params.id)
    }
    if (currentProject.value?.id) reloadAll()
  })
  watch(() => currentProject.value?.id, (n, o) => {
    if (n && n !== o) reloadAll()
  })

  return {
    activeTab,
    currentProject,
    projectMembers,
    loadingMembers,
    inviteEmail,
    selectedRole,
    isInviting,
    isResettingPassword,
    showRoleDescriptions,
    isInviteFormValid,
    currentUserEmail,
    currentUserRole,
    canManageProject,
    projectDetails,
    sampleRate,
    bitDepth,
    frameRate,
    showForm,
    inviteUserToProject,
    reinviteOrResetPassword,
    removeMember,
    saveProjectDetails,
  }
},
}
</script>

<style scoped>
.container {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 32px;
  max-width: 900px;
  margin: 32px auto;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  border: 1px solid var(--border-light);
}
.card {
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 24px 20px 20px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  margin-bottom: 18px;
  border: 1.5px solid var(--border-light);
}
h3 {
  font-size: 1.7rem;
  color: var(--text-primary);
  margin-bottom: 15px;
  font-weight: 700;
}
h4 {
  font-size: 1.25rem;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-weight: 600;
}
h5 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 10px;
  font-weight: 600;
}
.user-info p { margin: 5px 0; }

/* Tab Navigation */
.tab-navigation {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-2);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
  font-size: var(--text-sm);
  min-height: 44px;
}

.tab-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--color-primary-500);
  color: var(--text-inverse);
  border-color: var(--color-primary-600);
}

.tab-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tab-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-top: none;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  min-height: 400px;
}

.tab-panel {
  padding: var(--space-6);
}

.invite-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}
input,
select {
  padding: 12px 14px;
  font-size: 1rem;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  outline: none;
  transition: border-color .2s, box-shadow .2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}
input:focus,
select:focus { border-color: var(--color-primary-500); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3); }
.invite-button {
  padding: 10px 18px;
  background: var(--color-primary-500);
  color: var(--text-inverse);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 1rem;
  transition: background 0.2s;
}
.invite-button:disabled { opacity: 0.6; cursor: default; }
.invite-button:hover:not(:disabled) { background: var(--color-primary-600); }

.toggle-btn {
  background: none;
  color: var(--color-primary-600);
  text-decoration: underline;
  border: none;
  padding: 0;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  margin-top: 8px;
  margin-bottom: 8px;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}
.toggle-btn:hover {
  color: var(--color-primary-700);
  background: var(--bg-secondary);
}
.role-descriptions ul {
  list-style: disc inside;
  margin: 8px 0;
  padding-left: 1rem;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
  margin-top: 10px;
}
.table-responsive::-webkit-scrollbar {
  height: 8px;
}
.table-responsive::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}
.table-responsive::-webkit-scrollbar-thumb {
  background: var(--border-medium);
  border-radius: 4px;
}
.table-responsive::-webkit-scrollbar-thumb:hover {
  background: var(--color-secondary-500);
}

.scroll-hint-text {
  font-size: .95rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 400px;
  font-size: 1rem;
}
th,
td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-light);
  text-align: left;
}
td {
  white-space: nowrap;
}
td:last-child {
  white-space: normal;
}
th {
  background: var(--bg-tertiary);
  font-weight: 600;
  color: var(--text-primary);
}
tr:nth-child(even) td {
  background: var(--bg-secondary);
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reinvite-btn {
  background: var(--color-primary-500);
  color: var(--text-inverse);
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: background 0.2s;
  white-space: nowrap;
}
.reinvite-btn:hover:not(:disabled) {
  background: var(--color-primary-600);
}
.reinvite-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.remove-btn {
  background: var(--btn-danger-bg);
  color: var(--btn-danger-text);
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 500;
  font-size: 1rem;
  transition: background 0.2s;
}
.remove-btn:hover {
  background: var(--btn-danger-hover-bg);
}

.section-break hr {
  border: 0;
  border-top: 1.5px solid var(--border-light);
  margin: 24px 0;
}
.form-container {
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 18px;
  margin-top: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid var(--border-light);
}
.form-container label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: var(--text-primary);
}
.form-container select {
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  margin-bottom: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 1rem;
}

.save-button {
  padding: 10px 18px;
  background: var(--btn-positive-bg);
  color: var(--btn-positive-text);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 1rem;
  transition: background 0.2s;
}
.save-button:hover { background: var(--btn-positive-hover-bg); }

@media (max-width:700px) {
  .container { padding: 14px; }
  .card { padding: 12px; }
  h3 { font-size: 1.3rem; }
  h4 { font-size: 1.1rem; }
  th, td { padding: 7px 8px; }
  
  .tab-navigation {
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .tab-btn {
    justify-content: center;
    width: 100%;
  }
  
  .tab-panel {
    padding: var(--space-4);
  }
}
@media (max-width:500px) {
  .invite-form {
    flex-direction: column;
    align-items: stretch;
  }
  .invite-form input,
  .invite-form select,
  .invite-form button {
    width: 100%;
  }
}
</style>