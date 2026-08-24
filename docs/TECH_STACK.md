# RouteBite — Technology Stack

> **Status:** CONFIRMED FOR PROTOTYPE
>
> RouteBite will use a deliberately small **MERN+** stack for the first working prototype. The goal is to keep most of the system inside technologies already familiar to a MERN developer and add external technologies only where the product genuinely needs capabilities that MERN does not provide.
>
> This document explains what each technology does, why RouteBite needs it, and what should be learned before changing it.

---

# 1. Technology Principle

RouteBite is a prototype marketplace with non-trivial product logic, but it does not need a large enterprise technology stack.

The engineering rule is:

> **Prefer familiar, mature MERN technology and add a new tool only when it solves a concrete problem that MERN cannot solve cleanly.**

The prototype optimizes for:

1. developer understanding,
2. low bug surface,
3. fast debugging,
4. fast iteration,
5. one coherent codebase,
6. correct state transitions and concurrency,
7. easy local setup,
8. easy deployment.

The project must not add infrastructure merely because it is fashionable.

---

# 2. Final Prototype Stack

| Layer | Technology | Why |
|---|---|---|
| Language | **JavaScript (modern ES modules)** | Keeps the project close to standard MERN and minimizes learning overhead |
| Frontend | **React + Vite** | Familiar component-based web UI and fast development |
| Frontend routing | **React Router** | Customer, partner, admin and order pages |
| API calls | **Axios** | Simple REST requests and interceptors |
| Frontend shared state | **React Context API + local component state** | Avoids adding Redux/Zustand unless a real need appears |
| Backend runtime | **Node.js LTS** | Runs JavaScript outside the browser |
| Backend framework | **Express.js** | Simple REST API, middleware and routing |
| Database | **MongoDB Atlas** | Managed MongoDB database and geospatial support |
| ODM | **Mongoose** | Schemas, validation, indexes, queries and transactions |
| Authentication | **JWT in HttpOnly cookies + bcrypt** | Familiar MERN authentication without exposing tokens to browser JavaScript |
| Request validation | **express-validator** | Reject malformed/untrusted API input before business logic |
| Realtime | **Socket.IO** | Delivery offers, order updates and live location |
| Maps/routing | **Google Maps Platform** | Places, maps, routes, ETA, distance and route matrix |
| Payments | **Razorpay Test Mode** | Realistic prototype checkout without real marketplace settlement |
| Image/document storage | **Cloudinary private/authenticated assets** | Profile photos, college ID proof and receipts without storing binary files in MongoDB |
| Upload middleware | **Multer** | Receives multipart uploads before sending them to Cloudinary |
| Backend testing | **Jest + Supertest** | Tests services and HTTP endpoints |
| Code quality | **ESLint + Prettier** | Catches common mistakes and keeps style consistent |
| Deployment | **One Node/Express deployment + MongoDB Atlas** | Minimizes deployment/network/cookie/socket complexity |
| Source control / CI | **GitHub + lightweight GitHub Actions** | Run tests/lint before merge when useful |

Optional tools are not part of the initial dependency set unless implementation proves they are needed.

---

# 3. System Mental Model

```text
                        Browser

                  React + Vite
                       │
             REST      │      Socket.IO
                       │
                       ▼
              Node.js + Express.js
                       │
            ┌──────────┼───────────┐
            │          │           │
            ▼          ▼           ▼
        Mongoose   Socket.IO   Background scans
            │                      │
            └──────────┬───────────┘
                       ▼
                  MongoDB Atlas

External providers:

Google Maps Platform
Razorpay Test Mode
Cloudinary
Optional SMS/OTP provider later
```

MongoDB is the durable source of truth.

Socket.IO is only a fast notification channel. If a socket event is lost, the client must be able to reload the correct order state from REST/MongoDB.

---

# 4. JavaScript

## What it is

JavaScript is the language used by both the browser and Node.js.

Using JavaScript across the prototype means the developer does not need to switch languages between frontend and backend.

## Why RouteBite uses it

The developer already understands MERN, so using JavaScript reduces learning time and allows more attention to be spent on RouteBite's difficult parts:

- matching,
- order states,
- race conditions,
- maps,
- payment callbacks,
- live tracking.

## Bug-reduction rules

Because JavaScript is dynamically typed, the project must compensate with discipline:

- validate every API request,
- define state constants centrally,
- never compare arbitrary status strings scattered throughout code,
- use Mongoose schema validation,
- avoid `any`-style unstructured objects,
- write tests for critical transitions,
- use ESLint,
- document important object shapes with JSDoc where useful.

TypeScript remains a possible future migration, but it is not required to prove the prototype.

---

# 5. React

React is the frontend library.

RouteBite will use **one role-aware React application** rather than separate customer and partner applications.

The same account may:

```text
Order food
      │
      └── Apply to become a partner
                │
                └── Use partner features after approval
```

Possible areas:

```text
Home / Create Order
My Orders
Partner Dashboard
Scheduled Trips
Active Delivery
Profile
Admin
```

## Important frontend rule

React never owns authoritative business state.

For example, this is unsafe:

```text
Partner clicks Accept
Frontend immediately assumes order is assigned
```

Correct flow:

```text
Partner clicks Accept
        ↓
Express API validates
        ↓
MongoDB atomic/transactional update succeeds
        ↓
API returns assigned order
        ↓
Socket.IO informs customer/other partner clients
```

The database response wins over local React state.

## Learn/review

- components,
- props,
- state,
- hooks,
- `useEffect`,
- Context API,
- forms,
- conditional rendering,
- cleanup functions,
- avoiding stale closures,
- route-based rendering.

---

# 6. Vite

Vite runs the React development environment and creates the production frontend build.

During local development:

```text
React/Vite: http://localhost:5173
Express:    http://localhost:5000
```

Vite should proxy `/api` and `/socket.io` to Express where practical so local development behaves similarly to production.

For production, the simplest deployment is:

```text
npm run build
      ↓
React static files created
      ↓
Express serves those files
```

This gives RouteBite one application origin in production and reduces:

- CORS bugs,
- cookie bugs,
- Socket.IO cross-origin bugs,
- deployment coordination.

---

# 7. React Router

React Router provides pages such as:

```text
/login
/order/new
/orders/:orderId
/partner
/partner/trips
/partner/deliveries/:orderId
/admin
/admin/orders/:orderId
```

Frontend route protection is for user experience only.

Security must be enforced again in Express middleware.

---

# 8. Axios

Axios sends HTTP requests from React to Express.

Examples:

```text
POST /api/orders
POST /api/orders/:id/payment
POST /api/offers/:id/accept
GET  /api/orders/:id
```

Use one shared Axios instance.

It should configure:

- base URL,
- `withCredentials: true` when using HttpOnly auth cookies,
- standard error handling,
- request IDs if later useful.

Do not create different Axios configuration in every component.

---

# 9. React Context API

The prototype does not require Redux or Zustand initially.

Context can hold small global UI information such as:

```text
current logged-in user
authentication loading state
current partner capability
```

Do not put the complete database copy into Context.

Order pages should fetch authoritative order state from the backend.

If frontend state becomes genuinely difficult later, a dedicated state library can be introduced with evidence that it solves a real problem.

---

# 10. Node.js

Node.js runs the Express backend.

Most RouteBite backend work is I/O-heavy:

- MongoDB queries,
- Google Maps requests,
- Razorpay callbacks,
- Cloudinary uploads,
- Socket.IO connections.

That is a good fit for Node.js.

Use an LTS Node release and pin the major version in the repository.

Important topics:

- event loop,
- promises,
- async/await,
- error propagation,
- environment variables,
- graceful process shutdown,
- why blocking synchronous work should be avoided.

---

# 11. Express.js

Express is the backend HTTP framework.

It provides:

```text
routes
middleware
request/response objects
error middleware
HTTP server integration
```

## Required project structure

RouteBite must not become a large file of routes directly calling MongoDB.

Use this structure:

```text
server/
└── src/
    ├── config/
    ├── constants/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── services/
    ├── sockets/
    ├── jobs/
    ├── utils/
    └── app.js
```

Responsibility:

```text
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Mongoose Model / Transaction
  ↓
MongoDB
```

### Route

Defines HTTP method/path.

### Controller

Reads validated HTTP input and sends HTTP response.

Controllers should remain thin.

### Service

Contains business rules.

Examples:

```text
assignPartner()
approvePriceChange()
markPickedUp()
verifyDeliveryOtp()
cancelOrder()
```

### Model

Defines persistent document structure, indexes and database validation.

This structure gives a raw Express project much of the discipline we wanted from a heavier framework without making the developer learn NestJS.

---

# 12. MongoDB Atlas

MongoDB is the primary database.

MongoDB Atlas is the managed cloud version used for the prototype.

## Why MongoDB is acceptable for RouteBite

RouteBite needs:

- user/order documents,
- partner operational state,
- scheduled trips,
- geospatial nearby-partner queries,
- atomic updates,
- multi-document transactions for critical workflows.

MongoDB supports all of these.

## Source-of-truth rule

If losing information after a Node process restart would make the order incorrect, persist it in MongoDB.

Examples:

```text
order status
assigned partner
payment status
offer expiry timestamp
price approval deadline
delivery OTP hash
partner active order
```

Do not rely only on JavaScript memory for these values.

---

# 13. Mongoose

Mongoose maps JavaScript objects to MongoDB documents.

It provides:

- schemas,
- validation,
- indexes,
- timestamps,
- query helpers,
- transactions/sessions,
- middleware where appropriate.

Example conceptual schema:

```js
const orderSchema = new mongoose.Schema({
  customerId: { type: ObjectId, required: true },
  status: { type: String, enum: ORDER_STATUSES, required: true },
  assignedPartnerId: { type: ObjectId, default: null },
  estimatedFoodCostPaise: { type: Number, required: true, min: 0 },
});
```

## Critical rule

Mongoose validation alone does not prevent concurrency bugs.

Critical actions must use:

- conditional atomic updates,
- unique indexes,
- MongoDB transactions when multiple documents must change together.

---

# 14. MongoDB Geospatial Queries

For partner current location use GeoJSON:

```js
currentLocation: {
  type: "Point",
  coordinates: [longitude, latitude]
}
```

Create a `2dsphere` index.

MongoDB can then perform cheap coarse candidate discovery such as:

> Find `AVAILABLE_NOW` approved partners near the pickup.

This is **not** the final matching decision.

Pipeline:

```text
MongoDB geospatial shortlist
        ↓
Google Maps road ETA/routes
        ↓
RouteBite hard filters
        ↓
ranking
        ↓
offer dispatch
```

Straight-line geographic distance must never replace real route/ETA checks for final eligibility.

---

# 15. Authentication — JWT + HttpOnly Cookie

The prototype will use familiar MERN authentication.

Flow:

```text
User logs in
    ↓
Express validates credentials
    ↓
Server signs JWT
    ↓
JWT placed in HttpOnly cookie
    ↓
Browser automatically sends cookie to RouteBite
```

Why HttpOnly:

Browser JavaScript cannot directly read the token, reducing exposure to simple token-stealing XSS attacks.

Recommended cookie settings in production:

```text
httpOnly: true
secure: true
sameSite: "lax"  // when app is served from the same origin
```

The backend should serve the React build from the same production origin, which keeps this much simpler.

JWT payload should stay small, for example:

```text
userId
role/capability hints
tokenVersion
```

The backend must still load/check current authorization for sensitive actions.

---

# 16. bcrypt

Passwords must never be stored as plain text.

`bcrypt` hashes passwords before storage.

Flow:

```text
password
   ↓
bcrypt hash
   ↓
MongoDB stores only hash
```

Never log passwords or password hashes.

Phone OTP verification remains a separate concept from password authentication.

---

# 17. Phone OTP

The product flow requires phone verification.

For local/demo development, do not block the entire prototype on an SMS vendor.

Use an OTP abstraction:

```text
OtpService.send(phone, code)
```

Prototype implementations:

```text
DevelopmentOtpProvider
Later: MSG91 / Twilio / another provider
```

OTP rules:

- generate using cryptographically secure randomness,
- store only a hash,
- set expiry,
- limit attempts,
- invalidate after successful use,
- never expose a production OTP in logs.

Development mode may show/log the code explicitly and must be clearly labelled as development-only.

---

# 18. express-validator

Every incoming API payload is untrusted.

`express-validator` handles request validation such as:

```text
required fields
string length
number ranges
MongoDB IDs
coordinates
future timestamps
```

Example:

```text
Client validation → convenience
Express validation → security/business boundary
Mongoose validation → database safety
```

Use all relevant layers rather than trusting only the frontend.

---

# 19. Socket.IO

Socket.IO provides realtime communication between browser and Express.

RouteBite uses it for:

### Partner events

```text
NEW_DELIVERY_OFFER
OFFER_EXPIRED
ORDER_CANCELLED
PRICE_APPROVED
```

### Customer events

```text
PARTNER_ASSIGNED
ORDER_STATUS_UPDATED
PARTNER_LOCATION_UPDATED
PRICE_CONFIRMATION_REQUIRED
```

## Reliability rule

Socket.IO never becomes the source of truth.

Correct order:

```text
1. validate action
2. persist MongoDB change
3. commit transaction
4. emit Socket.IO event
```

If step 4 fails, REST still returns the correct persisted state when the client refetches.

---

# 20. Foreground Live Location

Browser geolocation provides partner coordinates during an active delivery.

The partner client may send approximately every 10–15 seconds.

Backend validates:

- authenticated partner,
- active assigned order,
- coordinate shape,
- reasonable update frequency.

The newest operational location can live on the partner/order document.

The prototype does not need to permanently save every GPS point.

---

# 21. Background Expiry Handling Without Redis/Queues

The prototype does not need Redis, BullMQ, RabbitMQ, Kafka or pg-boss.

Important deadlines are stored in MongoDB:

```text
offer.expiresAt
priceConfirmation.expiresAt
otp.expiresAt
```

A small periodic job inside the Node server can scan for expired records and move them forward.

Example:

```text
Every few seconds:
find pending offers where expiresAt <= now
mark expired atomically
continue matching round where required
```

## Critical safety rule

Correctness must not depend only on the timer running.

When accepting an offer, MongoDB query must also require:

```text
status = PENDING
expiresAt > now
```

Therefore an expired offer cannot be accepted even if the background scan is temporarily delayed.

This makes the simple worker recoverable after server restart.

---

# 22. Google Maps Platform

MERN does not provide road routing/navigation data.

Google Maps provides:

- interactive maps,
- Places search,
- geocoding,
- manual pins,
- routes,
- ETA,
- distance,
- route matrix.

RouteBite should not call route APIs for every database record.

Use:

```text
MongoDB coarse shortlist
       ↓
Google Maps for small candidate set
```

API keys must be restricted by environment/application and billing quotas should be configured.

---

# 23. Razorpay Test Mode

Razorpay is used only for prototype checkout.

The authoritative payment confirmation must happen on the backend.

Never trust only a frontend message saying `Payment successful`.

Backend responsibilities include:

- create test payment/order,
- verify returned payment signature where applicable,
- process webhooks idempotently,
- persist payment state,
- start matching only after valid payment confirmation.

Production payouts/settlement remain outside prototype scope.

---

# 24. Cloudinary + Multer

MongoDB should store metadata and references, not large image files.

Use Cloudinary for:

```text
profile photo
college ID proof
purchase receipt
```

Use Multer to receive the upload temporarily and send it to Cloudinary.

## Privacy rule

Sensitive identity documents must use private/authenticated delivery, not public URLs.

MongoDB stores data such as:

```text
cloudinaryPublicId
resourceType
uploadedAt
ownerUserId
purpose
```

Generate access only for authorized users/admin flows.

Do not save secrets or signed delivery URLs permanently.

---

# 25. Money Representation

Use integer **paise**, not floating-point rupees.

Good:

```js
estimatedFoodCostPaise = 20000;
platformFeePaise = 1000;
```

Avoid:

```js
price = 200.10;
```

JavaScript integer numbers are exact for RouteBite's expected small monetary values as long as values remain well below `Number.MAX_SAFE_INTEGER`.

All money validation should require non-negative safe integers where appropriate.

---

# 26. Time Representation

MongoDB/Mongoose `Date` values should represent UTC timestamps.

Backend stores exact timestamps such as:

```text
createdAt
expiresAt
scheduledDepartureAt
deliveryWindowStart
deliveryWindowEnd
```

The frontend converts them to the user's local time for display.

Do not store ambiguous strings such as:

```text
"6 PM"
```

as the authoritative time value.

---

# 27. Environment Variables

Secrets and environment-specific configuration belong in environment variables.

Examples:

```text
MONGODB_URI
JWT_SECRET
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
GOOGLE_MAPS_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Commit a safe `.env.example` containing names only.

Never commit real `.env` secrets.

---

# 28. Security Middleware

Use a few small Express middleware packages where they solve concrete problems:

- `helmet` for common HTTP security headers,
- `cors` during local development when Vite and Express use different origins,
- `express-rate-limit` for login/OTP/high-risk endpoints.

These are support libraries, not architectural subsystems.

Production same-origin deployment should minimize CORS complexity.

---

# 29. Testing

The first priority is backend business-rule testing.

Use **Jest + Supertest**.

Critical tests include:

```text
two partners accept same order → exactly one succeeds
expired offer cannot be accepted
matching cannot start before payment confirmation
unapproved partner cannot go online
partner with active order cannot accept incompatible second order
wrong delivery OTP cannot complete order
same Razorpay webhook processed twice → financial state changes once
completed order cannot be cancelled normally
```

Frontend automated testing may be added after the core prototype works.

A written end-to-end rehearsal remains mandatory before presentation.

---

# 30. Logging

Do not add a full observability platform initially.

Create a small structured logging utility.

Every important log should include identifiers when available:

```text
requestId
orderId
partnerId
userId
event
```

Never log:

- passwords,
- JWTs,
- raw OTPs outside explicit development mode,
- identity document contents,
- Razorpay secrets.

If operational debugging later becomes difficult, a logging/monitoring service can be added.

---

# 31. Deployment

The simplest production-like prototype deployment is **one Node service**.

Build flow:

```text
React/Vite source
     ↓
npm run build
     ↓
client/dist
     ↓
Express serves static build
```

The same Express HTTP server also runs:

```text
/api REST routes
Socket.IO
small periodic background scans
```

External managed components:

```text
MongoDB Atlas
Cloudinary
Google Maps
Razorpay
```

Possible hosting:

- Render,
- Railway,
- another Node-capable host.

Do not split frontend/backend deployments unless there is a concrete reason.

---

# 32. Repository Structure

Recommended implementation structure:

```text
routebite/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── constants/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── sockets/
│   │   ├── jobs/
│   │   └── utils/
│   ├── tests/
│   └── package.json
│
├── docs/
├── package.json
├── .env.example
└── README.md
```

A root `package.json` may provide convenience scripts such as:

```text
npm run dev
npm run client
npm run server
npm test
npm run build
npm start
```

No monorepo tool is required.

---

# 33. Technologies Explicitly NOT Required Initially

Do not add these to the prototype unless a concrete problem appears:

```text
NestJS
PostgreSQL
Prisma
Supabase
Redis
BullMQ
pg-boss
RabbitMQ
Kafka
Redux
Zustand
TanStack Query
Docker
Kubernetes
GraphQL
Microservices
Event sourcing
CQRS infrastructure
Elasticsearch
Playwright/Cypress before core flow works
```

This is not a claim that these technologies are bad.

They are simply unnecessary for the current prototype.

---

# 34. What a Developer Should Learn First

If the developer already knows MERN, review in this order:

```text
1. Express layered architecture
2. Mongoose atomic updates
3. MongoDB transactions
4. MongoDB 2dsphere geospatial indexes
5. Socket.IO rooms/events
6. JWT HttpOnly cookie authentication
7. Google Maps Routes / ETA concepts
8. Razorpay test payment verification/webhooks
9. Cloudinary private uploads
10. Race-condition and idempotency testing
```

The most important new concepts are not new frameworks. They are **correctness concepts**:

- atomic updates,
- transactions,
- idempotency,
- state machines,
- expiry timestamps,
- authoritative backend state.

---

# 35. Final Stack Principle

The prototype is **MERN first, specialized services second**.

```text
MERN handles:
UI
API
business logic
authentication
data
geospatial shortlist
state transitions

Socket.IO handles:
realtime UI communication

Google Maps handles:
road/map/routing intelligence

Razorpay handles:
payment checkout

Cloudinary handles:
file storage
```

This is sufficient to build the complete RouteBite prototype without forcing the project into unnecessary infrastructure.