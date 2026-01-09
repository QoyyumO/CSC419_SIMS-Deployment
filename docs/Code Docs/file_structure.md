# Codebase File Structure

This document provides a comprehensive overview of the file structure for the Student Information Management System (SIMS) codebase.

## Overview

The SIMS project is a Next.js application built with TypeScript, using Convex as the backend. The codebase follows a modular architecture with clear separation between frontend components, backend functions, and shared utilities.

## Root Directory Structure

```
CSC419_SIMS-Group_Project/
├── docs/                          # Documentation files
│   ├── Code Docs/                 # Technical documentation
│   ├── QA Documents/              # Quality assurance documentation
│   └── wireframes/                # UI/UX mockups
├── sims/                          # Main application directory
│   ├── .gitignore                 # Git ignore rules
│   ├── .husky/                    # Git hooks
│   ├── .npmrc                     # NPM configuration
│   ├── convex/                    # Backend (Convex) code
│   ├── public/                    # Static assets
│   ├── src/                       # Frontend source code
│   ├── eslint.config.mjs          # ESLint configuration
│   ├── next.config.ts             # Next.js configuration
│   ├── package.json               # Project dependencies
│   ├── postcss.config.mjs         # PostCSS configuration
│   ├── README.md                  # Project readme
│   ├── tsconfig.json              # TypeScript configuration
│   └── svg.d.ts                   # SVG type definitions
└── README.md                      # Root readme
```

## Frontend Structure (`sims/src/`)

### Application Routes (`src/app/`)

The application uses Next.js App Router with route groups for authenticated and non-authenticated sections.

```
src/app/
├── (authenticated)/               # Protected routes (requires authentication)
│   ├── _components/               # Shared dashboard components
│   │   ├── AdminDashboard.tsx
│   │   ├── DepartmentHeadDashboard.tsx
│   │   ├── InstructorDashboard.tsx
│   │   ├── StudentDashboard.tsx
│   │   └── WeeklyCalendarView.tsx
│   ├── academic-sessions/         # Academic session management
│   │   ├── _components/
│   │   │   ├── CreateSessionForm.tsx
│   │   │   ├── CreateTermForm.tsx
│   │   │   ├── SessionsTable.tsx
│   │   │   └── TermsTable.tsx
│   │   └── page.tsx
│   ├── account-settings/          # User account settings
│   │   ├── _components/
│   │   │   ├── ChangePasswordForm.tsx
│   │   │   ├── NotificationSettingsForm.tsx
│   │   │   └── ProfileUpdateForm.tsx
│   │   └── page.tsx
│   ├── alumni/                    # Alumni management
│   │   ├── _components/
│   │   │   ├── AlumniProfileForm.tsx
│   │   │   └── AlumniTable.tsx
│   │   ├── [alumniId]/            # Dynamic alumni detail page
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── courses/                   # Course management
│   │   ├── _components/
│   │   │   ├── AffectedCoursesWarning.tsx
│   │   │   ├── CourseDetailPage.tsx
│   │   │   ├── CoursesTable.tsx
│   │   │   ├── CourseVersionComparison.tsx
│   │   │   ├── CourseVersionHistory.tsx
│   │   │   ├── CourseVersionsPage.tsx
│   │   │   ├── CreateCourseVersionModal.tsx
│   │   │   ├── DepartmentHeadCoursesPage.tsx
│   │   │   ├── PrerequisitesGraph.tsx
│   │   │   └── StudentCoursesPage.tsx
│   │   ├── [courseId]/            # Dynamic course detail page
│   │   │   ├── page.tsx
│   │   │   └── versions/
│   │   │       └── page.tsx
│   │   └── page.tsx
│   ├── departments/               # Department management
│   │   ├── _components/
│   │   │   ├── CreateDepartmentForm.tsx
│   │   │   └── DepartmentsTable.tsx
│   │   └── page.tsx
│   ├── grades/                    # Grade management
│   │   ├── _components/
│   │   │   ├── RegistrarView.tsx
│   │   │   └── StudentView.tsx
│   │   ├── audit-log/             # Grade audit log
│   │   │   └── page.tsx
│   │   ├── calculator/            # Grade calculator
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── graduation/                # Graduation management
│   │   ├── _components/
│   │   │   ├── GraduationApprovalModal.tsx
│   │   │   ├── GraduationHistoryTable.tsx
│   │   │   └── StudentsEligibilityTable.tsx
│   │   └── page.tsx
│   ├── notifications/             # Notifications page
│   │   └── page.tsx
│   ├── processing/                # Processing page
│   │   └── page.tsx
│   ├── programs/                  # Program management
│   │   ├── _components/
│   │   │   ├── CreateProgramForm.tsx
│   │   │   └── ProgramsTable.tsx
│   │   └── page.tsx
│   ├── schools/                   # School management
│   │   ├── _components/
│   │   │   ├── CreateSchoolForm.tsx
│   │   │   └── SchoolsTable.tsx
│   │   └── page.tsx
│   ├── sections/                  # Section/class management
│   │   ├── _components/
│   │   │   ├── CreateSectionModal.tsx
│   │   │   ├── InstructorWorkload.tsx
│   │   │   ├── SectionsTable.tsx
│   │   │   └── TermPlanner.tsx
│   │   ├── [id]/                  # Dynamic section detail page
│   │   │   ├── _components/
│   │   │   │   ├── AssessmentsList.tsx
│   │   │   │   ├── BulkGradeUpload.tsx
│   │   │   │   ├── CreateAssessmentForm.tsx
│   │   │   │   ├── EditAssessmentForm.tsx
│   │   │   │   └── GradebookMatrix.tsx
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── transcript/                # Transcript management
│   │   └── page.tsx
│   ├── users/                     # User management
│   │   ├── _components/
│   │   │   ├── CreateUserForm.tsx
│   │   │   └── UsersTable.tsx
│   │   └── page.tsx
│   ├── layout.tsx                 # Authenticated layout wrapper
│   ├── page.tsx                   # Authenticated home page
│   └── page.tsx                   # Main dashboard
│   ├── (not-authenticated)/       # Public routes
│   │   ├── forgot-password/       # Password reset
│   │   │   ├── _components/
│   │   │   │   └── ForgotPasswordForm.tsx
│   │   │   └── page.tsx
│   │   ├── login/                 # Login page
│   │   │   ├── _components/
│   │   │   │   └── LoginForm.tsx
│   │   │   └── page.tsx
│   │   └── unauthorized/         # Unauthorized access page
│   │       └── page.tsx
│   ├── favicon.ico                # Site favicon
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   ├── not-found.tsx              # 404 page
│   └── Providers.tsx              # Context providers wrapper
```


```
src/components/
├── auth/                          # Authentication components
│   ├── AuthPageLayout.tsx
│   ├── ProtectedRoute.tsx
│   ├── RequireAuth.tsx
│   └── RoleGuard.tsx
├── calendar/                      # Calendar components
│   └── Calendar.tsx
├── charts/                        # Chart components
│   ├── bar/
│   │   └── BarChartOne.tsx
│   ├── doughnut/
│   │   └── DoughnutChart.tsx
│   └── line/
│       └── LineChartOne.tsx
├── common/                        # Common/shared components
│   └── [7 component files]
├── empty-state/                   # Empty state components
│   └── EmptyState.tsx
├── example/                       # Example/demo components
│   └── ModalExample/
│       ├── DefaultModal.tsx
│       ├── FormInModal.tsx
│       ├── FullScreenModal.tsx
│       ├── ModalBasedAlerts.tsx
│       └── VerticallyCenteredModal.tsx
├── form/                          # Form components
│   ├── form-elements/
│   │   ├── CheckboxComponents.tsx
│   │   ├── DefaultInputs.tsx
│   │   ├── DropZone.tsx
│   │   ├── FileInputExample.tsx
│   │   ├── InputGroup.tsx
│   │   ├── InputStates.tsx
│   │   ├── RadioButtons.tsx
│   │   ├── SelectInputs.tsx
│   │   ├── TextAreaInput.tsx
│   │   └── ToggleSwitch.tsx
│   ├── group-input/
│   │   └── PhoneInput.tsx
│   ├── input/
│   │   ├── Checkbox.tsx
│   │   ├── FileInput.tsx
│   │   ├── InputField.tsx
│   │   ├── Radio.tsx
│   │   ├── RadioSm.tsx
│   │   └── TextArea.tsx
│   ├── date-picker.tsx
│   ├── Form.tsx
│   ├── Label.tsx
│   ├── MultiSelect.tsx
│   └── Select.tsx
│   └── switch/
│       └── Switch.tsx
├── header/                        # Header components
│   ├── NotificationDropdown.tsx
│   └── UserDropdown.tsx
├── loading/                       # Loading components
│   └── Loading.tsx
├── role/                          # Role-related components
│   └── RoleCard.tsx
├── search-bar/                    # Search components
│   └── SearchBar.tsx
├── tables/                        # Table components
│   ├── BasicTableOne.tsx
│   ├── GradebookMatrixTable.tsx
│   └── Pagination.tsx
├── ui/                            # UI primitives
│   ├── accordion/
│   │   └── Accordion.tsx
│   ├── alert/
│   │   └── Alert.tsx
│   ├── avatar/
│   │   ├── Avatar.tsx
│   │   └── AvatarText.tsx
│   ├── badge/
│   │   └── Badge.tsx
│   ├── button/
│   │   └── Button.tsx
│   ├── card/
│   │   └── Card.tsx
│   ├── dropdown/
│   │   ├── Dropdown.tsx
│   │   └── DropdownItem.tsx
│   ├── images/
│   │   ├── ResponsiveImage.tsx
│   │   ├── ThreeColumnImageGrid.tsx
│   │   └── TwoColumnImageGrid.tsx
│   ├── modal/
│   │   └── index.tsx
│   ├── table/
│   │   └── index.tsx
│   ├── tabs/
│   │   ├── TabPane.tsx
│   │   └── Tabs.tsx
│   ├── video/
│   │   ├── VideosExample.tsx
│   │   └── YouTubeEmbed.tsx
│   ├── SearchDropdown.tsx
│   └── [additional UI components]
├── user-profile/                  # User profile components
│   ├── AcademicInfoCard.tsx
│   ├── UserAddressCard.tsx
│   ├── UserInfoCard.tsx
│   └── UserMetaCard.tsx
└── videos/                        # Video components
    ├── FourIsToThree.tsx
    ├── OneIsToOne.tsx
    ├── SixteenIsToNine.tsx
    └── TwentyOneIsToNine.tsx
```

### Context Providers (`src/context/`)

```
src/context/
├── AuthContext.tsx                # Authentication context
├── SidebarContext.tsx             # Sidebar state context
└── ThemeContext.tsx               # Theme management context
```

### Custom Hooks (`src/hooks/`)

```
src/hooks/
├── useAuth.ts                     # Authentication hook
├── useCurrentUser.ts              # Current user hook
├── useGoBack.ts                   # Navigation hook
├── useHasRole.ts                  # Role checking hook
└── useModal.ts                    # Modal management hook
```

### Icons (`src/icons/`)

Contains SVG icon files for the application:
- Navigation icons (angle-*, arrow-*, chevron-*)
- UI icons (check-*, close-*, eye-*, lock-*)
- Feature icons (calendar, bell, user-circle, etc.)
- `index.tsx` - Icon component exports

### Layout Components (`src/layout/`)

```
src/layout/
├── AppHeader.tsx                  # Application header
├── AppSidebar.tsx                # Application sidebar
└── Backdrop.tsx                  # Backdrop component
```

### Libraries (`src/lib/`)

```
src/lib/
└── convex.ts                     # Convex client configuration
```

### Services (`src/services/`)

```
src/services/
├── permissions.service.ts        # Permission checking service
└── users.service.ts              # User-related service functions
```

### State Management (`src/store/`)

```
src/store/
└── user.ts                       # User state store
```

### Type Definitions (`src/types/`)

```
src/types/
└── user.type.ts                  # User type definitions
```

### Utilities (`src/utils/`)

```
src/utils/
└── capitalize.ts                # String capitalization utility
```

### Type Definitions

```
src/
└── svg.d.ts                      # SVG module type definitions
```

## Backend Structure (`sims/convex/`)

### Generated Files (`convex/_generated/`)

```
convex/_generated/
├── api.d.ts                      # Generated API types
├── api.js                        # Generated API JavaScript
├── dataModel.d.ts                # Generated data model types
├── server.d.ts                   # Generated server types
└── server.js                     # Generated server JavaScript
```

### Core Backend Files

```
convex/
├── schema.ts                     # Database schema definition
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # Backend documentation
```

### Functions (`convex/functions/`)

Query and action functions organized by domain:

```
convex/functions/
├── academicSessions.ts           # Academic session queries/actions
├── alumni.ts                     # Alumni queries/actions
├── assessments.ts                # Assessment queries/actions
├── auth.ts                       # Authentication functions
├── courses.ts                     # Course queries/actions
├── cron.ts                       # Scheduled tasks
├── dashboard.ts                  # Dashboard data queries
├── department.ts                 # Department queries/actions
├── departments.ts                # Departments queries/actions
├── enrollments.ts                # Enrollment queries/actions
├── grades.ts                     # Grade queries/actions
├── instructors.ts                # Instructor queries/actions
├── notifications.ts              # Notification queries/actions
├── programs.ts                   # Program queries/actions
├── registrar.ts                  # Registrar functions
├── schools.ts                    # School queries/actions
├── transcript.ts                 # Transcript queries/actions
└── users.ts                      # User queries/actions
```

### Mutations (`convex/mutations/`)

Transactional mutation functions:

```
convex/mutations/
├── assessmentMutations.ts        # Assessment mutations
├── courseMutations.ts            # Course mutations
├── enrollmentMutations.ts       # Enrollment mutations
├── gradeMutations.ts             # Grade mutations
├── graduationMutations.ts       # Graduation mutations
├── sectionMutations.ts           # Section mutations
├── transcriptMutations.ts       # Transcript mutations
└── userMutations.ts              # User mutations
```

### Domain Logic (`convex/lib/`)

#### Aggregates (`convex/lib/aggregates/`)

Domain aggregates implementing business logic:

```
convex/lib/aggregates/
├── academicCalendarAggregate.ts  # Academic calendar aggregate
├── courseAggregate.ts            # Course aggregate
├── enrollmentAggregate.ts        # Enrollment aggregate
├── graduationAggregate.ts        # Graduation aggregate
├── index.ts                      # Aggregate exports
├── schoolAggregate.ts            # School aggregate
├── sectionAggregate.ts           # Section aggregate
├── studentAggregate.ts           # Student aggregate
├── transcriptAggregate.ts       # Transcript aggregate
├── types.ts                      # Aggregate type definitions
└── userAggregate.ts              # User aggregate
```

#### Services (`convex/lib/services/`)

Domain services for cross-cutting concerns:

```
convex/lib/services/
├── auditLogService.ts            # Audit logging service
├── courseCatalogService.ts       # Course catalog service
├── enrollmentService.ts          # Enrollment service
├── gradingService.ts             # Grading service
├── graduationService.ts          # Graduation service
├── index.ts                      # Service exports
├── notificationService.ts        # Notification service
├── schedulingService.ts          # Scheduling service
├── sectionService.ts             # Section service
└── transcriptService.ts          # Transcript service
```

#### Utilities (`convex/lib/`)

```
convex/lib/
├── errors.ts                     # Error definitions
└── session.ts                    # Session management
```

### Examples (`convex/examples/`)

```
convex/examples/
└── studentMutations.ts           # Example mutation patterns
```

## Static Assets (`sims/public/`)

```
public/
├── images/
│   ├── error/                    # Error page images
│   │   ├── 404-dark.svg
│   │   ├── 404.svg
│   │   ├── 500-dark.svg
│   │   ├── 500.svg
│   │   ├── 503-dark.svg
│   │   ├── 503.svg
│   │   ├── maintenance-dark.svg
│   │   ├── maintenance.svg
│   │   ├── success-dark.svg
│   │   └── success.svg
│   └── logo/
│       └── logo-alone.png
├── file.svg
├── globe.svg
├── next.svg
├── vercel.svg
└── window.svg
```

## Configuration Files

### Root Configuration

- `.gitignore` - Git ignore patterns
- `.npmrc` - NPM configuration
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript compiler configuration

### Next.js Configuration

- `next.config.ts` - Next.js framework configuration
- `postcss.config.mjs` - PostCSS configuration for styling

### Linting & Code Quality

- `eslint.config.mjs` - ESLint configuration

### Git Hooks

- `.husky/pre-commit` - Pre-commit hook configuration

## Documentation Structure (`docs/`)

```
docs/
├── Code Docs/                    # Technical documentation
│   ├── aggregate_validations.md
│   ├── aggregates_and_invariants.md
│   ├── domain_services.md
│   ├── file_structure.md         # This file
│   ├── schema_documentation.md
│   └── transactional_mutations.md
├── QA Documents/                 # Quality assurance
│   ├── Acceptance Criteria.docx
│   ├── Bug Reports/
│   ├── Overall QA Strategy and Test Plans.docx
│   └── screenshots/
├── team_roles.md                 # Team role assignments
├── wireframes/                   # UI/UX mockups
│   ├── Chibundum_mockups/
│   │   ├── LOGIN/
│   │   ├── STAFF/
│   │   └── STUDENT/
└── [additional documentation files]
```

## Architecture Patterns

### Frontend Architecture

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: CSS (with PostCSS)
- **State Management**: React Context API + Zustand (for user store)
- **Component Organization**: Feature-based with shared components
- **Route Groups**: Used for authentication boundaries

### Backend Architecture

- **Backend**: Convex (serverless backend)
- **Architecture Pattern**: Domain-Driven Design (DDD)
- **Layers**:
  - **Functions**: Public API endpoints (queries/actions)
  - **Mutations**: Transactional write operations
  - **Aggregates**: Domain logic and invariants
  - **Services**: Cross-cutting domain services
- **Schema**: Centralized schema definition with type safety

### Code Organization Principles

1. **Separation of Concerns**: Clear boundaries between UI, business logic, and data access
2. **Feature-Based Organization**: Related functionality grouped together
3. **Component Co-location**: Page-specific components in `_components` folders
4. **Reusability**: Shared components in `src/components/`
5. **Type Safety**: TypeScript throughout with generated types from Convex
6. **Domain-Driven Design**: Backend organized around domain aggregates and services

## File Naming Conventions

- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Utilities**: camelCase (e.g., `capitalize.ts`)
- **Types**: camelCase with `.type.ts` suffix (e.g., `user.type.ts`)
- **Services**: camelCase with `.service.ts` suffix (e.g., `users.service.ts`)
- **Pages**: `page.tsx` (Next.js convention)
- **Layouts**: `layout.tsx` (Next.js convention)
- **Route Groups**: Parentheses (e.g., `(authenticated)`, `(not-authenticated)`)

## Notes

- The `_components` folders contain page-specific components that are not meant to be reused across different routes
- The `_generated` folder in `convex/` contains auto-generated files and should not be edited manually
- Route groups (folders with parentheses) are used for organization but don't affect the URL structure
- Dynamic routes use square brackets (e.g., `[courseId]`, `[alumniId]`)
