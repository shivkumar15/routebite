# RouteBite — Deployment Guide

> **Status:** PROTOTYPE DEPLOYMENT SPECIFICATION
>
> This document defines how to run RouteBite locally and how to deploy the first working prototype with the smallest possible operational surface.
>
> RouteBite uses a MERN+ architecture: React + Vite, Node.js + Express.js, MongoDB Atlas, Mongoose, Socket.IO, Google Maps Platform, Razorpay Test Mode and Cloudinary.

---

# 1. Deployment Principle

The deployment rule is:

> **One public RouteBite application origin, one Node/Express application service, one MongoDB Atlas database, and managed external providers.**

For the prototype, avoid:

```text
multiple backend services
Kubernetes
Docker orchestration
separate WebSocket server
separate job server
Redis cluster
load balancer configuration
multiple production databases
```

The simple production shape is:

```text
User Browser
     │
     │ HTTPS
     ▼
RouteBite Node/Express Service
     ├── serves React build
     ├── /api/v1/*
     ├── /socket.io/*
     └── lightweight periodic jobs
             │
             ▼
        MongoDB Atlas

External:
Google Maps
Razorpay Test Mode
Cloudinary
```

---

# 2. Why Same-Origin Deployment

Preferred production URL shape:

```text
https://routebite.example.com/
https://routebite.example.com/api/v1/...
https://routebite.example.com/socket.io/...
```

The React frontend, REST API and Socket.IO share the same origin.

Benefits:

- simpler HttpOnly cookies,
- fewer CORS bugs,
- simpler Socket.IO configuration,
- fewer environment-specific URL mistakes,
- frontend and backend deploy together,
- easier debugging.

For the first prototype, this is preferable to deploying frontend and backend separately unless the hosting platform forces us to.

---

# 3. Local Development Architecture

Local development uses two processes for speed:

```text
React/Vite   http://localhost:5173
Express      http://localhost:5000
```

Vite should proxy backend traffic.

Example conceptual Vite proxy:

```text
/api       → http://localhost:5000
/socket.io → http://localhost:5000
```

This lets frontend code call:

```text
/api/v1/orders
```

instead of hardcoding different production/development hosts.

---

# 4. Local Prerequisites

Developer machine needs:

```text
Node.js LTS
npm
Git
MongoDB Atlas account/project
Google Maps Platform project
Razorpay account using Test Mode
Cloudinary account
```

A local MongoDB installation is optional if Atlas is used for development.

---

# 5. Node Version

Use one pinned Node.js LTS major version across:

```text
local development
CI
production hosting
```

Add an `.nvmrc` or package `engines` field.

Example concept:

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

At project scaffolding time, select the actual supported LTS version and pin it deliberately.

Do not silently deploy on a different major version from local development.

---

# 6. Environment Files

Never commit real secrets.

Recommended files:

```text
.env                 ignored
.env.example         committed
client/.env          ignored if needed
```

Prefer keeping sensitive secrets only on the Express server.

The browser should only receive values safe for public exposure.

---

# 7. Recommended Environment Variables

Example `.env.example`:

```bash
NODE_ENV=development
PORT=5000

MONGO_URI=

JWT_SECRET=
JWT_EXPIRES_IN=7d
COOKIE_NAME=routebite_token

CLIENT_ORIGIN=http://localhost:5173

GOOGLE_MAPS_SERVER_API_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

DEV_PHONE_OTP_ENABLED=true

MAX_ASAP_DELIVERY_MINUTES=45
MAX_ROUTE_DETOUR_MINUTES=10
MAX_ROUTE_DETOUR_KM=1.5
OFFER_BATCH_SIZE=3
OFFER_TIMEOUT_SECONDS=20
DEFAULT_DEPARTURE_FLEX_MINUTES=15
DEFAULT_PARTNER_EARNING_PAISE=4000
DEFAULT_PLATFORM_FEE_PAISE=1000
MAX_LOCATION_AGE_SECONDS=60
PRICE_CONFIRMATION_TIMEOUT_MINUTES=3
```

If Google Maps JavaScript API requires a browser key, expose only the browser-restricted key through a Vite variable such as:

```bash
VITE_GOOGLE_MAPS_BROWSER_KEY=
```

Browser keys are not secret, but must be restricted by allowed origin/referrer and enabled API scope.

---

# 8. Environment Validation

The server should validate required environment variables on startup.

Do not allow the app to start and fail later because:

```text
MONGO_URI missing
JWT_SECRET missing
Razorpay secret missing
Cloudinary secret missing
```

In development, optional integrations may be clearly disabled.

Example:

```text
Razorpay not configured → payment endpoints unavailable with explicit error
```

Do not silently substitute unsafe defaults.

---

# 9. MongoDB Atlas Setup

Create separate Atlas databases for environments where practical:

```text
routebite_dev
routebite_test
routebite_demo
```

At minimum, test data must be isolated from demo data.

## Atlas steps

1. Create Atlas project/cluster.
2. Create database user with strong password.
3. Obtain connection URI.
4. Configure network access.
5. Put URI in deployment secret/environment variable.
6. Run application once so Mongoose models/index setup can initialize.
7. Verify required indexes.

---

# 10. MongoDB Network Access

For local development, allow only the IP ranges needed where possible.

For deployment, configure Atlas network access compatible with the chosen host.

Avoid leaving unrestricted `0.0.0.0/0` permanently without understanding the risk.

Even when network access is broad, MongoDB must still require database authentication and strong credentials.

Never expose MongoDB connection credentials to React/browser code.

---

# 11. MongoDB Index Verification

Deployment is incomplete until important indexes exist.

Examples include:

```text
users.phone unique
partners.userId unique
partner location 2dsphere
provider webhook event ID unique
provider payment ID unique where required
order/offer lookup indexes
```

For critical uniqueness/invariant indexes defined in `DATABASE_DESIGN.md`, verify them in Atlas after deployment.

Do not assume indexes exist merely because code contains a schema definition.

---

# 12. MongoDB Transactions

RouteBite uses MongoDB transactions for selected multi-document correctness operations.

Atlas must run on a deployment configuration that supports transactions.

Critical transactional flows may include:

```text
partner accepts order
order assignment + offer state changes
order completion + earning creation
```

If a transaction fails, the API must return a failure and not pretend the action succeeded.

---

# 13. Google Maps Setup

Enable only the Google Maps capabilities RouteBite actually uses.

Possible APIs:

```text
Maps JavaScript API
Places API
Geocoding API
Routes API / Route Matrix as selected
```

Use separate keys where useful:

```text
browser key
server key
```

## Browser key restrictions

Restrict by:

```text
HTTP referrers / allowed domain
specific enabled APIs
```

## Server key restrictions

Restrict by:

```text
specific APIs
server/IP restrictions when deployment platform supports stable egress
```

Configure billing alerts and quotas.

---

# 14. Google Maps Cost Protection

Do not call route APIs on every GPS update.

Deployment must preserve the matching architecture:

```text
MongoDB coarse/geospatial shortlist
        ↓
small candidate set
        ↓
Google route/ETA calculation
```

For active tracking:

```text
partner GPS → Express → MongoDB/current state → Socket.IO
```

Google routing is recalculated only when useful, not every 10 seconds.

---

# 15. Razorpay Test Mode Setup

The prototype must use **Test Mode credentials**.

Configure:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

Frontend may receive the public test `key_id` when opening checkout.

The secret key must remain server-side.

---

# 16. Razorpay Webhook Endpoint

Recommended endpoint concept:

```text
POST /api/v1/webhooks/razorpay
```

Webhook verification must use the raw/signature-validating input required by the provider.

Be careful with Express JSON middleware ordering if raw body access is needed for signature verification.

This is a common deployment bug.

The webhook handler must also be idempotent using provider event IDs or an equivalent unique record.

---

# 17. Razorpay Demo Safety

Before presentation:

```text
[ ] account is in Test Mode
[ ] test key shown in browser only
[ ] secret remains server-side
[ ] webhook signature validation works
[ ] duplicate webhook is safe
[ ] no real payout logic exists
```

The UI should describe prototype settlement accurately.

---

# 18. Cloudinary Setup

Cloudinary stores:

```text
profile photos
college verification documents
purchase receipts
```

MongoDB stores references/metadata, not raw file bytes.

Server environment variables:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Do not expose the API secret to the browser.

---

# 19. File Storage Privacy

Partner identity documents should not be publicly browsable merely because their URL/reference exists.

Use private/authenticated delivery options where appropriate and return access only to authorized admin operations.

Receipt visibility should be limited to participants/admin according to product rules.

Do not place sensitive document URLs in public customer profile endpoints.

---

# 20. Production Build

Recommended production flow:

```text
install server dependencies
install/build client
create Vite production build
serve client/dist from Express
start Node server
```

Possible root scripts later:

```json
{
  "scripts": {
    "dev": "...",
    "build": "npm --prefix client run build",
    "start": "node server/server.js",
    "test": "...",
    "lint": "..."
  }
}
```

Exact scripts should match the final repository layout.

---

# 21. Express Static Serving

In production, Express can serve the React build.

Conceptually:

```text
/api/*        handled by API routes
/socket.io/*  handled by Socket.IO
/assets/*     React static assets
other GET     React index.html for client-side routing
```

API routes must be registered before the React catch-all handler.

Otherwise an API typo may incorrectly return HTML instead of JSON.

---

# 22. React Router Production Fallback

Because React Router uses client-side paths such as:

```text
/orders/:id
/partner
/admin
```

refreshing such a page must return the React `index.html`, not a server 404.

The Express fallback should only apply after API/socket/static routes.

---

# 23. Socket.IO Production Setup

Attach Socket.IO to the same HTTP server used by Express.

Conceptually:

```js
const server = http.createServer(app);
const io = new Server(server, options);
```

Start with:

```js
server.listen(PORT);
```

not a separate Express `app.listen()` plus another socket server.

This avoids having two different listeners/ports by mistake.

---

# 24. Socket Authentication

Socket connections should authenticate using the same user session/JWT cookie or a secure equivalent.

Do not trust client-provided room names.

The server decides whether a user may join:

```text
user room
partner room
order room
admin room
```

A customer who does not own an order must not receive that order's live location events.

---

# 25. Periodic Background Scans

The prototype may run lightweight scans inside the Node process for:

```text
expired offers
expired price approvals
expired OTP cleanup/status updates
stale matching attempts
```

Do not depend on `setTimeout()` objects surviving server restarts.

Persist deadlines in MongoDB as `expiresAt`.

On each API operation, validate expiry from MongoDB time values.

The periodic scanner is cleanup/progression assistance, not the only correctness mechanism.

---

# 26. Process Restart Behavior

After Node restart:

```text
MongoDB still contains authoritative state
pending deadlines still contain expiresAt
users can reconnect
Socket.IO clients reconnect
REST reload returns current order state
periodic scan resumes
```

No important order must exist only in server RAM.

---

# 27. Cookie Configuration

Local development:

```text
httpOnly: true
secure: false
sameSite: appropriate for local same-origin/proxy setup
```

Production HTTPS:

```text
httpOnly: true
secure: true
sameSite: lax or stricter when compatible
```

Do not store JWT in `localStorage` merely to simplify deployment.

---

# 28. HTTPS

Production deployment must use HTTPS.

Reasons:

```text
secure cookies
location/browser permissions
payment integration
user credentials
WebSocket security
```

Use `wss://` automatically through Socket.IO when the application is served over HTTPS.

Most managed Node hosting platforms provide TLS at the edge.

---

# 29. CORS

If using the preferred same-origin production deployment, CORS should be minimal or unnecessary for normal frontend API requests.

During local development, allow only the configured frontend origin.

Avoid:

```text
Access-Control-Allow-Origin: *
with credential cookies
```

Use explicit origin configuration.

---

# 30. Security Middleware

At deployment time enable basic protections such as:

```text
helmet
request body size limits
rate limiting on sensitive endpoints
cookie parsing
input validation
central error handling
```

Rate-limit particularly:

```text
login
OTP generation/verification
payment creation
partner offer acceptance abuse
admin login/actions where appropriate
```

---

# 31. Request Size Limits

Do not accept arbitrarily large JSON bodies.

Set reasonable Express limits.

Files should use Multer with explicit:

```text
maximum file size
allowed MIME types
allowed field count
```

Then upload to Cloudinary.

---

# 32. Logging

At minimum production logs should include:

```text
timestamp
request method/path
status code
request ID if implemented
user/order/offer IDs where appropriate
important lifecycle events
error stack server-side
```

Never log:

```text
passwords
JWTs
OTP raw values in production
Razorpay secret
Cloudinary secret
full identity document data
```

Development OTP may be logged only when explicitly using a development-only OTP mode.

---

# 33. Health Endpoint

Expose:

```text
GET /api/v1/health
```

Return simple process status.

A deeper readiness check may verify MongoDB connectivity.

Do not expose secrets or detailed infrastructure metadata.

---

# 34. Deployment Provider

The architecture does not require a specific provider.

Choose a managed host capable of:

```text
long-running Node.js process
WebSocket/Socket.IO support
HTTPS
custom environment variables
GitHub deployment
reasonable restart behavior
```

Examples may include Railway, Render, Fly.io, a VM, or another compatible Node host.

For the prototype, choose the provider that gives the simplest reliable deployment rather than optimizing for hypothetical scale.

Do not use a serverless-only deployment model that breaks long-lived Socket.IO connections unless realtime architecture is changed deliberately.

---

# 35. Deployment Build Settings

The chosen platform must know:

```text
repository root
install command
build command
start command
health-check path
Node version
environment variables
```

Before deploying, run the same production build locally.

Example:

```bash
npm run build
NODE_ENV=production npm start
```

Then open the production-style app locally and test client-side route refreshes.

---

# 36. Environment Separation

Use at least:

```text
Development
Test
Demo/Production prototype
```

Do not use the production/demo database for automated Jest tests.

Use separate Razorpay Test Mode records/configuration where helpful.

---

# 37. Database Backups

For prototype presentation, catastrophic data recovery is not highly complex, but Atlas backup capabilities should be understood.

Before a major demo:

- ensure admin account exists,
- ensure known partner test accounts exist,
- export/record any necessary demo setup data,
- know how to reset demo orders without deleting user accounts.

Avoid manually changing active orders immediately before presentation unless necessary.

---

# 38. Seed Script

Create a safe development/demo seed script later for:

```text
admin account
optional demo customer
optional approved demo partner
```

The seed must be explicit and environment-safe.

Never let production startup automatically overwrite/reset user data.

Example command concept:

```bash
npm run seed:demo
```

---

# 39. Migration Strategy for MongoDB

MongoDB does not eliminate schema migrations.

When document shape changes after data exists:

1. update Mongoose schema,
2. keep backward-compatible reads when possible,
3. write a small migration script if old documents need transformation,
4. test on non-production data,
5. run intentionally.

Do not put destructive migration logic inside every application startup.

---

# 40. Deployment Checklist — External Services

```text
[ ] MongoDB Atlas configured
[ ] database user configured
[ ] indexes verified
[ ] Google Maps billing/API enabled
[ ] browser key restricted
[ ] server key restricted where possible
[ ] Razorpay Test Mode credentials configured
[ ] Razorpay webhook secret configured
[ ] Cloudinary configured
[ ] document access policy checked
```

---

# 41. Deployment Checklist — Application

```text
[ ] NODE_ENV=production
[ ] production Node version correct
[ ] React production build succeeds
[ ] Express serves React build
[ ] React Router refresh works
[ ] /api routes return JSON
[ ] Socket.IO connects over HTTPS
[ ] auth cookie secure/httpOnly
[ ] MongoDB connects
[ ] health endpoint works
[ ] periodic expiry scan starts
[ ] secrets absent from Git
```

---

# 42. Pre-Demo Functional Checklist

On the deployed application test:

```text
[ ] register/login
[ ] partner application
[ ] admin approval
[ ] AVAILABLE_NOW location
[ ] create order
[ ] Google place/manual pin
[ ] Razorpay test checkout
[ ] automatic matching
[ ] Socket.IO offer
[ ] partner acceptance
[ ] actual price flow
[ ] pickup
[ ] live tracking
[ ] OTP
[ ] completion
[ ] demo earning
```

Also test:

```text
[ ] no partner flow
[ ] wrong OTP
[ ] browser refresh during active order
```

---

# 43. Rollback Principle

Keep deployments tied to Git commits.

If a deployment breaks the demo:

```text
identify last known good commit
redeploy that commit
```

Do not make undocumented manual changes directly on the production server.

Environment variables may be changed through the hosting platform, but important configuration changes should be reflected in documentation/.env.example where safe.

---

# 44. Monitoring for Prototype

The prototype does not require a large monitoring stack.

Minimum:

```text
hosting platform logs
health endpoint
MongoDB Atlas monitoring
Razorpay test dashboard
Google Maps usage dashboard
Cloudinary usage dashboard
```

Optional later:

```text
Sentry
structured logging service
uptime monitor
```

Add them only when they solve an observed debugging problem.

---

# 45. Common Deployment Bugs to Avoid

## Bug 1 — React refresh returns 404

Cause: missing SPA fallback.

## Bug 2 — `/api` returns React HTML

Cause: catch-all static route registered before API routes.

## Bug 3 — Socket works locally but not deployed

Cause: provider does not support WebSockets, origin config wrong, or socket attached to wrong server.

## Bug 4 — login cookie not sent

Cause: cookie `secure`/`sameSite`/origin configuration mismatch.

## Bug 5 — Razorpay webhook verification always fails

Cause: request body transformed before signature verification or wrong webhook secret.

## Bug 6 — Google Maps works locally but not production

Cause: referrer restriction missing production domain.

## Bug 7 — duplicate payment event

Cause: webhook handler not idempotent.

## Bug 8 — MongoDB geo query fails

Cause: coordinates stored as `[lat, lng]` instead of `[lng, lat]` or missing `2dsphere` index.

## Bug 9 — offer accepted after timeout

Cause: frontend countdown treated as authority instead of backend checking `expiresAt`.

## Bug 10 — sensitive Cloudinary document is public

Cause: incorrect asset delivery/access configuration.

---

# 46. Deployment Completion Rule

Deployment is complete only when the deployed environment can execute the full RouteBite acceptance scenario without:

```text
manual MongoDB updates
local-only services
hardcoded localhost URLs
browser console secret exposure
production CORS workarounds
manual Socket.IO reconnection hacks
```

The deployed prototype should behave like the local application, with MongoDB and external provider configuration being the main environmental differences.
