# 🎨 Frontend Design Specification - Auto-Apply System

Complete design requirements for the Auto-Apply feature frontend.

---

## 📋 Table of Contents

1. [Page Overview](#page-overview)
2. [User Flow](#user-flow)
3. [Page Specifications](#page-specifications)
4. [Component Details](#component-details)
5. [API Integration](#api-integration)
6. [Design System](#design-system)
7. [Mockup Requirements](#mockup-requirements)

---

## 📊 Page Overview

The Auto-Apply system requires **3 new pages** and **5 new components**:

### New Pages
1. **Jobs Browser** (`/jobs`) - Browse and filter AI-applyable jobs
2. **Auto-Apply Dashboard** (`/applications`) - Track application status
3. **Application Details** (`/applications/:id`) - View individual application

### New Components
1. **JobCard** - Display job with ATS badge and apply button
2. **ATSBadge** - Show ATS platform with icon
3. **ApplicationStatusCard** - Show application with status indicator
4. **CostTracker** - Display cost savings visualization
5. **RecipeIndicator** - Show if recipe exists for platform

### Modified Pages
1. **Dashboard** - Add "Auto-Apply" section with stats
2. **Profile/Memory** - Add "Application Preferences" section

---

## 🔄 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER JOURNEY                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. LANDING PAGE                                            │
│     → User clicks "Try Auto-Apply" CTA                      │
│                                                              │
│  2. ONBOARDING/SIGNUP                                       │
│     → Complete profile setup                                │
│     → Add resume                                            │
│     → Fill common answers (work auth, sponsorship, etc.)    │
│                                                              │
│  3. DASHBOARD                                               │
│     → See "Auto-Apply Beta" card                           │
│     → Shows: "2,450 AI-applyable jobs available"           │
│     → Click "Browse Jobs" button                           │
│                                                              │
│  4. JOBS BROWSER (/jobs)                                    │
│     → See grid of job cards                                 │
│     → Filter by platform, location, experience             │
│     → See ATS badges (Greenhouse, Lever, etc.)             │
│     → Click "Auto-Apply" on job card                       │
│                                                              │
│  5. AUTO-APPLY CONFIRMATION MODAL                           │
│     → Review job details                                    │
│     → See estimated cost ($0.05)                           │
│     → Click "Confirm & Apply"                              │
│                                                              │
│  6. APPLICATION QUEUED                                      │
│     → Success message: "Application queued!"               │
│     → Redirect to /applications                            │
│                                                              │
│  7. AUTO-APPLY DASHBOARD (/applications)                    │
│     → See application card with "APPLYING" status          │
│     → Real-time status updates via polling/SSE             │
│     → Status changes: QUEUED → APPLYING → SUBMITTED        │
│                                                              │
│  8. APPLICATION COMPLETE                                    │
│     → Status shows "SUBMITTED" with green checkmark        │
│     → See confirmation ID (e.g., "GH-98765")              │
│     → See timestamp and cost ($0.05)                       │
│     → Click card to see details                            │
│                                                              │
│  9. APPLICATION DETAILS (/applications/:id)                 │
│     → Full job description                                  │
│     → Timeline of application steps                         │
│     → Screenshot of confirmation page                       │
│     → Download application data                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📄 Page Specifications

### 1. Jobs Browser (`/jobs`)

**Purpose**: Browse and filter AI-applyable jobs, submit auto-apply requests

**Layout**: Grid layout with sidebar filters

#### Header Section
```
┌────────────────────────────────────────────────────────────┐
│  🎯 Find Your Next Role                                    │
│  2,450 AI-applyable jobs • Updated 2 hours ago            │
│                                                            │
│  [Search: Job title, company, keywords...]  [🔍 Search]   │
└────────────────────────────────────────────────────────────┘
```

**Elements**:
- Title: "Find Your Next Role" (h1)
- Subtitle: "{count} AI-applyable jobs • Updated {time} ago" (muted text)
- Search bar: Full-width input with search icon
- Last sync timestamp

#### Filters Sidebar (Left)
```
┌─────────────────────────┐
│  FILTERS                │
├─────────────────────────┤
│                         │
│  📊 Job Type            │
│  ☑ AI-Applyable (2,450) │
│  ☐ Manual Only (8,320)  │
│  ☐ All Jobs (10,770)    │
│                         │
│  🏢 ATS Platform        │
│  ☑ Greenhouse (1,200)   │
│  ☑ Lever (850)          │
│  ☑ Ashby (400)          │
│  ☐ Workday (5,200)      │
│  ☐ Other (3,120)        │
│                         │
│  📍 Location            │
│  ☐ Remote               │
│  ☐ Hybrid               │
│  ☐ On-site              │
│                         │
│  💼 Experience          │
│  ☐ Entry (0-2 years)    │
│  ☐ Mid (2-5 years)      │
│  ☐ Senior (5+ years)    │
│                         │
│  💰 Cost                │
│  ☑ Has Recipe ($0.05)   │
│  ☐ Needs Recording      │
│     ($0.80 first time)  │
│                         │
│  [Clear Filters]        │
└─────────────────────────┘
```

**Filter Options**:

1. **Job Type** (radio buttons)
   - AI-Applyable (default selected)
   - Manual Only
   - All Jobs

2. **ATS Platform** (checkboxes)
   - Greenhouse
   - Lever
   - Ashby
   - Workday (disabled/grayed out with "Manual only" label)
   - Other

3. **Location** (checkboxes)
   - Remote
   - Hybrid
   - On-site

4. **Experience Level** (checkboxes)
   - Entry Level (0-2 years)
   - Mid-Level (2-5 years)
   - Senior (5+ years)

5. **Cost Filter** (checkboxes)
   - Has Recipe ($0.05)
   - Needs Recording ($0.80 first time)

**Clear Filters Button**: Reset all filters to defaults

#### Jobs Grid (Right)
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🏢 Stripe                      [Greenhouse] [Recipe] │   │
│  │ Senior Software Engineer                            │   │
│  │ 📍 San Francisco, CA • Remote OK                    │   │
│  │ 💰 $180k - $250k                                    │   │
│  │                                                      │   │
│  │ We're looking for experienced engineers to join...  │   │
│  │                                                      │   │
│  │ ⚡ AI Can Apply • $0.05                             │   │
│  │                                                      │   │
│  │ [View Details]              [🤖 Auto-Apply]         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🏢 Notion                      [Greenhouse] [Recipe] │   │
│  │ Full Stack Engineer                                 │   │
│  │ 📍 New York, NY • Hybrid                            │   │
│  │ 💰 $150k - $200k                                    │   │
│  │                                                      │   │
│  │ Join our team building the future of productivity..│   │
│  │                                                      │   │
│  │ ⚡ AI Can Apply • $0.05                             │   │
│  │                                                      │   │
│  │ [View Details]              [🤖 Auto-Apply]         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [Load More Jobs...]                                        │
└──────────────────────────────────────────────────────────────┘
```

**Job Card Design** (see Component Details for full spec)

#### Pagination/Load More
- "Load More Jobs" button at bottom
- Or infinite scroll (designer's choice)
- Show "Showing X of Y jobs"

---

### 2. Auto-Apply Dashboard (`/applications`)

**Purpose**: Track all auto-apply applications and their status

**Layout**: List/card view with filters

#### Header Section
```
┌────────────────────────────────────────────────────────────┐
│  📊 My Applications                                        │
│                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │  SUBMITTED   │ │   APPLYING   │ │    QUEUED    │     │
│  │     24       │ │      3       │ │      7       │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
│                                                            │
│  💰 Total Cost: $1.90 • Saved: $25.10 (93%)              │
└────────────────────────────────────────────────────────────┘
```

**Elements**:
- Title: "My Applications"
- Stats Cards (3):
  - Submitted (green)
  - Applying (yellow/orange - animated)
  - Queued (blue)
- Cost Summary:
  - Total spent
  - Amount saved vs BrowserUse
  - Percentage savings

#### Filters/Tabs
```
┌────────────────────────────────────────────────────────────┐
│  [All (34)]  [Submitted (24)]  [Applying (3)]             │
│  [Queued (7)]  [Failed (0)]                               │
│                                                            │
│  Sort by: [Most Recent ▼]                                 │
└────────────────────────────────────────────────────────────┘
```

**Tab Options**:
- All
- Submitted
- Applying
- Queued
- Failed

**Sort Options**:
- Most Recent (default)
- Oldest First
- Company A-Z
- Status

#### Applications List
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ✅ SUBMITTED                            2 hours ago  │ │
│  │                                                      │ │
│  │ 🏢 Stripe                                            │ │
│  │ Senior Software Engineer                            │ │
│  │                                                      │ │
│  │ [Greenhouse]  Confirmation: GH-98765                │ │
│  │                                                      │ │
│  │ 💰 Cost: $0.05 • Applied: Oct 15, 2025 10:30 AM    │ │
│  │                                                      │ │
│  │ [View Details →]                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🔄 APPLYING                             Just now     │ │
│  │                                                      │ │
│  │ 🏢 Notion                                            │ │
│  │ Full Stack Engineer                                 │ │
│  │                                                      │ │
│  │ [Greenhouse]  Processing...                         │ │
│  │                                                      │ │
│  │ 💰 Estimated: $0.05 • Started: Oct 15, 2025 11:00  │ │
│  │                                                      │ │
│  │ [⏳ Processing...]                                   │ │
│  └─────────────────────────────���───────────────────────┘ │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 📅 QUEUED                               5 mins ago   │ │
│  │                                                      │ │
│  │ 🏢 Figma                                             │ │
│  │ Product Designer                                     │ │
│  │                                                      │ │
│  │ [Greenhouse]  Position 3 in queue                   │ │
│  │                                                      │ │
│  │ 💰 Estimated: $0.05 • Queued: Oct 15, 2025 10:55   │ │
│  │                                                      │ │
│  │ [Cancel]  [View Details →]                          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Application Card Design** (see Component Details)

#### Empty State
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                     🤖                                     │
│                                                            │
│              No applications yet                           │
│                                                            │
│     Start auto-applying to jobs with one click!           │
│                                                            │
│              [Browse Jobs →]                               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### 3. Application Details (`/applications/:id`)

**Purpose**: View detailed information about a specific application

**Layout**: Full-width detail view with sections

#### Header
```
┌────────────────────────────────────────────────────────────┐
│  [← Back to Applications]                                  │
│                                                            │
│  ✅ Application Submitted Successfully                     │
│                                                            │
│  🏢 Stripe • Senior Software Engineer                     │
│  Confirmation: GH-98765 • Applied Oct 15, 2025 10:30 AM   │
└────────────────────────────────────────────────────────────┘
```

#### Main Content (3 Columns)

**Left Column (60%)**:
```
┌─────────────────────────────────────────────────────────┐
│  📋 Job Description                                     │
│                                                         │
│  About the Role                                        │
│  We're looking for an experienced Senior Software...   │
│                                                         │
│  Requirements                                           │
│  • 5+ years of experience...                           │
│  • Strong knowledge of...                              │
│                                                         │
│  [Read Full Description →]                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  📸 Application Screenshot                              │
│                                                         │
│  [IMAGE: Screenshot of confirmation page]              │
│                                                         │
│  Confirmation page captured at Oct 15, 2025 10:31 AM   │
└─────────────────────────────────────────────────────────┘
```

**Right Column (40%)**:
```
┌──────────────────────────────────────┐
│  📊 Application Details              │
├──────────────────────────────────────┤
│                                      │
│  Status                              │
│  ✅ SUBMITTED                        │
│                                      │
│  Platform                            │
│  🏢 Greenhouse                       │
│                                      │
│  Confirmation ID                     │
│  GH-98765                           │
│                                      │
│  Applied At                          │
│  Oct 15, 2025 10:30 AM              │
│                                      │
│  Processing Time                     │
│  1 minute 23 seconds                 │
│                                      │
│  Cost                                │
│  💰 $0.05                            │
│                                      │
│  ✅ Used Recipe (Saved $0.75)       │
│                                      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  ⏱️ Timeline                          │
├──────────────────────────────────────┤
│                                      │
│  ✅ 10:30:15 - Queued               │
│  ✅ 10:30:18 - Started              │
│  ✅ 10:30:45 - Form filled          │
│  ✅ 10:31:20 - Resume uploaded      │
│  ✅ 10:31:38 - Submitted            │
│  ✅ 10:31:40 - Confirmed            │
│                                      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  📄 Application Data                 │
├──────────────────────────────────────┤
│                                      │
│  Name: John Doe                      │
│  Email: john@example.com            │
│  Phone: +1-555-0123                 │
│  Resume: resume_2025.pdf            │
│  LinkedIn: linkedin.com/in/johndoe  │
│                                      │
│  [Download Application Data]        │
│                                      │
└──────────────────────────────────────┘
```

#### Actions
```
┌────────────────────────────────────────────────────────────┐
│  [📧 Email Confirmation]  [🔗 View Job Posting]           │
│  [📥 Download PDF Report]  [🗑️ Delete Application]        │
└────────────────────────────────────────────────────────────┘
```

---

## 🧩 Component Details

### 1. JobCard Component

**Purpose**: Display job listing with auto-apply functionality

**Props**:
```typescript
interface JobCardProps {
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    description: string;
    atsType: 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'WORKDAY' | 'OTHER';
    aiApplyable: boolean;
    hasRecipe: boolean;
    estimatedCost: number;
    postedAt: Date;
    applyUrl: string;
  };
  onApply: (jobId: string) => void;
  onViewDetails: (jobId: string) => void;
}
```

**Design**:
```
┌──────────────────────────────────────────────────────────┐
│  🏢 {company}                  [ATSBadge] [RecipeBadge] │
│  {title}                                                 │
│  📍 {location} • {remoteStatus}                         │
│  💰 {salary}                                             │
│                                                          │
│  {description (truncated to 2 lines)}                   │
│                                                          │
│  ⚡ {aiApplyable ? 'AI Can Apply' : 'Manual Only'}      │
│  💵 {estimatedCost}                                      │
│                                                          │
│  Posted {timeAgo}                                       │
│                                                          │
│  [View Details]              [{ApplyButton}]            │
└──────────────────────────────────────────────────────────┘
```

**States**:
- Default: White background, border
- Hover: Slight shadow, border color change
- Applied: Muted with "Applied" badge
- Disabled (not AI-applyable): Grayed out, no apply button

**Apply Button Variants**:
- AI-Applyable: "🤖 Auto-Apply" (primary button, green/blue)
- Manual Only: "Apply Manually" (secondary button, opens link)
- Applied: "✅ Applied" (disabled, green)

---

### 2. ATSBadge Component

**Purpose**: Display ATS platform with icon/logo

**Props**:
```typescript
interface ATSBadgeProps {
  atsType: 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'WORKDAY' | 'TALEO' | 'ICIMS' | 'OTHER';
  complexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  showIcon?: boolean;
}
```

**Design**:
```
┌─────────────────┐
│ 🏢 Greenhouse   │  ← SIMPLE platforms (green accent)
└─────────────────┘

┌─────────────────┐
│ ⚙️ Workday      │  ← COMPLEX platforms (red/gray accent)
└─────────────────┘
```

**Platform Icons/Colors**:

| Platform     | Icon | Color      | Complexity |
|--------------|------|------------|------------|
| Greenhouse   | 🌿   | Green      | SIMPLE     |
| Lever        | ⚡   | Blue       | SIMPLE     |
| Ashby        | 📋   | Purple     | SIMPLE     |
| Workday      | ⚙️   | Gray       | COMPLEX    |
| Taleo        | 📊   | Gray       | COMPLEX    |
| iCIMS        | 🏢   | Gray       | COMPLEX    |
| Other        | 📄   | Gray       | MODERATE   |

**Size Variants**:
- Small: 12px height (for lists)
- Medium: 16px height (default)
- Large: 24px height (for details)

---

### 3. ApplicationStatusCard Component

**Purpose**: Display application with real-time status

**Props**:
```typescript
interface ApplicationStatusCardProps {
  application: {
    id: string;
    status: 'QUEUED' | 'APPLYING' | 'SUBMITTED' | 'FAILED';
    job: {
      title: string;
      company: string;
      atsType: string;
    };
    createdAt: Date;
    submittedAt?: Date;
    confirmationId?: string;
    cost?: number;
    error?: string;
  };
  onViewDetails: (id: string) => void;
  onCancel?: (id: string) => void; // Only for QUEUED status
}
```

**Design**:
```
┌──────────────────────────────────────────────────────────┐
│ {StatusIcon} {STATUS}                     {timeAgo}      │
│                                                          │
│ 🏢 {company}                                             │
│ {jobTitle}                                               │
│                                                          │
│ [ATSBadge]  {statusMessage}                             │
│                                                          │
│ 💰 Cost: {cost} • {timestamp}                           │
│                                                          │
│ [{Actions based on status}]                             │
└──────────────────────────────────────────────────────────┘
```

**Status Variants**:

1. **QUEUED** (Blue)
   - Icon: 📅
   - Message: "Position X in queue"
   - Actions: [Cancel] [View Details →]
   - Animation: None

2. **APPLYING** (Yellow/Orange - Animated)
   - Icon: 🔄 (spinning)
   - Message: "Processing..."
   - Actions: [⏳ Processing...] (disabled)
   - Animation: Spinner + pulse effect

3. **SUBMITTED** (Green)
   - Icon: ✅
   - Message: "Confirmation: {confirmationId}"
   - Actions: [View Details →]
   - Animation: None

4. **FAILED** (Red)
   - Icon: ❌
   - Message: "Error: {error}"
   - Actions: [Retry] [View Details →]
   - Animation: None

---

### 4. CostTracker Component

**Purpose**: Visualize cost savings over time

**Props**:
```typescript
interface CostTrackerProps {
  totalApplications: number;
  totalCost: number;
  totalSaved: number;
  savingsPercentage: number;
}
```

**Design**:
```
┌──────────────────────────────────────────────────────────┐
│  💰 Cost Savings                                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Total Spent          Saved           Savings %         │
│  $1.90                $25.10          93%               │
│                                                          │
│  ███████████████████████████████████ 93%                │
│                                                          │
│  {totalApplications} applications                       │
│                                                          │
│  Without Recipes: $27.00                                │
│  With Recipes:    $1.90                                 │
│  You Saved:       $25.10 ✨                             │
│                                                          │
└──��───────────────────────────────────────────────────────┘
```

**Elements**:
- Stats: Spent, Saved, Percentage
- Progress Bar: Visual representation of savings
- Comparison: With vs Without recipes
- Highlight: Total saved amount

**Color Scheme**:
- Spent: Neutral (gray)
- Saved: Success (green)
- Progress bar: Gradient from yellow to green

---

### 5. RecipeIndicator Component

**Purpose**: Show if recipe exists for ATS platform

**Props**:
```typescript
interface RecipeIndicatorProps {
  hasRecipe: boolean;
  atsType: string;
  cost: number;
  variant?: 'badge' | 'detailed';
}
```

**Badge Variant** (for job cards):
```
┌──────────────┐
│ ⚡ Recipe    │  ← Has recipe (green)
│ $0.05        │
└──────────────┘

┌──────────────┐
│ 🎬 Record    │  ← No recipe (yellow)
│ $0.80        │
└──────────────┘
```

**Detailed Variant** (for modals):
```
┌────────────────────────────────────────┐
│  ✅ Recipe Available                   │
│                                        │
│  This platform has a saved recipe.     │
│  Cost: $0.05 (saves $0.75!)           │
│                                        │
│  Used 127 times • 98% success rate    │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  🎬 First-Time Recording               │
│                                        │
│  This will record a new recipe for     │
│  future use.                           │
│                                        │
│  First application: $0.80              │
│  Future applications: $0.05            │
│                                        │
│  This recipe will work for all         │
│  {atsType} jobs!                       │
└────────────────────────────────────────┘
```

---

## 🔌 API Integration

### Endpoints to Integrate

#### 1. Get Jobs
```typescript
GET /api/jobs

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- filter: 'all' | 'ai_applyable' | 'manual'
- atsType: string[] (e.g., ['GREENHOUSE', 'LEVER'])
- location: string
- experience: string
- hasRecipe: boolean

Response:
{
  jobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    description: string;
    atsType: string;
    aiApplyable: boolean;
    hasRecipe: boolean;
    estimatedCost: number;
    postedAt: string;
    applyUrl: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

#### 2. Get Job Stats
```typescript
GET /api/jobs/stats

Response:
{
  total: number;
  aiApplyable: number;
  manualOnly: number;
  byPlatform: {
    [atsType: string]: number;
  };
  withRecipes: number;
  lastSyncAt: string;
}
```

#### 3. Submit Auto-Apply
```typescript
POST /api/auto-apply

Headers:
- Authorization: Bearer {token}

Body:
{
  jobId: string;
}

Response:
{
  success: boolean;
  applicationId: string;
  status: 'QUEUED';
  estimatedCost: number;
  queuePosition: number;
}
```

#### 4. Get My Applications
```typescript
GET /api/my-applications

Headers:
- Authorization: Bearer {token}

Query Parameters:
- status: 'all' | 'queued' | 'applying' | 'submitted' | 'failed'
- page: number
- limit: number

Response:
{
  applications: Array<{
    id: string;
    status: 'QUEUED' | 'APPLYING' | 'SUBMITTED' | 'FAILED';
    job: {
      id: string;
      title: string;
      company: string;
      atsType: string;
    };
    createdAt: string;
    startedAt?: string;
    submittedAt?: string;
    completedAt?: string;
    confirmationId?: string;
    confirmationUrl?: string;
    cost?: number;
    error?: string;
  }>;
  total: number;
  stats: {
    queued: number;
    applying: number;
    submitted: number;
    failed: number;
  };
}
```

#### 5. Get Application Details
```typescript
GET /api/applications/:id

Headers:
- Authorization: Bearer {token}

Response:
{
  application: {
    id: string;
    status: string;
    job: {
      id: string;
      title: string;
      company: string;
      description: string;
      atsType: string;
      applyUrl: string;
    };
    timeline: Array<{
      timestamp: string;
      event: string;
      details: string;
    }>;
    createdAt: string;
    submittedAt?: string;
    confirmationId?: string;
    confirmationUrl?: string; // Screenshot URL
    cost: number;
    applicationData: {
      personalInfo: object;
      resumeUrl: string;
    };
  };
}
```

#### 6. Cancel Application
```typescript
DELETE /api/applications/:id

Headers:
- Authorization: Bearer {token}

Response:
{
  success: boolean;
  message: string;
}

Note: Only works for QUEUED status
```

#### 7. Get User Stats
```typescript
GET /api/auto-apply/stats

Headers:
- Authorization: Bearer {token}

Response:
{
  totalApplications: number;
  submitted: number;
  failed: number;
  totalCost: number;
  totalSaved: number;
  savingsPercentage: number;
  averageCostPerApplication: number;
  successRate: number;
}
```

#### 8. Trigger Job Sync
```typescript
POST /api/jobs/sync

Headers:
- Authorization: Bearer {token}

Response:
{
  success: boolean;
  message: string;
  syncStartedAt: string;
}
```

### Real-Time Updates

For the "APPLYING" status, implement polling or Server-Sent Events:

**Polling Approach** (simpler):
```typescript
// Poll every 3 seconds while status is APPLYING
useEffect(() => {
  if (application.status === 'APPLYING') {
    const interval = setInterval(() => {
      fetchApplicationStatus(application.id);
    }, 3000);

    return () => clearInterval(interval);
  }
}, [application.status]);
```

**SSE Approach** (better UX):
```typescript
GET /api/applications/:id/stream

Response: text/event-stream
event: status-update
data: {"status": "APPLYING", "progress": "Filling form..."}

event: status-update
data: {"status": "SUBMITTED", "confirmationId": "GH-98765"}
```

---

## 🎨 Design System

### Color Palette

**Status Colors**:
```css
/* QUEUED */
--color-queued: #3B82F6;      /* Blue */
--color-queued-bg: #EFF6FF;   /* Light blue background */

/* APPLYING */
--color-applying: #F59E0B;    /* Orange/Amber */
--color-applying-bg: #FEF3C7; /* Light orange background */

/* SUBMITTED */
--color-submitted: #10B981;   /* Green */
--color-submitted-bg: #D1FAE5; /* Light green background */

/* FAILED */
--color-failed: #EF4444;      /* Red */
--color-failed-bg: #FEE2E2;   /* Light red background */
```

**ATS Platform Colors**:
```css
/* SIMPLE (AI-applyable) */
--color-ats-simple: #10B981;     /* Green */
--color-ats-simple-bg: #D1FAE5;

/* MODERATE */
--color-ats-moderate: #F59E0B;   /* Orange */
--color-ats-moderate-bg: #FEF3C7;

/* COMPLEX (Manual only) */
--color-ats-complex: #6B7280;    /* Gray */
--color-ats-complex-bg: #F3F4F6;
```

**Cost/Savings Colors**:
```css
--color-cost-low: #10B981;     /* Green ($0.05) */
--color-cost-high: #F59E0B;    /* Orange ($0.80) */
--color-savings: #10B981;      /* Green */
```

### Typography

**Headings**:
```css
.page-title {
  font-size: 2rem;          /* 32px */
  font-weight: 700;
  color: #111827;
}

.section-title {
  font-size: 1.5rem;        /* 24px */
  font-weight: 600;
  color: #1F2937;
}

.card-title {
  font-size: 1.125rem;      /* 18px */
  font-weight: 600;
  color: #111827;
}
```

**Body Text**:
```css
.body-large {
  font-size: 1rem;          /* 16px */
  line-height: 1.5;
}

.body-medium {
  font-size: 0.875rem;      /* 14px */
  line-height: 1.5;
}

.body-small {
  font-size: 0.75rem;       /* 12px */
  line-height: 1.5;
  color: #6B7280;           /* Muted */
}
```

**Labels & Metadata**:
```css
.label {
  font-size: 0.75rem;       /* 12px */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6B7280;
}

.metadata {
  font-size: 0.875rem;      /* 14px */
  color: #6B7280;
}
```

### Spacing

```css
/* Consistent spacing scale */
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
--space-2xl: 3rem;     /* 48px */

/* Card padding */
--card-padding: var(--space-lg);

/* Section spacing */
--section-gap: var(--space-xl);
```

### Borders & Shadows

```css
/* Borders */
--border-radius-sm: 0.375rem;  /* 6px */
--border-radius-md: 0.5rem;    /* 8px */
--border-radius-lg: 0.75rem;   /* 12px */

--border-color: #E5E7EB;
--border-hover: #D1D5DB;

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

/* Card shadow */
--card-shadow: var(--shadow-sm);
--card-shadow-hover: var(--shadow-md);
```

### Buttons

**Primary Button** (Auto-Apply):
```css
.btn-primary {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius-md);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.btn-primary:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
```

**Secondary Button**:
```css
.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid var(--border-color);
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius-md);
  font-weight: 500;
}

.btn-secondary:hover {
  background: #F9FAFB;
  border-color: var(--border-hover);
}
```

**Disabled Button**:
```css
.btn-disabled {
  background: #E5E7EB;
  color: #9CA3AF;
  cursor: not-allowed;
}
```

### Animations

**Spinning (for APPLYING status)**:
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-applying-icon {
  animation: spin 2s linear infinite;
}
```

**Pulse (for active states)**:
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-applying-card {
  animation: pulse 2s ease-in-out infinite;
}
```

**Slide In**:
```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.job-card {
  animation: slideIn 0.3s ease-out;
}
```

---

## 📐 Mockup Requirements

### What the Designer Should Provide

#### 1. Jobs Browser Page (`/jobs`)
- Full-page mockup with header, sidebar, and job grid
- Job card component (default, hover, applied states)
- Filter sidebar (expanded view)
- Empty state (no jobs found)
- Loading state (skeleton screens)
- Mobile responsive version

#### 2. Auto-Apply Dashboard (`/applications`)
- Full-page mockup with header and stats
- Application cards for each status:
  - QUEUED (with cancel button)
  - APPLYING (with animation indicator)
  - SUBMITTED (with confirmation)
  - FAILED (with retry button)
- Empty state ("No applications yet")
- Cost tracker component
- Filters/tabs bar
- Mobile responsive version

#### 3. Application Details Page (`/applications/:id`)
- Full-page mockup with 2-column layout
- Timeline component
- Screenshot display
- Application data summary
- Action buttons
- Mobile responsive (stacked layout)

#### 4. Components (Standalone)
- JobCard (all states)
- ATSBadge (all platforms)
- ApplicationStatusCard (all statuses)
- CostTracker
- RecipeIndicator (both variants)

#### 5. Modals
- Auto-Apply Confirmation Modal
  ```
  ┌────────────────────────────────────────┐
  │  Confirm Auto-Apply                    │
  ├────────────────────────────────────────┤
  │                                        │
  │  🏢 Stripe                             │
  │  Senior Software Engineer              │
  │                                        │
  │  [Greenhouse] ⚡ Recipe Available      │
  │                                        │
  │  💰 Cost: $0.05                        │
  │  ✅ Recipe will auto-fill application │
  │  ⏱️ Estimated time: 1-2 minutes        │
  │                                        │
  │  Your application will include:        │
  │  • Resume: resume_2025.pdf            │
  │  • Name: John Doe                     │
  │  • Email: john@example.com            │
  │  • Phone: +1-555-0123                 │
  │                                        │
  │  [Cancel]          [Confirm & Apply]  │
  │                                        │
  └────────────────────────────────────────┘
  ```

- Application Success Modal
  ```
  ┌────────────────────────────────────────┐
  │         ✅                             │
  │                                        │
  │  Application Submitted!                │
  │                                        │
  │  Your application to Stripe has been   │
  │  successfully submitted.               │
  │                                        │
  │  Confirmation: GH-98765                │
  │  Cost: $0.05                           │
  │                                        │
  │  [View Details]  [Apply to More Jobs] │
  │                                        │
  └────────────────────────────────────────┘
  ```

#### 6. Dashboard Integration
- Update existing dashboard with "Auto-Apply" section
  ```
  ┌────────────────────────────────────────┐
  │  🤖 Auto-Apply (Beta)                  │
  ├────────────────────────────────────────┤
  │                                        │
  │  2,450 AI-applyable jobs available    │
  │                                        │
  │  📊 Your Stats:                        │
  │  • 24 applications submitted           │
  │  • $1.20 spent (saved $18.80!)        │
  │  • 95% success rate                   │
  │                                        │
  │  [Browse Jobs →]  [My Applications]   │
  │                                        │
  └────────────────────────────────────────┘
  ```

### Design Deliverables Checklist

- [ ] High-fidelity mockups (Figma/Sketch/Adobe XD)
- [ ] Component library with all variants
- [ ] Color palette (hex codes for all colors)
- [ ] Typography specifications (font sizes, weights, line heights)
- [ ] Spacing system (margins, padding, gaps)
- [ ] Icon set (all status icons, platform icons)
- [ ] Animation specifications (timing, easing)
- [ ] Responsive breakpoints (mobile, tablet, desktop)
- [ ] Interactive prototype (click-through flow)
- [ ] Design system documentation

### File Format Requirements

**Preferred**:
- Figma file (with design system + auto-layout)
- Sketch file (with symbols)
- Adobe XD file (with components)

**Also Acceptable**:
- PNG/JPG exports (high resolution, 2x)
- PDF with specifications

**Assets Needed**:
- Platform logos (Greenhouse, Lever, Ashby, Workday, etc.)
- Status icons (SVG preferred)
- Animations (Lottie files or CSS specs)

---

## 🔄 User Scenarios to Design For

### Scenario 1: First-time User
1. Sees "Auto-Apply" on dashboard
2. Clicks "Browse Jobs"
3. Views jobs with "AI Can Apply" badges
4. Clicks "Auto-Apply" on Stripe job
5. Sees confirmation modal explaining the process
6. Confirms and sees "Application Queued" success
7. Redirected to applications dashboard
8. Watches status change from QUEUED → APPLYING → SUBMITTED
9. Receives confirmation

**Design Focus**: Onboarding, education, clear explanations

### Scenario 2: Power User (Batch Apply)
1. Opens jobs browser
2. Filters to "AI-Applyable only"
3. Quickly scans job cards
4. Clicks "Auto-Apply" on 10 jobs in a row
5. Goes to applications dashboard
6. Sees all 10 applications in various states
7. Cost tracker shows total savings

**Design Focus**: Efficiency, batch actions, quick scanning

### Scenario 3: Application Failed
1. User sees "FAILED" status on application
2. Clicks for details
3. Sees error message: "Form field 'Portfolio' not found in recipe"
4. Sees "Retry" button
5. Clicks retry, application goes to QUEUED again
6. Watches it process and succeed

**Design Focus**: Error handling, retry flow, helpful messages

### Scenario 4: First Recording (No Recipe)
1. User applies to Jobvite job (no recipe exists)
2. Confirmation modal shows:
   - "First-time recording: $0.80"
   - "Future Jobvite jobs: $0.05"
3. User confirms
4. Application takes longer (2-3 minutes)
5. Status shows "Recording recipe..."
6. Succeeds, shows "Recipe created! Future Jobvite applications will cost $0.05"

**Design Focus**: Expectation setting, education, value proposition

---

## 📱 Responsive Design Requirements

### Mobile (< 768px)
- Single column layout
- Collapsible filters (bottom sheet or modal)
- Stacked job cards (full width)
- Simplified application cards
- Bottom navigation for tabs

### Tablet (768px - 1024px)
- 2-column job grid
- Sidebar filters (collapsible)
- Compact application cards
- Reduced spacing

### Desktop (> 1024px)
- 3-column job grid
- Fixed sidebar filters
- Full-featured cards
- Optimal spacing

---

## 🎯 Key Design Principles

1. **Clarity**: Users should always know what's happening with their applications
2. **Speed**: Fast loading, optimistic UI updates, instant feedback
3. **Trust**: Clear cost display, confirmation before actions, no surprises
4. **Efficiency**: Minimal clicks to apply, batch actions, smart filters
5. **Delight**: Smooth animations, success celebrations, progress indicators

---

## 📊 Success Metrics to Display

1. **Cost Savings**: Show vs BrowserUse only
2. **Success Rate**: % of submitted vs failed
3. **Time Saved**: Estimated hours saved
4. **Applications**: Total count by status
5. **Recipe Coverage**: % of jobs with recipes

---

## 🚀 Future Enhancements (Not in MVP)

Ideas to keep in mind for design scalability:

1. **Bulk Apply**: Select multiple jobs, apply to all at once
2. **Application Templates**: Save custom answers for different job types
3. **Calendar Integration**: Schedule applications for specific times
4. **Smart Recommendations**: AI suggests which jobs to apply to
5. **Application Analytics**: Track which applications get responses
6. **Custom Filters**: Save filter presets
7. **Job Alerts**: Email/push notifications for new matching jobs

---

## 💬 Copy/Microcopy Guidelines

### Tone
- Friendly but professional
- Clear and concise
- Encouraging and positive
- Transparent about costs and process

### Key Messages

**Value Proposition**:
- "Apply to 100 jobs for $5 instead of $80"
- "93% cost savings with recipe system"
- "One-click applications to 2,450+ companies"

**Trust Building**:
- "Your data is used only for applications"
- "You can cancel queued applications anytime"
- "Review confirmation for every application"

**Call-to-Actions**:
- "Auto-Apply Now" (primary CTA)
- "Browse AI-Applyable Jobs"
- "View My Applications"
- "See How It Works"

**Status Messages**:
- QUEUED: "Your application is in queue (position 3)"
- APPLYING: "Filling out application..."
- SUBMITTED: "Application submitted successfully!"
- FAILED: "Application failed. Retry or apply manually."

**Empty States**:
- No jobs: "No jobs match your filters. Try adjusting your search."
- No applications: "Start auto-applying to jobs with one click!"
- No failed: "Perfect! All your applications succeeded."

---

## ✅ Design Checklist

Before handing off to development:

- [ ] All pages designed for desktop, tablet, mobile
- [ ] All component states covered (default, hover, active, disabled)
- [ ] All status variations designed (queued, applying, submitted, failed)
- [ ] All empty states designed
- [ ] All loading states designed (skeletons)
- [ ] All error states designed
- [ ] Color palette documented with hex codes
- [ ] Typography scale documented
- [ ] Spacing system documented
- [ ] Icons exported as SVG
- [ ] Animations specified with timing/easing
- [ ] Interactive prototype created
- [ ] Accessibility considered (contrast, focus states)
- [ ] Design tokens/variables created

---

**This specification covers everything your designer needs to create a complete, production-ready design for the Auto-Apply frontend system.**

Let me know if you need any clarification or additional details on any section!
