# Phase 16 — Google Maps Setup and Live Rehearsal

> **Status:** OWNER ACTION REQUIRED — browser key is now needed for live provider testing
>
> **Code checkpoint:** `bf1d4f68f717d06c52dd77fd2b462de75d63b1f6`
>
> **GitHub Actions:** RouteBite checks run #393 passed

This runbook is the source of truth for configuring Google Maps Platform for RouteBite Phase 16. The application code, mocked provider tests, backend regressions and production build are already green. Account creation, billing acceptance and the restricted browser key are the only steps that require the product owner's Google Cloud access.

## 1. Credential separation

RouteBite uses separate credentials for separate trust boundaries.

| Credential | Local file | Used by | Required APIs | Restriction |
| --- | --- | --- | --- | --- |
| Browser key | `frontend/.env` as `VITE_GOOGLE_MAPS_BROWSER_KEY` | Map, place search and reverse geocoding in the browser | Maps JavaScript API, Places API (New), Geocoding API | Websites / HTTP referrers plus API restrictions |
| Server key | `backend/.env` as `GOOGLE_MAPS_API_KEY` | Existing server-side route estimate service | Routes API | API restriction and server-appropriate application restriction when the deployment platform supports it |

Do not reuse one key for both rows. A browser key appears in the downloaded frontend by design; its safety comes from strict website and API restrictions, not secrecy. Server credentials must never enter a `VITE_` variable or the frontend bundle.

## 2. Create the Google Cloud project

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a dedicated project such as `routebite-mvp`, or select an existing RouteBite-only project.
3. Link a billing account when Google requests it.
4. In **APIs & Services → Library**, enable exactly these Phase 16 browser services:
   - **Maps JavaScript API**
   - **Places API (New)**
   - **Geocoding API**
5. Enable **Routes API** only if the existing backend route-estimate key is also being configured in this project.

Do not enable unrelated Maps APIs “just in case.” A smaller enabled surface is easier to secure and monitor.

## 3. Create and restrict the browser key

1. Open **APIs & Services → Credentials**.
2. Choose **Create credentials → API key**.
3. Rename it to `RouteBite browser - development`.
4. Under **Application restrictions**, select **Websites** / **HTTP referrers**.
5. Add the development referrers that will actually be used:

   ```text
   http://localhost:5173/*
   http://127.0.0.1:5173/*
   ```

6. For a same-Wi-Fi map rehearsal, also add the laptop's current LAN origin, replacing the example address:

   ```text
   http://192.168.1.25:5173/*
   ```

7. Under **API restrictions**, choose **Restrict key** and allow only:
   - Maps JavaScript API
   - Places API (New)
   - Geocoding API
8. Save the key and allow a few minutes for restrictions to propagate.

The LAN IP can change after reconnecting to Wi-Fi. Update the referrer entry when that happens. Add the final HTTPS deployment domain later; never use an unrestricted wildcard for a public key.

## 4. Configure RouteBite locally

Never paste the key into chat, source code, screenshots, issues or pull requests.

On the development computer, create or edit `frontend/.env`:

```env
VITE_GOOGLE_MAPS_BROWSER_KEY=your_browser_key_here
VITE_GOOGLE_MAPS_MAP_ID=
VITE_ENABLE_COORDINATE_FALLBACK=false
```

`VITE_GOOGLE_MAPS_MAP_ID` is optional for Phase 16 local rehearsal. RouteBite uses Google's demo map ID when it is blank; create a dedicated map ID before production branding/launch.

Restart the frontend after saving the environment file:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

The backend continues in a separate terminal:

```powershell
cd backend
npm run dev
```

## 5. Cost safeguards before sharing a link

1. In **Billing → Budgets & alerts**, create a small project-scoped budget with email thresholds.
2. If **Spend cap budget** is offered and the required Maps services are eligible, use it for this development project.
3. Otherwise, remember that a normal alerts-only budget sends notifications but does **not** automatically stop API use or charges.
4. In **IAM & Admin → Quotas & System Limits**, filter each enabled Maps service and lower adjustable request quotas to development-appropriate values.
5. Review usage after the rehearsal and before every public/judge link.

Do not automate disabling billing for this project without a separate recovery review; Google warns that detaching billing can shut down resources and may cause loss.

Official references:

- [Set up the Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key)
- [API key security best practices](https://developers.google.com/maps/api-security-best-practices)
- [Create and manage Cloud Billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- [Cap API usage with quotas](https://docs.cloud.google.com/apis/docs/capping-api-usage)
- [Google Maps Platform India pricing](https://developers.google.com/maps/billing-and-pricing/pricing-india)

## 6. Secure-context limitation for phone testing

Browser geolocation requires a secure context. `localhost` is treated as trustworthy on the development laptop, but a phone opening `http://192.168.x.x:5173` usually is not.

Therefore:

- place search, map display, click-to-place and draggable pin can be rehearsed over the same-Wi-Fi HTTP link;
- **Use my current location** should be tested on laptop `localhost` now;
- phone geolocation must be tested later through a trusted HTTPS preview/tunnel or the deployed HTTPS application.

This is a browser security rule, not a RouteBite matching or internet-connectivity defect.

## 7. Live rehearsal checklist

Keep pull request #17 in draft until this checklist passes.

### Configuration

```text
[ ] browser key is in frontend/.env only
[ ] browser key has website/referrer restrictions
[ ] browser key is restricted to three Phase 16 APIs
[ ] billing budget/alerts are configured
[ ] adjustable API quotas were reviewed
[ ] frontend was restarted after the .env change
```

### Customer request

```text
[ ] search and choose a known food place or landmark
[ ] move the pickup pin to an unlisted vendor
[ ] enter a clear vendor name and pickup instructions
[ ] choose and adjust the delivery point
[ ] create one ASAP request without typing coordinates
[ ] customer sees the expected human-readable locations
```

### Partner trip

```text
[ ] search and choose trip origin and destination
[ ] save one scheduled trip without typing coordinates
[ ] matching produces the expected offer
[ ] partner can accept and assignment remains exclusive
```

### Recovery and data

```text
[ ] deny browser location permission; search/pin still work
[ ] block Maps temporarily; an error/recovery state appears
[ ] refresh after recovery; the chosen locations remain understandable
[ ] backend data keeps GeoJSON order [longitude, latitude]
[ ] npm run hardening:audit returns 0 errors / 0 warnings
```

## 8. Evidence to record before merge

Record in `docs/PHASE_16_LOCATION_EXPERIENCE.md` and the progress report:

- the live-rehearsal date and browsers/devices;
- ASAP and scheduled order identifiers used for testing;
- the invariant-audit result;
- the final Phase 16 commit and GitHub Actions run;
- any secure-context limitation observed on the same-Wi-Fi phone test;
- pull request #17 merge reference.

Never record the API key itself.
