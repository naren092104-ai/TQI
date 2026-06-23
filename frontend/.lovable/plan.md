# TQI Super Admin Command Center — Build Plan

A complete frontend-only admin platform. No backend, no auth logic — just realistic mock data held in a Zustand store and rich, interactive UI.

## Design System

- **Palette**: Primary `#0B3D91` (deep navy), Secondary `#FF7A00` (orange), background `#F8FAFC`, white cards, light-gray borders. Defined as `oklch` tokens in `src/styles.css` with gradients + elevation tokens.
- **Typography**: Inter loaded via `<link>` in `__root.tsx`.
- **Components**: shadcn primitives + custom variants (`hero`, `premium`). Lucide icons. Recharts for graphs.
- **Feel**: Google Admin / Linear / Notion — dense data, soft shadows, crisp dividers, rounded-xl cards.

## Architecture

- **State**: Zustand store seeded with realistic mock data (clusters → panchayats → villages → schools → students/volunteers, sessions, attendance, homework, finance, advances, refunds, approvals, timelines, notifications, audit logs, admins, academic years). Persisted to `localStorage`.
- **Routing**: TanStack Start file-based routes under `src/routes/`. `_app` layout with sidebar + topbar wraps all admin pages; `/login` is standalone.
- **Mock interactivity**: all create/edit/delete/approve/reject mutate the store; toasts confirm.

## Routes

```
/login                     standalone login + first-login password modal
/_app/                     sidebar shell (root layout for admin)
  /                        Dashboard (KPIs + charts + quick actions)
  /academic-years
  /clusters                + hierarchy tree visualization
  /panchayats
  /villages
  /schools
  /colleges
  /admins
  /students                + profile drawer + bulk import/export UI
  /volunteers
  /sessions                tabs: Kanban | Calendar | Timeline
  /attendance              tabs: Students | Volunteers | Bulk
  /homework
  /finance                 finance command center
  /advance                 advance dashboard + auto calculator
  /refunds
  /approvals               tabs: Finance | Advance | Refund | Timeline | Extensions
  /reports                 report builder + export buttons
  /notifications
  /timeline                Calendar | Kanban | Timeline views
  /audit-logs
  /settings                tabs: System | Profile | Email | Finance | Timeline | Security | Password
```

## Key Interactive Pieces

- **Hierarchical creation**: village form loads panchayats after cluster pick; school form chains cluster→panchayat→village; student form auto-fills the chain from school.
- **Hierarchy tree**: collapsible tree on `/clusters` showing the full org tree with counts.
- **Bill management**: upload (file input → preview) AND "Scan Bill" opens a camera modal using `navigator.mediaDevices.getUserMedia` with capture → preview → attach. Multiple bills per expense, each viewable/zoomable/rotatable/replaceable.
- **Advance auto-calculator**: live `Advance − Expenses = Balance` display.
- **Finance timeline**: visual vertical timeline (Advance → Expense → Approved → Refund → Closed).
- **Approvals**: approve/reject with remarks modal; PDF preview modal before download (mock summary card).
- **Reports**: filters + Export PDF/Excel/CSV buttons (generate mock files client-side).
- **Audit logs**: filter table with mock events + export.

## Universal Button Contract

Every Add → modal, Edit → prefilled modal, Delete → confirm dialog, View → drawer, Export → download mock file, Search/Filter → live table filter, Pagination → working, Upload → preview, Scan → camera UI, Approve/Reject → status update + toast.

## Responsiveness

- Sidebar collapses to icon strip ≥md and to a Sheet drawer on mobile.
- All tables wrap in horizontal scroll containers; KPI grids use `grid-cols-2 md:grid-cols-3 xl:grid-cols-5`.
- Forms stack on mobile, two-column on `md+`.

## Deliverable Scope

Production-quality UI for all 24 sections, every button wired to store or mock action, realistic seed data (5 clusters, ~15 panchayats, ~40 villages, ~60 schools, ~400 students, etc.). No backend.

## Technical Notes

- Zustand + `persist` middleware (add dep).
- Recharts (add dep).
- `react-day-picker` already present via shadcn calendar.
- All colors via semantic tokens — no hard-coded hex in components.
- SEO: title/description on each route head.

Ready to build on approval.