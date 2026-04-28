# EduTech Project Documentation

## 1) Design Choices and Rationale

### System Architecture
- Frontend is implemented with plain HTML, CSS, and JavaScript in a SPA-style render flow to satisfy assignment constraints while keeping deployment simple.
- Backend uses Flask with modular routes (`auth`, `student`, `admin`, `chat`, `course`) to separate responsibilities and keep API maintenance manageable.
- MySQL is used as the primary persistent store because the project requires relational entities (users, enrollments, assignments, orders, forum, comments) with clear foreign-key relationships.

### UI/UX Strategy
- Student and admin experiences are intentionally separated to reduce cognitive load and avoid exposing admin actions in student workflows.
- Admin dashboard is action-oriented (courses, books, forum, users, support) so operational tasks map directly to tabbed modules.
- Course Studio now uses per-subject expansion behavior to avoid presenting all stream actions at once.

### Data Strategy
- Frontend collections are fetched from API endpoints; no static mock arrays are used as runtime source of truth.
- User-scoped data (progress, saved resources, cart, orders) is isolated by authenticated identity and reset on logout.
- Course progress is database-driven (`completed submissions / total assignments`) and rendered from API responses.

## 2) Implementation Process

### Phase A: Frontend Foundation
- Built core pages: landing, auth, dashboard, courses, forum, bookstore, profile/settings/payment.
- Implemented responsive behavior using CSS Grid/Flex and mobile breakpoints.

### Phase B: Backend and Database
- Rebuilt backend in Flask and integrated MySQL schema with core academic and commerce entities.
- Added authentication endpoints and role-based authorization decorators.
- Connected student/admin actions to persistent API endpoints.

### Phase C: Full Data-Driven Conversion
- Removed frontend mock runtime dependencies.
- Wired all key user actions to backend persistence:
  - enrollments
  - assignment submissions
  - forum posts/replies
  - chat messages
  - cart checkout/orders

### Phase D: Admin Operations
- Added admin CRUD for courses, books, forum moderation, and user management.
- Added file uploads for course materials and image uploads for books.
- Added per-content comment capability for educational guidance.

### Phase E: Stabilization and Quality
- Fixed render-boundary bugs (search focus/dropdown state resets) by moving to state-driven partial updates.
- Added visual and workflow refinements to admin modules.
- Added backward-compatible password security upgrade path (legacy plaintext login upgrades to hashed password on successful auth).

## 3) Usability, Accessibility, and Security Reflection

### Usability
- Strengths:
  - Clear role separation (student/admin).
  - Feature coverage aligns with learning platform workflows (content, forum, bookstore, support chat).
  - Admin actions are direct and task-centered.
- Current opportunities:
  - Add keyboard shortcuts for common admin tasks.
  - Add sticky context/header in long admin modules for faster orientation.
  - Add richer empty states and inline success indicators.

### Accessibility
- Current practices:
  - Semantic form controls and labels are used across major forms.
  - Responsive layout supports mobile and tablet use.
- Recommended improvements:
  - Add explicit ARIA labels for icon-only controls.
  - Perform contrast audit for all theme states.
  - Add stronger focus outlines and tab-order checks.
  - Validate with screen-reader testing flow.

### Security
- Implemented:
  - Auth token-based access control with role checks.
  - Route protection for privileged actions.
  - Password hashing for new registrations and automatic upgrade from legacy plaintext records on successful login.
  - File upload handling with secure filenames.
- Recommended next hardening:
  - Rate limiting for auth and post endpoints.
  - CSRF strategy for cookie-based deployments (if moved away from token header pattern).
  - Enforce stronger password policy and account lockout thresholds.
  - Centralized input validation schema for all write endpoints.

## 4) Checklist Mapping

### 1. Homepage
- Clear navigation and engaging design: implemented.
- Responsive desktop/mobile layout: implemented.

### 2. Course Content Pages
- Subject/module organization: implemented.
- Materials and assignments with real backend data: implemented.
- Interactive learning components: baseline implemented (assignment types + admin content), can be extended with timed quizzes and scoring analytics.

### 3. Student Portal
- Login/registration: implemented.
- Personalized progress and saved resources: implemented.

### 4. Discussion Forum / Q&A
- Student posting and replies: implemented.
- Admin moderation tools: implemented.

### 5. Bookstore Module
- Catalog/search/categories/cart/checkout: implemented.
- Inventory/user/order DB integration: implemented.

### 6. Technical Stack
- Frontend: HTML/CSS/JavaScript.
- Backend: Flask (Python).
- Database: MySQL.

### 7. Documentation
- This file provides design rationale, implementation process, and reflection on usability/accessibility/security.
