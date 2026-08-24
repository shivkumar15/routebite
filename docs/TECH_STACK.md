# RouteBite — Technology Stack

> **Status:** Prototype technology specification
>
> This document locks the technology choices for the first working RouteBite prototype and explains each technology in enough detail that a developer unfamiliar with a tool can understand **what it does, why it is present, where it is used, and what to learn before changing it**.
>
> It must remain consistent with `PROJECT_CONTEXT.md`, `DECISIONS.md`, `USER_FLOWS.md`, `PRODUCT_REQUIREMENTS.md`, `PAYMENT_FLOW.md`, `MATCHING_ENGINE.md`, and `ARCHITECTURE.md`.

---

# 1. Technology Goal

The RouteBite prototype should optimize for:

1. **Correctness** — business rules must be difficult to violate accidentally.
2. **Low bug surface** — avoid unnecessary services, frameworks, and synchronization problems.
3. **Fast iteration** — one developer should be able to understand and modify the complete system.
4. **Strong typing** — many mistakes should be caught before the application runs.
5. **Easy debugging** — when an order fails, we should be able to determine why.
6. **Portable deployment** — the application should not become trapped inside one hosting vendor.
7. **Clear path to production** — temporary prototype choices should be replaceable without redesigning the whole product.

The guiding rule is:

> **Use boring, mature technology for business-critical code and introduce specialized infrastructure only when the product actually needs it.**

---

# 2. Final Prototype Stack — Summary

| Layer | Technology | Purpose |
|---|---|---|
| Language | **TypeScript** | Shared strongly typed language across frontend/backend |
| Runtime | **Node.js (current LTS, pinned)** | Runs backend API and worker |
| Package manager | **pnpm** | Dependency management + workspace/monorepo support |
| Frontend | **React + Vite** | Role-aware customer/partner/admin web application |
| Routing | **React Router** | Client-side page/navigation routing |
| Server-state client | **TanStack Query** | API fetching, caching, retry and invalidation |
| Local UI state | **Zustand (only where needed)** | Small temporary client-only state |
| Forms | **React Hook Form** | Form state and validation integration |
| Shared validation/contracts | **Zod** | Runtime validation + shared API schemas |
| Styling | **Tailwind CSS** | Fast consistent UI styling |
| UI components | **shadcn/ui-style local components** | Accessible reusable UI without a heavy runtime UI framework |
| Backend framework | **NestJS** | Structured modular-monolith API and application services |
| HTTP API | **REST/JSON** | Business commands and authoritative reads |
| Realtime | **Socket.IO through NestJS** | Live order/offer/location UI events |
| Database | **PostgreSQL** | Authoritative transactional source of truth |
| ORM / migrations | **Prisma** | Type-safe DB access and schema migrations |
| Durable background jobs | **pg-boss** | Postgres-backed jobs/timeouts without Redis |
| Managed DB/Auth/Storage | **Supabase** | Hosted Postgres, authentication, private file storage |
| Maps | **Google Maps Platform** | Places, pins, routes, distance, ETA, route matrix |
| Payments | **Razorpay Test Mode** | Prototype checkout/payment flow |
| File storage | **Supabase Storage private buckets** | Partner documents, profile images, receipts |
| Logging | **Pino structured logging** | Debuggable backend logs |
| API documentation | **OpenAPI/Swagger** | Human-readable API contract and testing |
| Backend unit/integration tests | **Jest + Supertest** | Service and HTTP API testing |
| Frontend tests | **Vitest + React Testing Library** | Component/business UI tests |
| End-to-end tests | **Playwright** | Browser-level critical-flow testing |
| Code quality | **ESLint + Prettier + TypeScript strict mode** | Prevent common mistakes and normalize code style |
| CI | **GitHub Actions** | Automated checks before merge/deploy |
| Containers | **Docker** | Repeatable backend/worker runtime |
| Frontend hosting | **Vercel** | Simple static/web frontend deployment |
| Backend/worker hosting | **Railway** | Long-running Node API + worker deployment |
| Monitoring | **Health checks + structured logs; Sentry optional** | Prototype visibility and debugging |

The exact package versions should be selected at project scaffolding time, committed to `package.json` / `pnpm-lock.yaml`, and upgraded intentionally. Do **not** automatically chase every new major version during prototype development.

---

# 3. Why TypeScript Everywhere

## What TypeScript Is

TypeScript is JavaScript with a compile-time type system.

JavaScript allows this:

```ts
function completeOrder(order) {
  return order.customerId.toUpperCase();
}
```

If `customerId` is missing or is a number, JavaScript may fail only at runtime.

TypeScript lets us describe the expected structure:

```ts
type Order = {
  id: string;
  customerId: string;
  status: OrderStatus;
};
```

The compiler can then detect many incorrect usages before the application is deployed.

## Why RouteBite Uses TypeScript

RouteBite has many values that must never be confused:

```text
order status
payment status
partner verification status
trip status
partner availability status
price adjustment status
```

Strong typing reduces bugs such as:

```text
comparing payment status to an order status
forgetting a required order ID
sending a number where an ISO timestamp is expected
returning a nullable partner where assignment requires one
```

Using TypeScript on both frontend and backend also means the developer switches languages less often.

## Important Rule

TypeScript types are **not runtime security**.

An attacker can still send arbitrary JSON to the API.

That is why RouteBite also uses **Zod runtime validation** at system boundaries.

## Learn These TypeScript Topics

Before working deeply in RouteBite, understand:

- primitive and object types,
- interfaces vs type aliases,
- unions,
- discriminated unions,
- generics,
- `unknown` vs `any`,
- optional and nullable values,
- type narrowing,
- enums vs string-literal unions,
- async/Promise typing,
- strict null checking,
- utility types such as `Pick`, `Omit`, `Partial`, `Record`.

For this project, discriminated unions are especially useful for state-oriented code.

---

# 4. Node.js — Backend Runtime

## What Node.js Is

Node.js is a JavaScript/TypeScript runtime that runs outside the browser.

Our backend API and background worker execute on Node.js.

Node is especially suitable for RouteBite because much of the backend work is I/O:

```text
HTTP requests
PostgreSQL queries
Google Maps requests
Razorpay callbacks
WebSocket connections
file metadata operations
```

## Version Policy

Use the **current Node.js LTS release at project setup time**.

Pin it using a file such as:

```text
.nvmrc
```

or package metadata.

All developers, CI, API deployment, and worker deployment should use the same major Node version.

Do not develop locally on one Node major version and deploy another without testing.

## Learn These Node.js Topics

- event loop,
- async/await,
- promises,
- process/environment variables,
- error handling,
- module system,
- HTTP request lifecycle,
- graceful shutdown,
- signals such as `SIGTERM`,
- why CPU-heavy synchronous work can block the event loop.

---

# 5. pnpm — Package Management and Monorepo

## What pnpm Does

`pnpm` installs JavaScript dependencies and manages multiple related applications/packages in one repository.

RouteBite should use a small monorepo so frontend and backend can share API contracts without duplicating them.

Recommended structure:

```text
routebite/
├── apps/
│   ├── web/              # React application
│   └── server/           # NestJS codebase
│       ├── src/main.ts   # HTTP/WebSocket API entry point
│       └── src/worker.ts # background worker entry point
│
├── packages/
│   ├── contracts/        # Zod API schemas and shared DTO types
│   └── config/           # safe shared constants/types if useful
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## Why Not Add Turborepo Initially

Turborepo is useful for large monorepos and build caching, but RouteBite currently has only a few packages.

`pnpm` workspaces are enough.

Adding another orchestration layer before it solves a real problem increases setup/debugging work.

## Learn

- `package.json`,
- dependencies vs devDependencies,
- lockfiles,
- workspace packages,
- scripts,
- semantic version ranges,
- why lockfiles must be committed.

---

# 6. React — Frontend UI

## What React Does

React builds the web interface as reusable components.

RouteBite uses **one role-aware React application** for:

```text
customer screens
partner screens
admin screens
```

We are not building separate native apps in the first prototype.

## Why React

React fits RouteBite because the UI is heavily state-driven:

```text
MATCHING
ASSIGNED
PARTNER_TO_PICKUP
PRICE_CONFIRMATION_REQUIRED
OUT_FOR_DELIVERY
COMPLETED
```

Each backend state can map to explicit UI behavior.

React also has strong ecosystem support for maps, forms, data fetching, and testing.

## Critical Architecture Rule

**React does not own business truth.**

The database/backend owns whether an order is assigned, paid, cancelled, or completed.

Frontend state is only a view of backend state.

For example, never do:

```ts
setOrderStatus("COMPLETED");
```

and assume the order is actually complete.

Instead:

```text
frontend sends command
      ↓
backend validates transition
      ↓
database transaction commits
      ↓
frontend receives updated state
```

## Learn

- components,
- props,
- state,
- hooks,
- `useEffect`,
- controlled forms,
- conditional rendering,
- context,
- component composition,
- error boundaries,
- render lifecycle.

Avoid placing all application logic inside `useEffect` chains. That often creates hard-to-debug frontend races.

---

# 7. Vite — Frontend Build Tool

## What Vite Does

Vite provides the local development server and production build system for the React app.

It handles:

```text
TypeScript compilation pipeline
fast hot reload
frontend environment variables
production asset bundling
```

## Why Vite Instead of a Full-Stack React Framework

RouteBite already has a dedicated NestJS backend.

We do not need Next.js server actions, server components, or another backend runtime in the frontend project.

Using React + Vite keeps the responsibility clear:

```text
Vite/React = browser UI
NestJS     = business backend
```

That separation reduces accidental duplication of backend logic.

---

# 8. React Router — Navigation

React Router manages client-side routes such as:

```text
/login
/order/new
/orders/:orderId
/partner
/partner/trips/:tripId
/admin/orders
```

Route guards in the UI improve user experience, but **real authorization must always be checked by the backend**.

Example:

```text
UI hides Admin page            → convenience
Backend rejects non-admin API  → security
```

Never rely on frontend route hiding for security.

---

# 9. TanStack Query — Server State

## What Problem It Solves

A frontend repeatedly needs backend data:

```text
current user
order details
partner status
trip status
admin queue
```

Naively storing all of this manually in global state causes bugs involving stale data, duplicate loading flags, and inconsistent retries.

TanStack Query manages **server state**:

- fetching,
- caching,
- refetching,
- invalidation,
- retries,
- loading/error states.

## RouteBite Rule

Use TanStack Query for data whose source of truth is the backend.

Examples:

```text
GET /me
GET /orders/:id
GET /partner/profile
GET /admin/orders
```

When Socket.IO says:

```text
ORDER_UPDATED
```

the client can update/invalidate the relevant query and, when needed, refetch authoritative state.

## Learn

- query keys,
- `useQuery`,
- `useMutation`,
- invalidation,
- stale time,
- retry behavior,
- optimistic updates.

For critical RouteBite state transitions, avoid risky optimistic updates. Wait for backend confirmation.

---

# 10. Zustand — Small Client-Only State

Zustand is a small state-management library.

Use it only for state that is genuinely local to the browser, for example:

```text
temporary order-draft UI state
map panel visibility
local filter settings
short-lived wizard progress
```

Do **not** store authoritative order/payment/partner state only in Zustand.

If data comes from the backend, prefer TanStack Query.

If Zustand is not needed during the first implementation, do not add it merely because it is listed here.

---

# 11. React Hook Form — Forms

RouteBite contains many forms:

```text
registration
partner application
create food request
scheduled trip
actual bill entry
price approval
admin actions
```

React Hook Form manages form values and errors efficiently without excessive re-rendering.

It integrates well with Zod.

Example conceptual flow:

```text
User inputs form
      ↓
React Hook Form holds field state
      ↓
Zod validates shape/rules
      ↓
valid request sent to backend
      ↓
backend validates again
```

The backend validation is mandatory even if frontend validation succeeds.

---

# 12. Zod — Validation and Shared API Contracts

## What Zod Is

Zod validates data at runtime and can infer TypeScript types from the validation schema.

Example:

```ts
const CreateOrderSchema = z.object({
  vendorDisplayName: z.string().min(1),
  estimatedFoodCostPaise: z.number().int().nonnegative(),
  pickupLatitude: z.number(),
  pickupLongitude: z.number(),
});
```

An attacker sending malformed JSON cannot bypass this merely because TypeScript compiled successfully.

## Why Shared Contracts Matter

Without shared contracts:

```text
Frontend thinks field is: deliveryTime
Backend expects: requestedDeliveryAt
```

This creates runtime bugs.

Put API request/response schemas in:

```text
packages/contracts
```

Both web and server import those contracts.

## What NOT to Share

Do not expose Prisma/database models directly to the frontend.

Database schemas contain internal fields that should not become public API contracts.

Use explicit API schemas.

## Learn

- object schemas,
- unions,
- discriminated unions,
- transforms,
- refinements,
- optional/nullable values,
- schema parsing,
- inferred TypeScript types.

---

# 13. Tailwind CSS — Styling

Tailwind CSS provides utility classes for building the UI quickly and consistently.

Example concept:

```text
spacing
layout
responsive design
typography
borders
states
```

The prototype should favor simple, understandable screens over highly customized animation/design systems.

The goal is to demonstrate the marketplace workflow, not build a design framework.

---

# 14. shadcn/ui-Style Components

The project may use shadcn/ui-style components for common controls such as:

```text
button
dialog
form control
card
tabs
table
dropdown
toast
```

The useful property is that the component source lives in our codebase rather than hiding behavior inside a large opaque UI package.

Use accessible primitives and keep customization modest.

Do not add several overlapping UI frameworks such as Material UI + Ant Design + shadcn simultaneously.

---

# 15. NestJS — Backend Framework

## What NestJS Is

NestJS is a structured Node.js backend framework.

It provides conventions for:

```text
modules
controllers
services
dependency injection
guards
interceptors
WebSocket gateways
configuration
testing
```

## Why NestJS Instead of a Bare Express App

A tiny Express app is easy to start but can become unstructured quickly:

```text
routes calling database directly
business logic duplicated across handlers
authorization checks forgotten
status transitions spread across files
```

RouteBite has enough domain complexity that structure is valuable.

NestJS lets us create modules such as:

```text
AuthModule
UsersModule
PartnersModule
OrdersModule
TripsModule
MatchingModule
OffersModule
PaymentsModule
TrackingModule
NotificationsModule
AdminModule
FilesModule
MapsModule
```

This is still **one modular monolith**, not microservices.

## Recommended Internal Layering

Inside a module, prefer:

```text
Controller / Gateway
      ↓
Application Service
      ↓
Domain rules / state machine
      ↓
Repository / Prisma
      ↓
PostgreSQL
```

Controllers should remain thin.

Example:

```text
BAD:
OrderController contains 200 lines of payment + matching logic.

GOOD:
OrderController validates request and calls OrderService.
OrderService coordinates domain operations.
```

## Learn

- modules,
- controllers,
- providers/services,
- dependency injection,
- guards,
- interceptors,
- exception filters,
- pipes,
- lifecycle hooks,
- WebSocket gateways,
- testing modules.

---

# 16. REST API — Authoritative Commands and Reads

RouteBite uses REST/JSON for business operations such as:

```text
POST /orders
POST /orders/:id/payments
POST /offers/:id/accept
POST /orders/:id/pickup
POST /orders/:id/verify-delivery
POST /partner/trips
GET  /orders/:id
GET  /partner/offers
```

REST is used because commands need explicit authentication, validation, predictable responses, idempotency behavior, and error handling.

## Important Rule

Critical state changes happen through backend commands, not WebSocket messages from the UI.

Socket.IO is used to **notify**, not to become the only path for durable business mutations.

---

# 17. Socket.IO — Realtime User Experience

## Why Realtime Is Needed

RouteBite needs near-real-time UI updates for:

```text
new partner offer
partner accepted
price approval request
order status change
partner location update
matching failure
```

Socket.IO provides persistent realtime communication over WebSocket with fallback/reconnection behavior.

NestJS has first-class Socket.IO gateway support.

## Suggested Rooms

```text
user:{userId}
order:{orderId}
partner:{partnerId}
admin
```

## Critical Reliability Rule

> **Socket events are hints, not the database.**

Correct pattern:

```text
backend transaction commits
        ↓
backend emits socket event
        ↓
client updates/refetches UI
```

Incorrect pattern:

```text
socket event emitted
        ↓
UI assumes success
        ↓
database write fails
```

After reconnect, clients must be able to refetch current state over REST.

## Learn

- connection lifecycle,
- rooms,
- authentication during connection,
- reconnects,
- acknowledgements,
- stale connections,
- ordering limitations,
- why WebSockets should not be the sole source of truth.

---

# 18. PostgreSQL — Authoritative Database

## What PostgreSQL Is

PostgreSQL is a relational database with strong transaction support, constraints, indexes, and mature operational tooling.

It stores durable RouteBite truth:

```text
users
partner profiles
orders
trips
offers
assignments
payments
ledger records
ratings
admin actions
state-change timestamps
```

## Why Relational Data Fits RouteBite

RouteBite contains strong relationships:

```text
Order belongs to Customer
Order may have one assigned Partner
Offer belongs to Order + Partner
Trip belongs to Partner
Payment belongs to Order
Ledger entry belongs to Order
```

It also has consistency rules where transactions matter.

Example:

Two partners click `Accept` simultaneously.

The database must ensure exactly one assignment wins.

PostgreSQL transactions/constraints are a natural solution.

## Why MongoDB Is Not the Default Here

MongoDB is a good database for many products, but RouteBite's hardest problems are transactional relationships and concurrency, not flexible document shape.

Using PostgreSQL reduces the number of business consistency rules we would otherwise have to enforce manually.

## Money Rule

Store INR money as integer **paise**, never JavaScript floating point.

Example:

```text
₹250.00 = 25000 paise
```

Avoid:

```js
0.1 + 0.2
```

style floating-point accounting errors.

## Time Rule

Store backend timestamps in UTC.

Convert to the user's timezone only for display.

## Learn

- tables,
- primary keys,
- foreign keys,
- unique constraints,
- indexes,
- transactions,
- isolation/concurrency basics,
- `SELECT ... FOR UPDATE`,
- conditional updates,
- timestamps,
- query plans,
- migrations.

---

# 19. Geospatial Strategy — Keep V1 Simple

We are **not requiring PostGIS for the first campus prototype**.

Store coordinates explicitly:

```text
latitude
longitude
```

Candidate discovery can use:

1. simple coarse bounding/radius filtering,
2. a Haversine-distance helper where needed,
3. Google Routes/Route Matrix for the small shortlist.

This avoids introducing advanced geospatial SQL before the prototype needs it.

If real usage later requires efficient city-scale spatial queries, we can introduce **PostGIS** deliberately.

This is an example of postponing complexity without blocking future architecture.

---

# 20. Prisma — ORM and Migrations

## What an ORM Does

An ORM maps application code to relational database operations.

Instead of manually writing SQL for every common operation, Prisma provides a typed client.

Conceptually:

```ts
await prisma.order.findUnique({
  where: { id: orderId }
});
```

## Why Prisma

For the prototype it gives us:

- generated TypeScript types,
- readable data access,
- migrations,
- relational modeling,
- transaction API,
- strong developer tooling.

## Important Rule

Prisma does not eliminate SQL knowledge.

For concurrency-sensitive operations, indexes, performance, or special database features, raw SQL may still be appropriate.

Example cases where we must think carefully:

```text
atomic partner assignment
conditional state transition
unique ledger entry
job locking
```

Never assume that an ORM automatically prevents races.

## Learn

- Prisma schema,
- models,
- relations,
- migrations,
- generated client,
- transactions,
- unique constraints,
- raw queries,
- connection management.

---

# 21. Supabase — Managed Platform Boundary

For the prototype, Supabase is used as a managed infrastructure provider for:

```text
PostgreSQL
Authentication
Private object storage
```

We are **not** moving core business logic into Supabase client-side functions.

The NestJS backend remains the business authority.

Conceptually:

```text
Browser
  ↓ auth/login
Supabase Auth

Browser
  ↓ authenticated business request
NestJS API
  ↓
PostgreSQL
```

## Why This Choice

It reduces the number of infrastructure systems we need to administer while keeping PostgreSQL as a standard portable database.

If RouteBite later moves to another Postgres or storage provider, the domain code should require limited change because provider-specific code is isolated behind adapters.

---

# 22. Authentication — Supabase Auth

## What Authentication Means

Authentication answers:

> **Who is this user?**

Authorization answers:

> **What is this authenticated user allowed to do?**

These are different problems.

Supabase Auth handles account identity/session mechanics.

NestJS handles RouteBite authorization rules.

Example:

```text
Supabase token proves user identity
        ↓
NestJS maps auth identity → RouteBite user
        ↓
NestJS verifies partner/admin permissions
```

## Phone Verification

The product flow is phone-verification based.

For environments where a real SMS provider is not configured, development/testing may use a **clearly labelled non-production OTP path**. That path must be impossible to enable accidentally in production.

Do not hardcode a universal OTP such as `123456` in production code paths.

## Authorization Must Be Backend-Enforced

Examples:

```text
approved partner → may set AVAILABLE_NOW
pending partner  → forbidden

admin → may approve partner
normal user → forbidden

assigned partner → may update that order pickup state
another partner  → forbidden
```

## Learn

- JWT/session concept,
- token verification,
- authentication vs authorization,
- role/capability checks,
- token expiry,
- refresh sessions,
- secure browser storage/session handling.

---

# 23. Supabase Storage — Private File Storage

RouteBite needs files for:

```text
profile images
college ID / verification documents
purchase receipts
```

These should **not** be stored as binary blobs directly inside the main PostgreSQL tables.

Store only file metadata/reference in the database.

Use private buckets for sensitive files.

Access should use short-lived signed URLs or backend-mediated access.

Example:

```text
Database:
receiptObjectKey = receipts/order-123/receipt.jpg

Storage:
actual image bytes
```

## Security Rules

- verification documents are admin-only,
- receipt access is restricted to relevant user/partner/admin flows,
- validate MIME type,
- validate file size,
- generate server-side object keys,
- never trust the browser-supplied filename as a storage path,
- do not expose a public bucket for identity documents.

---

# 24. pg-boss — Durable Background Jobs

## Why We Need a Worker

Some RouteBite operations happen later:

```text
offer expires after ~20 seconds
price approval expires after ~3 minutes
scheduled matching work may become due
stale matching attempts need recovery
```

Using JavaScript `setTimeout()` for these business-critical operations is unsafe.

If the server restarts:

```text
memory timer disappears
```

The order could become stuck forever.

## Why pg-boss

`pg-boss` stores background jobs in PostgreSQL.

That gives us durable work **without introducing Redis or RabbitMQ**.

Conceptual flow:

```text
API transaction creates offer
        ↓
a durable expiry job is scheduled
        ↓
API process can restart
        ↓
job still exists in PostgreSQL
        ↓
worker processes expiry safely
```

## Worker Rule

Every job handler must be **idempotent**.

An offer-expiry job should check current database state before changing anything.

Example:

```text
if offer already ACCEPTED → do nothing
if offer already EXPIRED  → do nothing
if order already ASSIGNED → do nothing
otherwise expire safely
```

The database remains authoritative; the job queue does not replace order state.

## Learn

- background jobs,
- durable queues,
- retries,
- idempotency,
- delayed jobs,
- worker concurrency,
- dead-letter/failure concepts.

---

# 25. Google Maps Platform

RouteBite depends on maps for more than displaying a map.

Required capabilities include:

```text
place/vendor search
manual pickup/drop pin
coordinates
route calculation
distance
ETA
route matrix
route polyline / geometry
```

## Frontend Responsibilities

The React app uses the Maps JavaScript API for:

```text
interactive map
place search UI
manual pin selection
route visualization
partner location display
```

Keep Google Maps code behind internal components/services rather than scattering API calls through pages.

Example internal boundary:

```text
<MapPicker />
<OrderTrackingMap />
```

## Backend Responsibilities

The NestJS `MapsModule` owns server-side route/distance/ETA calls needed for matching.

Never rely on a customer browser to provide a trusted travel-time calculation for backend matching.

## Cost-Safety Rule

Do not call Routes/Matrix every time GPS coordinates change.

Use:

```text
cheap coarse filter
      ↓
small candidate shortlist
      ↓
Google route calculations
```

Restrict API keys by environment/application/API and configure quotas/billing alerts in Google Cloud.

## Learn

- latitude/longitude,
- geocoding,
- Places,
- routes,
- distance matrix concepts,
- polylines,
- browser vs server API keys,
- quotas and billing.

---

# 26. Razorpay Test Mode

Razorpay is used to demonstrate the checkout flow.

The prototype uses **Test Mode only**.

Flow:

```text
NestJS creates payment/order intent
        ↓
React opens Razorpay test checkout
        ↓
provider returns test result
        ↓
backend verifies authoritative result/callback
        ↓
backend marks payment confirmed
        ↓
matching begins
```

## Critical Payment Rule

Never trust only this:

```text
frontend says "payment successful"
```

The backend must verify provider information/signature/callback according to the integration design.

Provider callbacks may be duplicated.

Therefore payment processing must be **idempotent**.

## Learn

- payment order/intents,
- checkout,
- signatures,
- webhooks,
- idempotency,
- test vs live mode,
- why client confirmation is not sufficient.

---

# 27. Pino — Structured Logging

`console.log()` is not enough once several users/orders exist simultaneously.

Pino writes structured logs such as:

```json
{
  "level": "info",
  "event": "order.assigned",
  "orderId": "ord_123",
  "partnerId": "par_456",
  "requestId": "req_789"
}
```

Useful correlation fields include:

```text
requestId
userId
orderId
partnerId
tripId
paymentId
jobId
```

## Never Log

- OTP values,
- auth tokens,
- payment secrets,
- full identity documents,
- sensitive file URLs,
- passwords.

Structured logs make demo failures far easier to investigate.

---

# 28. OpenAPI / Swagger

The backend should expose/generate API documentation for development.

This provides:

```text
endpoint list
request shapes
response shapes
status codes
authentication requirements
```

It is particularly useful before the frontend is complete because APIs can be tested independently.

Swagger is development/documentation tooling, not an authorization layer.

Do not publicly expose sensitive development documentation in a production deployment without access controls.

---

# 29. Testing Stack — Why Several Test Types Exist

No single testing tool catches every class of bug.

RouteBite's highest-risk bugs are state and concurrency bugs, so tests matter more than visual polish.

## 29.1 Backend Unit Tests — Jest

Test isolated domain behavior such as:

```text
valid/invalid order transitions
price adjustment rules
matching eligibility helpers
OTP attempt rules
partner capability rules
```

Unit tests should be fast and deterministic.

## 29.2 API Integration Tests — Jest + Supertest

Supertest calls the NestJS HTTP application like a client.

Use it to test:

```text
unauthorized user cannot approve partner
payment must precede matching
only assigned partner may mark pickup
invalid transition returns 409/appropriate error
```

Where practical, integration tests should run against a real test PostgreSQL database rather than mocking every database behavior.

## 29.3 Frontend Tests — Vitest + React Testing Library

Test important UI behavior such as:

```text
matching screen displays correct state
price approval shows difference
admin buttons respect permissions in UI
invalid form input shows errors
```

Do not write tests that only check implementation details.

## 29.4 End-to-End — Playwright

Playwright drives a real browser.

The most important prototype test is the complete happy path:

```text
customer login
partner ready
customer creates order
test payment
matching
offer accept
pickup
price confirmation
delivery OTP
completion
```

Also automate at least a few high-risk failures:

```text
two accept attempts
wrong OTP
no partner found
price increase rejected
```

## Learn

- unit vs integration vs E2E,
- mocking,
- fixtures,
- deterministic test data,
- database cleanup,
- race-condition tests.

---

# 30. ESLint, Prettier, Strict TypeScript

These are not cosmetic extras.

## TypeScript Strict Mode

Enable strict compiler checks.

Do not silence errors by spreading `any` across the codebase.

## ESLint

Use rules that catch dangerous patterns such as:

```text
floating promises
unused values
unsafe any usage
incorrect async handling
```

## Prettier

Prettier standardizes formatting so developers do not waste time arguing over indentation and line wrapping.

CI should fail when required static checks fail.

---

# 31. Environment Configuration

Never commit secrets.

Use environment variables for values such as:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE keys
GOOGLE_MAPS keys
RAZORPAY keys
AUTH configuration
storage configuration
```

Commit only:

```text
.env.example
```

with placeholder values.

## Validate Environment at Startup

Use Zod to validate required backend configuration.

If `DATABASE_URL` or another mandatory variable is missing, the server should fail immediately with a clear startup error instead of crashing later during an order.

---

# 32. GitHub Actions — Continuous Integration

Every pull request / important push should run automated checks such as:

```text
install dependencies
lint
typecheck
unit tests
integration tests where configured
frontend build
backend build
Prisma schema validation
```

The goal is simple:

> Broken code should be discovered before it reaches the demo deployment.

Do not automatically deploy a branch when its build/tests fail.

---

# 33. Docker — Reproducible Backend Runtime

Docker packages the backend with its runtime dependencies.

The same image can be started as:

```text
API process
```

or:

```text
Worker process
```

using different commands.

Example conceptual deployment:

```text
same source + same image

API:
node dist/main.js

Worker:
node dist/worker.js
```

This prevents API and worker from accidentally running different domain code versions.

Local development does not have to run the React dev server inside Docker unless that improves the workflow.

---

# 34. Deployment Choice

## Frontend — Vercel

Use Vercel for the React/Vite frontend because deployment of static/browser applications is straightforward.

Frontend environment configuration contains only values safe for browser exposure.

**Never put server secrets into `VITE_*` variables**, because Vite browser environment variables are bundled into client code.

## API + Worker — Railway

Use Railway for long-running Node processes.

Deploy two processes from the same backend source/image:

```text
routebite-api
routebite-worker
```

This supports our architecture better than trying to place critical WebSocket/background-worker behavior into short-lived serverless functions.

## Database/Auth/Files — Supabase

Supabase hosts:

```text
PostgreSQL
Auth
Storage
```

## Portability Rule

Provider-specific behavior must stay behind adapters/configuration.

The product should still conceptually be:

```text
React app
NestJS API/worker
PostgreSQL
object storage
external maps/payment/auth adapters
```

not "a Vercel/Railway/Supabase application".

---

# 35. Suggested NestJS Modules

Keep module boundaries aligned to business responsibilities.

```text
AppModule
│
├── AuthModule
├── UsersModule
├── PartnersModule
├── AdminModule
│
├── OrdersModule
├── TripsModule
├── MatchingModule
├── OffersModule
├── TrackingModule
│
├── PaymentsModule
├── LedgerModule
│
├── MapsModule
├── FilesModule
├── NotificationsModule
│
├── JobsModule
└── ObservabilityModule
```

## Dependency Direction Rule

Avoid circular domain dependencies.

For example, `MatchingModule` may ask `PartnersModule` for eligible supply, but partner code should not directly know all internals of matching.

Where several modules need to coordinate, use an application/orchestration service rather than letting modules call each other randomly.

---

# 36. Suggested Frontend Organization

```text
apps/web/src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layout/
│
├── features/
│   ├── auth/
│   ├── orders/
│   ├── partner/
│   ├── trips/
│   ├── matching/
│   ├── tracking/
│   ├── payments/
│   └── admin/
│
├── components/
│   ├── ui/
│   └── maps/
│
├── lib/
│   ├── api/
│   ├── auth/
│   └── realtime/
│
└── main.tsx
```

Organize by product feature rather than creating giant global folders such as:

```text
all-components/
all-hooks/
all-services/
```

that eventually contain unrelated code.

---

# 37. State Ownership — Critical Bug-Prevention Rule

Every important state should have one obvious owner.

| State | Owner |
|---|---|
| Order status | PostgreSQL/backend |
| Payment status | PostgreSQL/backend |
| Partner verification | PostgreSQL/backend |
| Trip status | PostgreSQL/backend |
| Offer status | PostgreSQL/backend |
| Demo ledger | PostgreSQL/backend |
| Live current GPS sample | Partner client → backend operational state |
| Cached API response | TanStack Query |
| Temporary open/closed UI panel | React/Zustand |

If two systems both believe they are authoritative, bugs are likely.

---

# 38. State Machines — Backend Only

Order transitions must be centralized.

Do not write scattered code like:

```ts
order.status = "PICKED_UP";
```

from random controllers.

Instead use commands/services such as:

```text
assignPartner()
confirmPrice()
markPickedUp()
startDelivery()
verifyDeliveryOtp()
cancelBeforePurchase()
```

Each operation validates:

```text
current state
actor permission
required dependent state
time constraints
idempotency
```

The same principle applies to:

```text
payment state
trip state
offer state
partner verification state
```

This is one of the most important low-bug design choices in the project.

---

# 39. Concurrency Rules

The following operations must not depend on frontend timing.

## Partner Acceptance

Two partners can click Accept at nearly the same time.

The backend/database must atomically choose one.

## Payment Callback

The provider may send the same callback more than once.

Processing must be idempotent.

## Job Retry

A worker job may retry after partial failure.

The handler must check durable state before applying an operation again.

## Demo Ledger

A completed order must not create partner earning twice.

Use unique/idempotency constraints.

## Cancellation vs Acceptance

Customer cancellation and partner acceptance may race.

The database transaction decides which valid state transition wins.

These rules will be made concrete in `DATABASE_DESIGN.md` and `API_DESIGN.md`.

---

# 40. Error Handling Standard

Backend errors should have a consistent machine-readable shape.

Conceptually:

```json
{
  "error": {
    "code": "ORDER_ALREADY_ASSIGNED",
    "message": "This order has already been assigned.",
    "requestId": "req_123"
  }
}
```

Use explicit domain error codes rather than forcing the frontend to parse human-readable text.

Examples:

```text
ORDER_INVALID_STATE
ORDER_ALREADY_ASSIGNED
PARTNER_NOT_APPROVED
OFFER_EXPIRED
LOCATION_STALE
PAYMENT_NOT_CONFIRMED
PRICE_APPROVAL_REQUIRED
OTP_INVALID
OTP_EXPIRED
FORBIDDEN
```

---

# 41. What We Are Explicitly NOT Adding Yet

Do not add the following during initial prototype implementation unless a demonstrated requirement changes the decision:

```text
Spring Boot second backend
Python second backend
microservices
Kafka
RabbitMQ
Redis as correctness dependency
Kubernetes
GraphQL
Next.js backend/server actions
MongoDB
PostGIS
Elasticsearch
Firebase database
multiple ORMs
multiple UI frameworks
ML ranking
native mobile apps
```

This is not because those technologies are bad.

They solve problems RouteBite does not currently have.

Every additional runtime/system increases:

```text
configuration
failure modes
local setup
CI complexity
deployment complexity
knowledge required to debug the prototype
```

---

# 42. Why Not Java/Spring Boot for This Prototype

Spring Boot is an excellent backend stack and would be a reasonable production choice.

For this prototype, NestJS/TypeScript is preferred because:

- frontend and backend use one language,
- API contracts can be shared directly,
- Socket.IO integration is straightforward,
- iteration is faster for a small web prototype,
- the architecture does not require JVM-specific capabilities.

This is a **project-stage decision**, not a claim that Node.js is more powerful or reliable than Java.

If RouteBite later develops a backend team centered on Java, the modular domain boundaries documented here would make a gradual service rewrite possible without changing the product model.

Do not build two backends now just to demonstrate multiple languages.

---

# 43. Learning Order for a Developer New to This Stack

Do not attempt to master every technology before starting.

Learn in this order:

## Phase 1 — Language and Web Fundamentals

```text
TypeScript
async/await
HTTP + REST
JSON
basic SQL
Git
```

## Phase 2 — Frontend

```text
React
Vite
React Router
React Hook Form
Zod
TanStack Query
Tailwind
```

## Phase 3 — Backend

```text
Node.js
NestJS modules/controllers/services/guards
Zod boundary validation
REST error handling
```

## Phase 4 — Database

```text
PostgreSQL
transactions
indexes
constraints
Prisma
migrations
```

Do not skip transaction/constraint fundamentals. They are central to RouteBite correctness.

## Phase 5 — Integrations

```text
Google Maps
Supabase Auth/Storage
Razorpay Test Mode
Socket.IO
```

## Phase 6 — Reliability

```text
idempotency
background jobs with pg-boss
concurrency/race conditions
structured logging
testing
```

## Phase 7 — Deployment

```text
Docker
GitHub Actions
Vercel
Railway
Supabase production configuration
```

---

# 44. Minimum Topics to Read Before Implementing Each Area

## Before Authentication

Read about:

```text
authentication vs authorization
JWT/session lifecycle
backend route guards
OTP expiry/rate limiting
```

## Before Orders

Read about:

```text
REST API design
Zod validation
state machines
PostgreSQL transactions
```

## Before Matching

Read:

```text
latitude/longitude
Haversine distance
route ETA
Google Routes / Route Matrix
transaction-safe assignment
```

## Before Realtime

Read:

```text
WebSocket vs HTTP
Socket.IO rooms
reconnection
server truth vs UI notifications
```

## Before Payments

Read:

```text
webhooks
signature verification
idempotency
integer money representation
payment vs order state
```

## Before Worker Jobs

Read:

```text
durable jobs
retries
idempotent handlers
why setTimeout is not durable
```

---

# 45. Prototype Development Rules

To keep the bug rate low:

1. **P0 before P1/P2.** Finish the complete core flow before polish.
2. **One source of truth.** Business state lives in PostgreSQL.
3. **Validate twice.** Friendly validation in frontend; authoritative validation in backend.
4. **No magic status changes.** All state changes go through domain/application commands.
5. **No floating money.** Use integer paise.
6. **No local-time database logic.** Store UTC timestamps.
7. **No critical in-memory timers.** Use durable jobs.
8. **No client-trusted payments.** Backend verifies payment state.
9. **No client-trusted authorization.** Backend enforces permissions.
10. **No socket-only truth.** Realtime events follow database commits.
11. **No duplicate business effects.** Critical handlers are idempotent.
12. **No secrets in Git/browser bundles.** Validate environment configuration.
13. **No schema edits without migrations.** Database changes are versioned.
14. **No major dependency upgrades immediately before the demo.** Stabilize the stack.
15. **Test race conditions and failure paths, not only the happy path.**

---

# 46. Final Runtime Picture

```text
                    ┌─────────────────────┐
                    │      Browser        │
                    │ React + TypeScript  │
                    │ Vite                │
                    │ TanStack Query      │
                    │ Socket.IO Client    │
                    └─────────┬───────────┘
                              │
                   REST + authenticated
                       Socket.IO events
                              │
                              ▼
                    ┌─────────────────────┐
                    │    NestJS API       │
                    │                     │
                    │ Auth / Orders       │
                    │ Partners / Trips    │
                    │ Matching / Offers   │
                    │ Payments / Tracking │
                    │ Admin               │
                    └──────┬─────┬────────┘
                           │     │
              transactions │     │ provider adapters
                           │     │
                           ▼     ├────────► Google Maps
                 ┌──────────────┐├────────► Razorpay Test
                 │ PostgreSQL   │└────────► Supabase Auth/Storage
                 │  Supabase    │
                 └──────┬───────┘
                        │
                        │ durable jobs
                        ▼
                 ┌──────────────┐
                 │ Nest Worker  │
                 │  + pg-boss   │
                 └──────────────┘
```

Runtime deployment:

```text
Frontend → Vercel
API      → Railway
Worker   → Railway
DB/Auth/Storage → Supabase
Maps     → Google Maps Platform
Payment  → Razorpay Test Mode
CI       → GitHub Actions
```

---

# 47. Technology Change Rule

A technology should not be replaced merely because another tool is newer or more fashionable.

Before changing a core technology, document:

1. what concrete problem exists,
2. why the current tool cannot reasonably solve it,
3. what new complexity the replacement introduces,
4. migration cost,
5. effect on testing/deployment,
6. whether `ARCHITECTURE.md` or `DECISIONS.md` must change.

Examples:

```text
Add Redis because "delivery apps use Redis"     → not sufficient.

Add Redis because measured candidate/location workload
cannot meet latency targets using PostgreSQL alone → valid reason to evaluate.
```

Likewise:

```text
Add PostGIS because it sounds advanced → not sufficient.

Add PostGIS because city-scale spatial candidate discovery
is measurably slow/complex without spatial indexes → valid reason.
```

---

# 48. Next Documents After This Stack

Now that architecture and technology choices are fixed, the next design documents should be written in this order:

```text
1. DATABASE_DESIGN.md
   ↓
2. API_DESIGN.md
   ↓
3. project scaffold
   ↓
4. first P0 implementation vertical slice
```

`DATABASE_DESIGN.md` should make the concurrency/state rules concrete using tables, constraints, indexes, and transactions.

`API_DESIGN.md` should then define commands/responses against that data model.

Only after those documents are aligned should we generate the main project skeleton.