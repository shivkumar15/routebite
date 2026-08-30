# RouteBite — Account Email Verification

> **Status:** IMPLEMENTED — owner inbox delivery and verification passed
>
> **Provider:** Resend
>
> **Normal product behavior:** verification code arrives in the account email inbox
>
> **Development fallback:** backend console only when explicitly working without a functioning provider

This decision supersedes the **phone-verification requirement** in ADR-026 and the sentence in ADR-045 that describes phone OTP as the initial product-verification flow. The rest of those decisions remains valid.

## Decision

RouteBite verifies account ownership through **email OTP** rather than making paid SMS OTP a dependency of the working MVP.

```text
Register / sign in
      ↓
Request email OTP
      ↓
6-digit code sent through Resend
      ↓
Backend verifies hashed OTP + expiry + attempt limit
      ↓
emailVerified = true
      ↓
Partner can be approved after manual campus-ID review
```

The phone number remains stored for future delivery/contact use, but RouteBite must not claim that a phone number is verified unless a real SMS verification provider is used.

Account email OTP is separate from the customer-to-partner delivery handoff OTP. This change does not affect delivery completion rules.

## Current implementation

The application code already supports real inbox delivery:

- `backend/src/services/email.service.js` sends the six-digit code through Resend;
- `backend/src/services/auth.service.js` generates the code, stores only its hash, enforces five-minute expiry, cooldown and attempt limits;
- `frontend/src/pages/customer/AccountPage.jsx` reports whether the code was sent by email or whether the development console fallback was used;
- production rejects missing/failed email delivery instead of exposing an OTP in logs.

If the code appears in the backend terminal, `RESEND_API_KEY` is missing or Resend rejected the request. That is a configuration/provider result, not the intended user experience.

## Live evidence

On 30 August 2026, the product owner configured Resend and confirmed that the account-verification email arrived and the verification flow worked without retrieving the code from the backend terminal.

This proves the initial owner-inbox path. It does not yet prove arbitrary-recipient delivery: the default Resend sender remains restricted until RouteBite configures a verified owned sending domain/subdomain.

## Provider

- Resend is the current transactional email provider.
- `RESEND_API_KEY` is required for inbox delivery.
- If Resend is not configured in development, the backend prints the email OTP to the terminal as an explicit development fallback.
- Production must not fall back to console OTP.
- `onboarding@resend.dev` can send only to the email address belonging to the Resend account.
- Sending to arbitrary customers, partners or judges requires a verified RouteBite-owned domain/subdomain and a matching `RESEND_FROM_EMAIL` value.

## Environment configuration

Local `backend/.env`:

```env
RESEND_API_KEY=re_your_private_key
RESEND_FROM_EMAIL=RouteBite <onboarding@resend.dev>
```

Never paste the API key into chat, commit it, expose it through the frontend, or place it in a `VITE_` variable.

For an initial personal test, register RouteBite with the same email address used by the Resend account. For multi-user/judge testing, first verify a sending subdomain such as `notify.example.com`, then use a matching sender:

```env
RESEND_FROM_EMAIL=RouteBite <verify@notify.example.com>
```

Restart the backend after changing `.env`.

## Security rules

- Generate OTP server-side with cryptographically secure randomness.
- Store only an HMAC/hash representation of the OTP.
- OTP expires after 5 minutes.
- Enforce a resend cooldown.
- Limit incorrect verification attempts.
- Do not return the OTP in an API response.
- Partner approval checks `emailVerified` server-side.
- Keep request/resend rate limiting; email delivery can otherwise become an abuse and cost vector.
- Treat accepted-by-provider, delivered, bounced and complained as different operational states before a real-user pilot.

## Acceptance gates

```text
[x] personal inbox receives the code without reading the backend terminal
[ ] UI says the code was sent to the account email
[ ] wrong, expired and reused codes remain rejected
[ ] resend cooldown and attempt limit remain enforced
[ ] external-recipient test passes from a verified sending domain before sharing publicly
[ ] provider failure produces a truthful recoverable error outside explicit development fallback
[ ] no raw account-verification OTP is logged in production
```

## Phone verification decision

Do not add SMS merely to avoid looking at the terminal. Email delivery already solves account ownership at lower complexity and cost. Add real phone OTP later only when delivery/contact trust requires it, as a separate verification signal:

```text
email verification → account ownership
phone verification → delivery/contact trust
campus ID review   → partner identity trust
```
