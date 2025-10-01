# Bug Reports & Suggestions Feature

This feature allows users to report bugs and submit suggestions directly from the application interface.

## Features

### 1. Bug Report Button
- Located in the header next to the "Sign Out" button
- Accessible from any page when authenticated
- Opens a modal form for submitting reports

### 2. Report Submission Modal
- **Type Selection**: Bug Report, Feature Suggestion, or Improvement
- **Title**: Brief description (max 100 characters)
- **Description**: Detailed information (max 1000 characters)
- **Priority**: Low, Medium, High, or Critical
- **Optional Fields**: Browser info, Device info
- **Auto-captured**: User agent, URL, timestamp

### 3. Settings Management
- New "Bug Reports" tab in Project Settings
- View all submitted reports with filtering options
- Filter by: Status, Type, Priority
- Statistics dashboard showing report counts
- Status management (Open, In Progress, Closed)
- Delete reports functionality

### 4. Report Management Features
- **Expandable Cards**: Click to view full details
- **Status Updates**: Change report status with dropdown
- **Filtering**: Multiple filter options with clear filters button
- **Statistics**: Real-time counts by status, type, and priority
- **Responsive Design**: Works on mobile and desktop

## Database Schema

The feature requires two database tables:

### `bug_reports` table
- `id`: UUID primary key
- `type`: bug, suggestion, or improvement
- `title`: Report title (max 100 chars)
- `description`: Detailed description
- `priority`: low, medium, high, or critical
- `status`: open, in_progress, or closed
- `browser`: Optional browser information
- `device`: Optional device information
- `user_agent`: Auto-captured user agent
- `url`: Auto-captured page URL
- `created_at`: Timestamp
- `updated_at`: Auto-updated timestamp

### `bug_report_comments` table
- `id`: UUID primary key
- `report_id`: Foreign key to bug_reports
- `comment`: Comment text
- `created_at`: Timestamp

## Setup Instructions

1. **Database Setup**:
   - Run the SQL script `bug_reports_schema.sql` in your Supabase SQL editor
   - This creates the tables, indexes, and Row Level Security policies

2. **Component Files**:
   - `BugReportModal.vue` - Report submission form
   - `BugReportList.vue` - Report management interface
   - `bugReportService.js` - API service layer
   - `bugReportStore.js` - State management

3. **Integration**:
   - Header component updated with report button
   - ProjectSettings component updated with bug reports tab

## Usage

### Submitting a Report
1. Click the "Report" button in the header
2. Fill out the form with:
   - Type of report (bug/suggestion/improvement)
   - Title and description
   - Priority level
   - Optional browser/device info
3. Click "Submit Report"

### Managing Reports
1. Go to Project Settings
2. Click the "Bug Reports" tab
3. Use filters to find specific reports
4. Click on reports to expand and view details
5. Change status using the dropdown
6. Delete reports if needed

## Technical Details

### State Management
- Uses Pinia store (`bugReportStore.js`) for centralized state
- Reactive data with computed properties for filtering
- Error handling and loading states

### API Service
- Service layer (`bugReportService.js`) handles all database operations
- Toast notifications for user feedback
- Error handling and validation

### Styling
- Follows existing design system
- Mobile-responsive design
- Accessible with proper focus states
- High contrast mode support

### Security
- Row Level Security (RLS) enabled
- Authenticated users can manage all reports
- Proper input validation and sanitization

## Future Enhancements

- Email notifications for status changes
- File attachments for bug reports
- Assign reports to specific users
- Report templates
- Export functionality
- Advanced search and filtering
- Report analytics and insights
