# RouteBite — UI Design System

> **Status:** CONFIRMED FOR PROTOTYPE
>
> This document defines the visual direction, color system, typography, spacing, navigation, component language, responsive behavior, map treatment, and UI rules for RouteBite.
>
> The primary goal is to make RouteBite feel like a real hyperlocal food-delivery product with its own identity — **not a generic AI-generated SaaS application, chatbot, analytics dashboard, or template website**.

---

# 1. Visual Direction

RouteBite should feel like:

- local,
- warm,
- mobile-first,
- map-aware,
- fast,
- trustworthy,
- food-adjacent without looking childish,
- modern without looking futuristic.

The visual concept is:

> **Modern Local Street Utility**

The product should visually combine:

```text
local food culture
+
movement / routes
+
maps / pickup points
+
trust
+
clean modern product UI
```

It should **not** look like:

```text
AI chatbot
crypto dashboard
enterprise SaaS dashboard
purple-gradient startup landing page
Glassmorphism demo
Material UI admin template
shadcn default theme copied without modification
```

---

# 2. Brand Personality

RouteBite should communicate:

### Local
The product exists around real streets, food stalls, shops, campuses, and familiar pickup points.

### Useful
The interface should prioritize the current task rather than decorative UI.

### Human
Copy should sound natural and specific to food delivery.

### Energetic
Movement, delivery, and food should give the product energy without making the screen noisy.

### Trustworthy
Orders, payments, partner identity, OTP, and status should feel clear and dependable.

---

# 3. Primary Color Direction

The recommended palette intentionally avoids the common AI combination of:

```text
purple + blue gradients + black glass cards
```

It also avoids using bright red as the entire brand, because that would make the product feel too close to common food-delivery branding.

RouteBite will use a **warm editorial palette** built around deep burgundy, saffron/orange, warm cream, charcoal, and restrained green.

## 3.1 Core Brand Colors

### RouteBite Burgundy — Primary Brand

```text
#5B2434
```

Use for:

- logo wordmark,
- major headings where appropriate,
- primary dark buttons,
- active navigation states,
- important delivery/customer destination markers,
- selected states.

Why:

- warmer than navy,
- more distinctive than generic blue,
- connected visually to food without becoming bright restaurant red,
- works well with cream and orange.

Primary button example:

```text
Background: #5B2434
Text:       #FFFFFF
```

---

### RouteBite Saffron — Action / Movement Accent

```text
#E47A2E
```

Use for:

- pickup markers,
- route highlights,
- earning highlights,
- active delivery progress,
- small CTA emphasis,
- illustrated accents.

Do **not** use saffron as body text on white.

Do not make every button orange.

The primary CTA should usually remain burgundy so orange remains visually special.

---

### Warm Cream — Main Application Background

```text
#F7F2E8
```

Use as the main app/background color instead of pure white.

This is one of the most important choices for avoiding the generic SaaS appearance.

It makes the product feel warmer, more editorial, and more connected to food/local culture.

---

### Surface White

```text
#FFFDF8
```

Use for:

- cards,
- sheets,
- search fields,
- modals,
- order panels,
- floating map controls.

This should appear slightly warm rather than cold `#FFFFFF` everywhere.

---

### Ink — Primary Text

```text
#1F1E1B
```

Use for:

- body text,
- titles,
- form labels,
- important values.

Avoid pure black unless required for a specific visual treatment.

---

### Muted Text

```text
#706B62
```

Use for:

- secondary descriptions,
- timestamps,
- helper copy,
- low-priority metadata.

---

### Border / Divider

```text
#DED6C9
```

Use subtle borders rather than heavy box outlines.

---

## 3.2 Functional Colors

### Success

```text
#2F7657
```

Use for:

- order completed,
- verification approved,
- payment confirmed,
- successful OTP,
- available/online indication.

### Warning

```text
#C58B26
```

Use for:

- waiting,
- price confirmation,
- location getting stale,
- scheduled timing attention.

### Error / Danger

```text
#B6403A
```

Use for:

- payment failure,
- rejected actions,
- destructive actions,
- wrong OTP,
- cancellation warning.

### Information

```text
#3E6573
```

Use sparingly for informational notices where brand colors are inappropriate.

---

# 4. Color Usage Ratio

The screen should not look colorful everywhere.

Approximate visual distribution:

```text
60–70%  Warm cream / neutral background
20–25%  Warm white surfaces
5–10%   Burgundy brand elements
3–5%    Saffron accents
<5%     Functional colors
```

This keeps the product sophisticated.

A common AI-generated UI mistake is using the brand color on every card, icon and heading. RouteBite should use color as hierarchy, not decoration.

---

# 5. Pickup and Drop Color Semantics

Location colors must remain consistent across the entire product.

## Pickup

```text
Saffron / Orange
#E47A2E
```

Meaning:

> collect food here

## Destination / Drop

```text
RouteBite Burgundy
#5B2434
```

Meaning:

> deliver here

## Partner Current Location

```text
Green
#2F7657
```

Meaning:

> partner is here now

This convention should appear consistently in:

- maps,
- order cards,
- route diagrams,
- timeline components,
- partner offers.

Do not randomly change pin colors between screens.

---

# 6. Route Visualization

Routes are a core part of RouteBite's identity.

The route line should not resemble a futuristic neon map.

Recommended behavior:

```text
base route           muted warm gray
active route         burgundy
pickup segment       saffron emphasis
partner marker       green
```

Use rounded line caps and clear map markers.

Small non-map route diagrams may look like:

```text
Pickup ●────────────● Drop
       Civil Lines   IIIT-A
```

The product should reuse this visual motif throughout the interface.

---

# 7. Gradient Policy

Default rule:

> **No gradients in the core product UI.**

Especially avoid:

```text
purple → blue
aqua → violet
black glass → neon glow
multi-color glowing backgrounds
```

A subtle brand illustration or marketing asset may use a restrained warm gradient in the future, but buttons, cards, navigation, forms and dashboards should use solid colors.

---

# 8. Dark Mode

Do **not** build dark mode in V1.

Reasons:

- doubles visual QA surface,
- map appearance requires separate tuning,
- not needed to validate product behavior,
- encourages unnecessary black/neon styling.

A deliberate dark mode can be added later.

---

# 9. Typography

Typography should feel editorial and product-oriented rather than futuristic.

Recommended direction:

### Primary UI Font

Use a clean sans-serif such as:

```text
Inter
or
Manrope
```

Prefer **Manrope** if the final visual testing looks good because it gives slightly more personality than default Inter while remaining highly readable.

Avoid overly technological fonts.

Do not use monospace fonts for normal product UI.

## Weight System

```text
400  body
500  labels / secondary emphasis
600  buttons / section headings
700  major titles
```

Avoid excessive bold text.

## Suggested Scale

```text
12px   tiny metadata
14px   helper / secondary text
16px   normal body / controls
18px   strong card title
22px   section heading
28px   mobile page heading
36px   desktop hero/product heading where appropriate
```

---

# 10. Radius System

Avoid the generic AI pattern where every element is a huge rounded pill.

Use a controlled radius scale:

```text
6px   small tags / compact controls
10px  inputs / buttons
14px  standard cards
18px  bottom sheets / major mobile panels
999px only for true pills, avatars, status chips
```

Not every rectangle should become a capsule.

---

# 11. Shadows

Use very little shadow.

Default cards should use:

```text
soft border
+
subtle elevation only when needed
```

Avoid large blurry shadows beneath every card.

Use stronger elevation mainly for:

- floating map sheets,
- modals,
- sticky action panels,
- bottom sheets.

---

# 12. Spacing System

Use a consistent 4px-based spacing scale:

```text
4
8
12
16
20
24
32
40
48
64
```

Normal mobile page horizontal padding:

```text
16–20px
```

Desktop content should not stretch edge-to-edge.

---

# 13. Buttons

## Primary Button

```text
Background: Burgundy #5B2434
Text: White
Radius: 10px
Height: approximately 48px on mobile
```

Examples:

```text
Find a Partner
Accept Delivery
Continue to Payment
Verify OTP
```

## Secondary Button

Warm surface background with burgundy border/text.

## Destructive Button

Danger color only for genuinely destructive actions such as cancellation or rejection.

## Saffron CTA

Use sparingly for high-energy partner actions such as:

```text
Go Online
Earn ₹40
```

But do not mix primary burgundy and orange CTAs without a clear hierarchy.

---

# 14. Input Fields

Inputs should be simple and tactile.

Recommended:

```text
warm-white background
1px border
10px radius
clear label above field
strong focus ring using burgundy or saffron
```

Avoid floating labels unless there is a strong UX reason.

Location inputs can visually show:

```text
orange pickup dot
burgundy destination dot
```

---

# 15. Navigation

## Customer / Partner Main App

Mobile-first bottom navigation:

```text
Home
Orders
Partner
Profile
```

Do not use a permanent enterprise-style left sidebar for normal users.

Desktop may adapt to a compact top/side navigation while preserving the same simple information architecture.

## Admin

Admin may use a more traditional side navigation because dense operational information is appropriate there.

Admin UI should still use the same brand color system, but function is more important than personality.

---

# 16. Home Screen Direction

The customer home screen should not be a dashboard.

The first question should be:

> **What are you craving?**

Suggested hierarchy:

```text
RouteBite logo / profile

What are you craving?

[ Search food / vendor               ]

Pickup
[ Civil Lines                         ]

Deliver to
[ IIIT-A Hostel                       ]

Recent / saved pickup points

[ Find a Partner ]
```

A map preview may sit underneath or become part of the location-selection flow.

---

# 17. Partner Home Direction

Do not show a generic earnings dashboard first.

The partner experience begins with two clear choices:

```text
Available to Deliver

or

I'm Going Somewhere
```

Example:

```text
Ready to deliver?

[ Go Online ]

────────── or ──────────

Already heading somewhere?
Earn on your route.

[ Add My Route ]
```

When active, route/availability state becomes the hero element.

---

# 18. Partner Offer Card

A RouteBite offer must emphasize the decision a partner needs to make.

Example structure:

```text
ON YOUR WAY

Sharma Chaat
Civil Lines

Pickup        Civil Lines
Drop          IIIT-A
Extra travel  +0.8 km
Extra time    +6 min

Earn ₹40

[ Accept ]    [ Skip ]
```

The card may include a small route diagram.

Avoid displaying ten unrelated metrics.

---

# 19. Matching Screen

The matching screen should feel alive without looking like an AI loading animation.

Avoid:

```text
pulsating AI orb
sparkles
chat typing dots
neural-network graphics
```

Use route/location motion instead.

Example:

```text
Finding someone heading your way…

Pickup ●────────────● You

Checking nearby RouteBite partners
```

A subtle moving point along a route line is acceptable.

---

# 20. Order Tracking Screen

This should be one of the strongest product screens.

Primary areas:

```text
map
partner location
pickup / drop markers
current order state
ETA
action sheet
```

Use a bottom sheet over the map on mobile.

Order status examples:

```text
Partner heading to pickup
At the food stall
Food picked up
On the way to you
Arriving soon
```

Prefer human language in UI instead of raw backend enum strings.

---

# 21. Status Chips

Status chips should use color carefully.

Examples:

```text
AVAILABLE NOW     green
SCHEDULED         warm neutral / information
MATCHING          saffron
ASSIGNED          burgundy
COMPLETED         green
CANCELLED         muted red
```

Never create rainbow-colored chips for every possible state.

---

# 22. Food Photography

Do not fill the interface with generic stock food photographs.

RouteBite is not initially a restaurant catalogue.

Food visuals may appear in:

- marketing/landing area,
- optional customer request imagery,
- contextual onboarding.

Core order UI should prioritize:

```text
location
food request
partner
route
status
```

---

# 23. Icons

Use one consistent icon family.

Good categories:

```text
location
route
bag
clock
wallet
receipt
user
shield
navigation
phone
```

Avoid decorative AI symbols such as:

```text
sparkles
magic wand
bot head
brain
stars around buttons
```

Do not put an icon inside every single label.

---

# 24. Illustration Direction

If illustrations are later created, they should use:

```text
street maps
food bags
scooters/bicycles/walking
local stalls
route lines
pickup pins
campus landmarks
```

Visual style should be flat/editorial rather than 3D AI render or glossy corporate illustration.

---

# 25. Empty States

Empty states should be product-specific.

Instead of:

```text
No data available
```

use:

```text
No orders yet.
Your first local craving will show up here.
```

Partner:

```text
No delivery offers right now.
Stay online and we'll show compatible requests here.
```

Avoid overly cheerful generated illustrations for every empty state.

---

# 26. Error States

Errors must clearly explain what happened and what the user can do.

Example:

```text
We couldn't find an available partner right now.

[ Try Again ]
[ Schedule for Later ]
```

Not:

```text
Oops! Something went wrong :(
```

Use specific product language.

---

# 27. Loading States

Prefer skeletons, route progress, or local contextual loaders.

Avoid large generic centered spinners for every screen.

Examples:

```text
Finding nearby partners…
Calculating route…
Confirming payment…
```

---

# 28. Motion

Motion should communicate state.

Allowed examples:

- bottom sheet slide,
- route progress movement,
- map marker movement,
- status transition,
- button feedback,
- subtle success confirmation.

Avoid:

- constant floating cards,
- ambient glowing animation,
- parallax everywhere,
- spinning 3D objects,
- excessive page-transition effects.

Animations should generally stay around 150–300ms for standard UI transitions.

---

# 29. Mobile-First Rule

The primary customer/partner experience must be designed for phone-sized screens first.

Reasons:

- users create orders while moving,
- partners use location from a phone,
- live delivery tracking is naturally mobile,
- campus/local use is mobile-heavy.

Desktop should adapt the mobile product rather than turning it into a completely different dashboard.

---

# 30. Screen Width and Layout

## Mobile

Full-width app shell with 16–20px page padding.

## Tablet/Desktop

Use a centered content area where appropriate.

Map-heavy pages may use split layouts:

```text
left: order information
right: map
```

Do not stretch forms to 1400px width.

---

# 31. Customer and Partner Visual Relationship

The customer and partner sides use the same brand.

However:

### Customer emphasis

```text
food
pickup
convenience
trust
ETA
```

### Partner emphasis

```text
route
detour
time
earning
availability
```

The visual system remains consistent but the information hierarchy changes.

---

# 32. Admin UI

Admin is allowed to feel more operational.

Use:

```text
tables
filters
status chips
compact cards
review panels
```

Still avoid template-dashboard excess such as dozens of analytics cards on the landing page.

Priority admin views:

```text
Partner Approvals
Active Orders
Failed Orders
Receipts
Disputes / Manual Review
```

---

# 33. Anti-AI / Anti-Template Rules

The following patterns are explicitly prohibited unless later deliberately approved:

```text
purple/blue gradient branding
huge glowing hero blobs
glassmorphism cards everywhere
AI sparkle icons
chatbot-style UI for normal workflows
bento grids used just for decoration
random metric cards
all controls fully pill-shaped
large generic SaaS sidebar for customer/partner
excessive shadow
neon map styling
futuristic grid backgrounds
fake testimonials in core product
AI-generated marketing copy such as "revolutionize your journey"
```

---

# 34. Copywriting Rules

Use simple, specific product language.

Good:

```text
What are you craving?
Pick the exact stall.
Can't find the shop? Drop a pin.
Going toward campus?
Earn on your way.
Partner is 6 min from pickup.
Food picked up.
```

Avoid:

```text
Unlock effortless experiences.
Transform your delivery journey.
Seamlessly connect with the future.
AI-powered convenience at your fingertips.
```

RouteBite should never market itself as AI-powered unless an actual future feature requires that claim.

---

# 35. Reusable RouteBite Components

Prefer domain-specific components over dozens of generic dashboard widgets.

Core components should include:

```text
LocationInput
PickupDropSelector
RoutePreview
FoodRequestSummary
PartnerOfferCard
PartnerIdentityCard
OrderStatusSheet
OrderTimeline
LivePartnerMap
PriceChangeCard
DeliveryOTPCard
AvailabilityToggle
ScheduledTripCard
ReceiptPreview
EmptyState
ErrorState
```

These components form RouteBite's visual language.

---

# 36. Suggested CSS Variables

The implementation should centralize visual tokens.

Example:

```css
:root {
  --rb-bg: #F7F2E8;
  --rb-surface: #FFFDF8;

  --rb-primary: #5B2434;
  --rb-primary-contrast: #FFFFFF;

  --rb-accent: #E47A2E;

  --rb-text: #1F1E1B;
  --rb-text-muted: #706B62;
  --rb-border: #DED6C9;

  --rb-success: #2F7657;
  --rb-warning: #C58B26;
  --rb-danger: #B6403A;
  --rb-info: #3E6573;

  --rb-radius-sm: 6px;
  --rb-radius-md: 10px;
  --rb-radius-card: 14px;
  --rb-radius-sheet: 18px;
}
```

Components should consume semantic variables rather than scattering raw hex values throughout React files.

---

# 37. Accessibility

Color must never be the only indicator of meaning.

Examples:

```text
green + "Payment confirmed"
red + "Payment failed"
orange + "Awaiting approval"
```

Buttons, text, maps and input controls should maintain strong readable contrast.

Interactive targets should generally be at least approximately 44px on mobile.

Focus states must remain visible for keyboard users.

---

# 38. First Screens to Design Before Coding

Before full UI implementation, close the visual design for these screens first:

```text
1. Customer Home / Create Request
2. Pickup + Drop Selection
3. Matching
4. Customer Active Order / Live Tracking
5. Partner Home
6. Partner Delivery Offer
7. Partner Active Delivery
8. Price Confirmation
9. Delivery OTP
10. Admin Partner Approval
```

If these screens look coherent, most other pages can inherit the same system.

---

# 39. Design Review Checklist

Before accepting any generated or implemented screen, ask:

```text
Does this look like RouteBite or a generic SaaS template?
Is the primary action obvious?
Is there unnecessary decoration?
Are pickup/drop colors consistent?
Does the screen use the approved palette?
Does it work on mobile?
Are route/location elements visible where relevant?
Is backend status translated into human language?
Does every card actually need to exist?
Could a generic AI app have generated this unchanged?
```

If the last answer is yes, the design needs more RouteBite-specific character.

---

# 40. Final Visual Rule

> **RouteBite should look like a warm, map-driven local delivery utility — not a dashboard with food icons added to it.**

The interface should get its identity from:

```text
warm cream surfaces
burgundy brand structure
saffron pickup/action accents
consistent route graphics
location-first layouts
specific food/delivery copy
mobile-first interaction
restrained visual decoration
```

This design system should be treated as the UI source of truth during implementation. Codex or any coding agent must follow this document rather than inventing its own theme.