# RouteBite — Prototype Email Verification

> **Status:** CONFIRMED FOR PROTOTYPE
>
> This decision supersedes the **phone-verification requirement** in ADR-026 and the sentence in ADR-045 that describes phone OTP as the prototype product-verification flow. The rest of those decisions remains valid.

## Decision

For the zero/low-cost campus prototype, RouteBite verifies account ownership through **email OTP** rather than paid SMS OTP.

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

The phone number remains stored for future delivery/contact use, but the prototype must not claim that a phone number is verified unless a real SMS verification provider is used.

## Provider

- Resend is the prototype email provider.
- `RESEND_API_KEY` is optional during local development.
- If Resend is not configured in development, the backend prints the email OTP to the terminal as an explicit development fallback.
- Production must not fall back to console OTP.
- `onboarding@resend.dev` is suitable only for Resend's restricted testing flow. Sending to arbitrary recipients requires a verified sending domain.

## Security rules

- Generate OTP server-side with cryptographically secure randomness.
- Store only an HMAC/hash representation of the OTP.
- OTP expires after 5 minutes.
- Enforce a resend cooldown.
- Limit incorrect verification attempts.
- Do not return the OTP in an API response.
- Partner approval checks `emailVerified` server-side.

## Future production path

When RouteBite needs stronger delivery/contact trust, add real phone OTP through an SMS provider as a separate verification signal:

```text
email verification → account ownership
phone verification → delivery/contact trust
campus ID review   → partner identity trust
```
