# Graph Report - DSM MOS  (2026-08-14)

## Corpus Check
- 184 files · ~69,860 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1141 nodes · 2585 edges · 158 communities (54 shown, 104 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.53)
- Token cost: 128,548 input · 0 output

## Community Hubs (Navigation)
- Alert Dialog & Button UI
- Dialog & Error Notice UI
- Select UI & Delivery Dialog
- Toast & Blocker History
- Production Batch & Gantt UI
- Sales Order Assignments
- Accordion, Avatar & Command UI
- Job Card & History UI
- App Sidebar Navigation
- Generated Route Tree
- Placeholder & Card UI
- TypeScript & Build Config
- Form Input UI Components
- shadcn Component Registry Config
- Server Auth & Error Capture
- Menubar UI Component
- Core NPM Dependencies
- Carousel UI Component
- Generated Route Definitions
- Production UI & Role Decisions
- Quality Control Module (M6)
- Agent Skill & Lifecycle Mapping
- PRD Module & Phase Overview
- Notifications UI & Hooks
- Form Component Primitives
- Tech Stack Documentation
- Lint & Test Dev Dependencies
- Chart UI Component
- Production & Material Schema
- Sheet UI Component
- NPM Scripts
- Breadcrumb UI Component
- Drawer UI Component
- Navigation Menu UI Component
- Implementation Phases M5-M8
- Project Documentation Hierarchy
- Sales Order Module (M1)
- Toggle UI Components
- Audit Log Module (M8)
- Foundation & Blocker Phase
- Package Metadata
- Alert UI Component
- Agent Personas & Ship Command
- Authenticated Layout Routing
- Code & Database Conventions
- RLS Role-Based Access Control
- Engineering Workload View & Bug
- Router Setup
- Agent Execution Rules
- Agent Orchestration Model
- clsx Dependency
- cmdk Dependency
- date-fns Dependency
- App Roles & Separation Rule
- Enum & Routing Rules
- Implementation Order & Supabase Status
- Non-Goals & Storage Bucket Gap
- RLS Matrix & Viewer Regression
- embla-carousel-react Dependency
- eslint Dependency
- @eslint/js Dependency
- eslint-plugin-prettier Dependency
- eslint-plugin-react-hooks Dependency
- gantt-task-react Dependency
- globals Dependency
- @hookform/resolvers Dependency
- input-otp Dependency
- jsdom Dependency
- Lovable Vite Config Dependency
- lucide-react Dependency
- MCP Supabase Config
- nitro Dependency
- jspdf Dependency
- jspdf-autotable Dependency
- @radix-ui/react-accordion Dependency
- @radix-ui/react-alert-dialog Dependency
- @radix-ui/react-aspect-ratio Dependency
- @radix-ui/react-avatar Dependency
- @radix-ui/react-checkbox Dependency
- @radix-ui/react-collapsible Dependency
- @radix-ui/react-context-menu Dependency
- @radix-ui/react-dialog Dependency
- @radix-ui/react-dropdown-menu Dependency
- @radix-ui/react-hover-card Dependency
- @radix-ui/react-label Dependency
- @radix-ui/react-menubar Dependency
- @radix-ui/react-navigation-menu Dependency
- @radix-ui/react-popover Dependency
- @radix-ui/react-progress Dependency
- @radix-ui/react-radio-group Dependency
- @radix-ui/react-scroll-area Dependency
- @radix-ui/react-select Dependency
- @radix-ui/react-separator Dependency
- @radix-ui/react-slider Dependency
- @radix-ui/react-switch Dependency
- @radix-ui/react-tabs Dependency
- @radix-ui/react-toggle-group Dependency
- @radix-ui/react-tooltip Dependency
- react-day-picker Dependency
- react-dom Dependency
- react-hook-form Dependency
- react-resizable-panels Dependency
- recharts Dependency
- tailwind-merge Dependency
- @tailwindcss/vite Dependency
- TanStack Query Dependency
- TanStack Router Dependency
- TanStack Start Dependency
- TanStack Router Plugin Dependency
- tw-animate-css Dependency
- vaul Dependency
- vite-tsconfig-paths Dependency
- zod Dependency
- jest-dom Testing Dependency
- React Testing Library Dependency
- @types/node Dependency
- @types/react Dependency
- TypeScript Dependency
- typescript-eslint Dependency
- Vite Dependency
- Vite React Plugin Dependency
- Vitest Dependency
- Route Type Definitions
- Implementation Plan Overview
- Unrelated Agent-Skills Config
- Skill Creation Process
- Supabase Migration Workflow
- Backend Stack (Supabase-Only)
- Frontend Stack Decision
- Agent Workflow Steps
- Non-Functional Requirements
- Problem Statement
- Batch Creation Permission Rule
- Document Numbering Rule
- SO Auto-Complete Rule
- Customers Table
- Sales Order Items Table
- User Roles Table
- PRD Goals
- Material Waiting Dashboard View
- Production Running Dashboard View
- SPEC Boundaries
- SPEC Code Style Conventions
- SPEC Objective
- Current Project Status
- SPEC Project Structure
- Migration Audit: Already Correct
- Migration Audit: Feature Gaps
- Production Planning Frontend (M4)
- Risks & Mitigations Table

## God Nodes (most connected - your core abstractions)
1. `cn()` - 236 edges
2. `mapPgError()` - 49 edges
3. `notifyError()` - 37 edges
4. `Button` - 35 edges
5. `useMyRoles()` - 27 edges
6. `supabase` - 25 edges
7. `FileRoutesByPath` - 22 edges
8. `Input` - 19 edges
9. `compilerOptions` - 17 edges
10. `Skeleton()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `README Tech Stack (TanStack Start/TS/React/Tailwind)` --semantically_similar_to--> `SPEC Tech Stack (React 19/TS/Vite/TanStack Router+Query/Tailwind v4/shadcn/Bun)`  [INFERRED] [semantically similar]
  README.md → docs/SPEC.md
- `README Dev Commands (npm)` --conceptually_related_to--> `SPEC Commands (bun run dev/build/test/lint, supabase migration, get_advisors)`  [AMBIGUOUS]
  README.md → docs/SPEC.md
- `Root README (Lovable/TanStack Start)` --conceptually_related_to--> `src/routes/README.md (TanStack Start Routing Conventions)`  [INFERRED]
  README.md → src/routes/README.md
- `src/features/production/hooks/use-actor-emails.ts` --conceptually_related_to--> `Table: operators (no login, machine operator master data)`  [INFERRED]
  tasks/plan.md → docs/PRD.md
- `production_batches_create_steps() Trigger` --shares_data_with--> `Table: production_batch_steps`  [EXTRACTED]
  tasks/plan.md → docs/PRD.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **/ship Parallel Fan-Out Review Pattern** — agents_ship_command, agents_persona_code_reviewer, agents_persona_security_auditor, agents_persona_test_engineer [EXTRACTED 1.00]
- **PRD Implementation Milestone Sequence M1-M8** — docs_prd_m1_sales_order, docs_prd_m2_engineering, docs_prd_m3_material, docs_prd_m4_production_planning, docs_prd_m5_production_execution, docs_prd_m6_quality_control, docs_prd_m7_delivery, docs_prd_m8_audit_dashboard [EXTRACTED 1.00]
- **Dual Audit System (audit_logs + per-domain history tables)** — docs_prd_table_audit_logs, docs_prd_table_sales_order_status_history, docs_prd_table_engineering_job_history, docs_prd_table_material_status_history [EXTRACTED 1.00]

## Communities (158 total, 104 thin omitted)

### Community 0 - "Alert Dialog & Button UI"
Cohesion: 0.05
Nodes (74): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogTitle, Button (+66 more)

### Community 1 - "Dialog & Error Notice UI"
Cohesion: 0.07
Nodes (58): ErrorNotice, Props, DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle (+50 more)

### Community 2 - "Select UI & Delivery Dialog"
Cohesion: 0.09
Nodes (46): Card, SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger (+38 more)

### Community 3 - "Toast & Blocker History"
Cohesion: 0.06
Nodes (45): Toaster(), ToasterProps, actorKeyOf(), ActorMilestoneStats(), actorName(), ActorStat, BlockerHistory(), ENG_LABEL (+37 more)

### Community 4 - "Production Batch & Gantt UI"
Cohesion: 0.11
Nodes (40): activeStep(), BatchCard(), isBatchDone(), BatchDetailDrawer(), activeStep(), computeStatus(), parseDate(), PlanningGantt() (+32 more)

### Community 5 - "Sales Order Assignments"
Cohesion: 0.08
Nodes (39): ASSIGNABLE_ROLES, AssignmentRow(), AssignmentsEditor(), KEY, SOAssignmentRow, useDeleteAssignment(), useSOAssignments(), useUpsertAssignment() (+31 more)

### Community 6 - "Accordion, Avatar & Command UI"
Cohesion: 0.08
Nodes (38): AccordionContent, AccordionItem, AccordionTrigger, AlertDialogOverlay, Avatar, AvatarFallback, AvatarImage, Command (+30 more)

### Community 7 - "Job Card & History UI"
Cohesion: 0.11
Nodes (28): JobCard(), FIELD_LABEL, formatValue(), HistoryItem(), isEngStatus(), isUuid(), JobHistory(), EngStatusBadge() (+20 more)

### Community 8 - "App Sidebar Navigation"
Cohesion: 0.08
Nodes (32): items, MenuItem, Separator, Sidebar, SidebarContent, SidebarContext, SidebarContextProps, SidebarFooter (+24 more)

### Community 9 - "Generated Route Tree"
Cohesion: 0.06
Nodes (35): AuthenticatedAdminRoute, AuthenticatedCustomersRoute, AuthenticatedDashboardRoute, AuthenticatedDeliveryIdRoute, AuthenticatedDeliveryRoute, AuthenticatedDeliveryRouteChildren, AuthenticatedDeliveryRouteWithChildren, AuthenticatedDeliveryScheduleRoute (+27 more)

### Community 10 - "Placeholder & Card UI"
Cohesion: 0.12
Nodes (18): Badge(), BadgeProps, badgeVariants, CardContent, CardDescription, CardFooter, CardHeader, CardTitle (+10 more)

### Community 11 - "TypeScript & Build Config"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, ES2022, eslint.config.js, src/**/*.ts, src/**/*.tsx, vite/client, vite.config.ts (+18 more)

### Community 12 - "Form Input UI Components"
Cohesion: 0.09
Nodes (13): Checkbox, HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, Progress, RadioGroup (+5 more)

### Community 13 - "shadcn Component Registry Config"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 14 - "Server Auth & Error Capture"
Cohesion: 0.20
Nodes (10): attachSupabaseAuth, consumeLastCapturedError(), renderErrorPage(), fetch(), getServerEntry(), isH3SwallowedErrorBody(), normalizeCatastrophicSsrResponse(), ServerEntry (+2 more)

### Community 15 - "Menubar UI Component"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 16 - "Core NPM Dependencies"
Cohesion: 0.13
Nodes (15): class-variance-authority, dependencies, class-variance-authority, @radix-ui/react-slot, @radix-ui/react-toggle, react, sonner, @supabase/supabase-js (+7 more)

### Community 17 - "Carousel UI Component"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 18 - "Generated Route Definitions"
Cohesion: 0.14
Nodes (14): Route, Route, Route, Route, Route, Route, Route, Route (+6 more)

### Community 19 - "Production UI & Role Decisions"
Cohesion: 0.17
Nodes (13): Kanban/Gantt Must NOT Use Drag-and-Drop, UI Style (Linear/Notion/Stripe, <=3 clicks, big buttons, dark mode ready), Decision #10: No Auto-Fill estimated_delivery_date (Not Final), Decision #7: Single Per-Batch Kanban, Simplified from v2 Dual View, Decision #3: Single Production Role, Reversed from v2 Per-Station Roles, Module M5: Production Execution, Confirmed Decisions Table (§11, 16 items), Role Notes (Eng vs Material, Planning vs Production, single production role) (+5 more)

### Community 20 - "Quality Control Module (M6)"
Cohesion: 0.22
Nodes (13): Module M6: Quality Control, QC Offline Submit-Only Requirement, Business Rule #4: Delivery Requires Final Step QC Pass, Business Rule #2: QC Per-Step Gate, Business Rule #3: Rework Only via RPC, Table: deliveries, Table: delivery_items, Table: qc_inspections (per-step, no photo) (+5 more)

### Community 21 - "Agent Skill & Lifecycle Mapping"
Cohesion: 0.24
Nodes (12): Intent to Skill Mapping, Lifecycle Mapping (DEFINE/PLAN/BUILD/VERIFY/REVIEW/SHIP), api-and-interface-design Skill, code-review-and-quality Skill, code-simplification Skill, debugging-and-error-recovery Skill, frontend-ui-engineering Skill, incremental-implementation Skill (+4 more)

### Community 22 - "PRD Module & Phase Overview"
Cohesion: 0.20
Nodes (12): Module M2: Engineering, Module M3: Material Status, Module M4: Production Planning, Module M7: Delivery, Business Rule #5: Delivery Draft Requires Planned Dates, SPEC Success Criteria (per-module DoD table), Phase M2: Engineering, Phase M3: Material Status (+4 more)

### Community 23 - "Notifications UI & Hooks"
Cohesion: 0.35
Nodes (9): NotificationsBell(), PopoverContent, KEY, NotificationRow, useMarkAllRead(), useMarkNotificationRead(), useNotifications(), useNotificationsRealtime() (+1 more)

### Community 24 - "Form Component Primitives"
Cohesion: 0.23
Nodes (10): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+2 more)

### Community 25 - "Tech Stack Documentation"
Cohesion: 0.20
Nodes (11): PRD Architecture & Stack (React/TS/Vite/React Router/TanStack Query/Tailwind/shadcn, Supabase, gantt-task-react), SPEC Commands (bun run dev/build/test/lint, supabase migration, get_advisors), SPEC Tech Stack (React 19/TS/Vite/TanStack Router+Query/Tailwind v4/shadcn/Bun), README Dev Commands (npm), Root README (Lovable/TanStack Start), Lovable Platform, README Tech Stack (TanStack Start/TS/React/Tailwind), src/routes/README.md (TanStack Start Routing Conventions) (+3 more)

### Community 26 - "Lint & Test Dev Dependencies"
Cohesion: 0.18
Nodes (11): eslint-config-prettier, eslint-plugin-react-refresh, devDependencies, eslint-config-prettier, eslint-plugin-react-refresh, prettier, @testing-library/user-event, @types/react-dom (+3 more)

### Community 27 - "Chart UI Component"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 28 - "Production & Material Schema"
Cohesion: 0.31
Nodes (10): Business Rule #1: Production Stage Gate (approved+material_ready, sequential), Table: engineering_jobs, Table: material_statuses, Table: operators (no login, machine operator master data), Table: production_batch_steps, Table: production_batches (routing jsonb), Local Migration Audit Findings Table, production_batches_create_steps() Trigger (+2 more)

### Community 29 - "Sheet UI Component"
Cohesion: 0.25
Nodes (8): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 30 - "NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, build:dev, dev, format, lint, preview, test

### Community 31 - "Breadcrumb UI Component"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 32 - "Drawer UI Component"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 33 - "Navigation Menu UI Component"
Cohesion: 0.29
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 34 - "Implementation Phases M5-M8"
Cohesion: 0.25
Nodes (8): Phase M5: Production Execution, Phase M6: Quality Control, Phase M7: Delivery, Phase M8: Audit Log & Dashboard, Todo M5: Production Execution, Todo M6: Quality Control, Todo M7: Delivery, Todo M8: Audit Log & Dashboard

### Community 35 - "Project Documentation Hierarchy"
Cohesion: 0.38
Nodes (7): docs/CLAUDE.md (Permanent Hard Rules), DSM MOS Scope (SO->Eng->Prod->QC->Delivery, not ERP), CLAUDE.md Non-Goals (CRM/Purchasing/Inventory/Finance/HR/Payroll), docs/PRD.md v3 (Requirement Source of Truth), docs/SPEC.md (Technical Spec Derived from PRD), tasks/plan.md (Implementation Plan), tasks/todo.md (Daily Task Checklist)

### Community 36 - "Sales Order Module (M1)"
Cohesion: 0.33
Nodes (7): Module M1: Sales Order, Business Rule #11: SO Status Change Triggers History + Notification, Table: notifications (in-app, realtime), Table: sales_order_assignments (PIC per role), Table: sales_order_status_history, Table: sales_orders, sales_order_assignments SELECT Too Restrictive

### Community 37 - "Toggle UI Components"
Cohesion: 0.43
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 38 - "Audit Log Module (M8)"
Cohesion: 0.33
Nodes (6): Dual Audit System: audit_logs + *_history Kept Intentionally, Module M8: Audit Log & Dashboard, Table: audit_logs (forensic, admin-only), Table: engineering_job_history, Table: material_status_history, View: v_dashboard_so_status

### Community 39 - "Foundation & Blocker Phase"
Cohesion: 0.33
Nodes (6): Phase 0: Blocker & Audit, Phase M0: Foundation, Phase M1: Sales Order + Notifikasi, Todo M0: Foundation, Todo M1: Sales Order + Notifikasi, Todo Phase 0: Blocker & Audit

### Community 40 - "Package Metadata"
Cohesion: 0.40
Nodes (4): name, private, sideEffects, type

### Community 41 - "Alert UI Component"
Cohesion: 0.50
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 42 - "Agent Personas & Ship Command"
Cohesion: 0.50
Nodes (4): code-reviewer Persona, security-auditor Persona, test-engineer Persona, /ship Slash Command

### Community 44 - "Code & Database Conventions"
Cohesion: 0.67
Nodes (3): Code Conventions (TS strict no any, custom hook per feature, src/features structure), Database Conventions (uuid PK, numeric(18,4), enum types, sequence doc numbers, RPC transactions), Custom Hook Wraps Supabase Query Pattern

### Community 45 - "RLS Role-Based Access Control"
Cohesion: 0.67
Nodes (3): public.has_role(_user_id uuid, _role app_role), RLS Enabled Every Table, No Exceptions, user_roles Table (role source of truth)

### Community 46 - "Engineering Workload View & Bug"
Cohesion: 1.00
Nodes (3): View: v_engineering_workload, get_engineering_workload() RPC Access Bug, src/features/engineering/hooks/use-workload.ts

## Ambiguous Edges - Review These
- `README Dev Commands (npm)` → `SPEC Commands (bun run dev/build/test/lint, supabase migration, get_advisors)`  [AMBIGUOUS]
  src/routes/README.md · relation: conceptually_related_to
- `PRD Architecture & Stack (React/TS/Vite/React Router/TanStack Query/Tailwind/shadcn, Supabase, gantt-task-react)` → `SPEC Tech Stack (React 19/TS/Vite/TanStack Router+Query/Tailwind v4/shadcn/Bun)`  [AMBIGUOUS]
  docs/SPEC.md · relation: conceptually_related_to

## Knowledge Gaps
- **349 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+344 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **104 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `README Dev Commands (npm)` and `SPEC Commands (bun run dev/build/test/lint, supabase migration, get_advisors)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `PRD Architecture & Stack (React/TS/Vite/React Router/TanStack Query/Tailwind/shadcn, Supabase, gantt-task-react)` and `SPEC Tech Stack (React 19/TS/Vite/TanStack Router+Query/Tailwind v4/shadcn/Bun)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `cn()` connect `Accordion, Avatar & Command UI` to `Alert Dialog & Button UI`, `Dialog & Error Notice UI`, `Select UI & Delivery Dialog`, `Production Batch & Gantt UI`, `Job Card & History UI`, `App Sidebar Navigation`, `Placeholder & Card UI`, `Form Input UI Components`, `Menubar UI Component`, `Carousel UI Component`, `Notifications UI & Hooks`, `Form Component Primitives`, `Chart UI Component`, `Sheet UI Component`, `Breadcrumb UI Component`, `Drawer UI Component`, `Navigation Menu UI Component`, `Toggle UI Components`, `Alert UI Component`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Core NPM Dependencies` to `Package Metadata`, `clsx Dependency`, `cmdk Dependency`, `date-fns Dependency`, `embla-carousel-react Dependency`, `gantt-task-react Dependency`, `@hookform/resolvers Dependency`, `input-otp Dependency`, `lucide-react Dependency`, `jspdf Dependency`, `jspdf-autotable Dependency`, `@radix-ui/react-accordion Dependency`, `@radix-ui/react-alert-dialog Dependency`, `@radix-ui/react-aspect-ratio Dependency`, `@radix-ui/react-avatar Dependency`, `@radix-ui/react-checkbox Dependency`, `@radix-ui/react-collapsible Dependency`, `@radix-ui/react-context-menu Dependency`, `@radix-ui/react-dialog Dependency`, `@radix-ui/react-dropdown-menu Dependency`, `@radix-ui/react-hover-card Dependency`, `@radix-ui/react-label Dependency`, `@radix-ui/react-menubar Dependency`, `@radix-ui/react-navigation-menu Dependency`, `@radix-ui/react-popover Dependency`, `@radix-ui/react-progress Dependency`, `@radix-ui/react-radio-group Dependency`, `@radix-ui/react-scroll-area Dependency`, `@radix-ui/react-select Dependency`, `@radix-ui/react-separator Dependency`, `@radix-ui/react-slider Dependency`, `@radix-ui/react-switch Dependency`, `@radix-ui/react-tabs Dependency`, `@radix-ui/react-toggle-group Dependency`, `@radix-ui/react-tooltip Dependency`, `react-day-picker Dependency`, `react-dom Dependency`, `react-hook-form Dependency`, `react-resizable-panels Dependency`, `recharts Dependency`, `tailwind-merge Dependency`, `@tailwindcss/vite Dependency`, `TanStack Query Dependency`, `TanStack Router Dependency`, `TanStack Start Dependency`, `TanStack Router Plugin Dependency`, `tw-animate-css Dependency`, `vaul Dependency`, `vite-tsconfig-paths Dependency`, `zod Dependency`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `supabase` connect `Select UI & Delivery Dialog` to `Alert Dialog & Button UI`, `Dialog & Error Notice UI`, `Toast & Blocker History`, `Production Batch & Gantt UI`, `Sales Order Assignments`, `Job Card & History UI`, `Placeholder & Card UI`, `Authenticated Layout Routing`, `Server Auth & Error Capture`, `Notifications UI & Hooks`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _349 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Alert Dialog & Button UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05412371134020619 - nodes in this community are weakly interconnected._