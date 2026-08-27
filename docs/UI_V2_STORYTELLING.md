# RouteBite — UI V2 Storytelling Direction

> **Status:** ACTIVE VISUAL DIRECTION
>
> This document supersedes the visual execution guidance in `UI_DESIGN_SYSTEM.md` where the two conflict. The original product principles still apply: RouteBite must feel local, useful, map-aware, warm, trustworthy and distinctly non-generic.

## 1. Quality Bar

RouteBite should have the polish of a modern consumer delivery product without copying Zomato, Swiggy, Blinkit or any other brand.

Inspiration means learning from their product discipline:

- strong first-screen identity,
- immediate category recognition,
- clear task hierarchy,
- visual storytelling,
- tasteful illustration and motion,
- mobile-first interaction,
- memorable brand presence.

Do not reuse competitor layouts, illustrations, icons, copy or brand colors.

## 2. RouteBite Story

Every important public/customer screen should reinforce this product story:

```text
local food place
      ↓
exact pickup
      ↓
compatible human route
      ↓
customer destination
```

The core visual motif is a route connecting two real places. Food and movement should be understood before the user reads a long explanation.

## 3. New Brand Palette

```text
RouteBite Coral       #E95A3D  primary energy / action
Deep Burgundy         #4B2030  premium anchor / headings
Warm Cream            #FFF7EF  application background
Warm White            #FFFCF8  surfaces
Saffron                #F2A43A  pickup / food / movement accent
Fresh Green            #248A5A  partner live / success
Ink                    #241F1D  text
Muted                  #746B65  secondary text
Border                 #E7D8CF  separators
```

The product should not become a red clone of Zomato, an orange clone of Swiggy, or a yellow clone of Blinkit. Coral + burgundy + cream is the RouteBite signature.

## 4. Typography

Primary font: `Manrope` with system fallbacks.

Large marketing/product headings may be bold and tightly tracked. Utility screens remain calmer and more compact.

## 5. Illustration Language

Use original, lightweight SVG illustrations composed from:

- street-food stalls,
- food bags,
- pickup pins,
- route lines,
- riders/walkers,
- homes/hostels/campus buildings,
- maps and street geometry.

Avoid glossy 3D renders, AI orbs, generic SaaS illustrations and stock-food collage overload.

## 6. Motion Language

Motion must explain state rather than decorate the page.

Approved examples:

- rider moving along a route,
- pickup pin breathing once or subtly pulsing,
- steam from a food stall,
- bottom sheet transitions,
- route progress revealing,
- offer card arrival,
- live location movement.

Respect `prefers-reduced-motion`.

## 7. Home Page Story

The home page should flow as:

```text
Brand + navigation
      ↓
Hero: food from places that do not deliver
      ↓
Animated stall → route → customer illustration
      ↓
Example craving/request
      ↓
How RouteBite works
      ↓
Two supply modes: On My Way / Available to Deliver
      ↓
Core product belief
      ↓
Action
```

The home page should feel like a consumer product, not a centered CRUD card.

## 8. Product Screens

The same visual system must extend into real functionality:

- Customer Home: food/place search + pickup + destination + route preview.
- Matching: route motion instead of generic spinner.
- Partner Home: Available Now and On My Way as visually distinct modes.
- Offer: compact route diagram + detour + earning.
- Tracking: map-first with mobile bottom sheet.
- Account/Auth: quieter utility presentation using the same brand tokens.
- Admin: operational density is allowed, but keep typography/colors consistent.

## 9. Rule Against Template Feel

Avoid repeating one centered white card for every feature.

Choose the layout based on the task:

- map + sheet for tracking,
- route card for matching,
- list/queue for admin,
- focused form for authentication,
- narrative sections for marketing/home,
- bottom navigation for core mobile product use.

## 10. Current Implementation

The first V2 implementation includes:

- refreshed coral/burgundy palette,
- Manrope typography,
- original RouteBite brand mark,
- original animated route-delivery SVG,
- story-driven responsive home page,
- new visual foundation designed to carry forward into Phase 2+ screens.
