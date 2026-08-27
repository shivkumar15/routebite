export default function RouteStoryIllustration() {
  return (
    <svg
      className="route-story-illustration"
      viewBox="0 0 640 520"
      role="img"
      aria-labelledby="route-story-title route-story-desc"
    >
      <title id="route-story-title">A local food order travelling along a RouteBite route</title>
      <desc id="route-story-desc">
        A street-food stall, pickup pin, moving delivery partner and customer destination connected by one route.
      </desc>

      <rect className="story-sky" x="22" y="22" width="596" height="458" rx="42" />
      <circle className="story-sun" cx="527" cy="97" r="38" />
      <path className="story-cloud" d="M82 104c12-25 49-25 60 0 24-8 43 10 43 31H63c0-18 7-28 19-31Z" />

      <g className="story-stall" transform="translate(58 218)">
        <rect className="stall-shadow" x="12" y="180" width="180" height="20" rx="10" />
        <rect className="stall-body" x="22" y="70" width="160" height="112" rx="10" />
        <path className="stall-awning" d="M11 71h182l-18-49H29L11 71Z" />
        <path className="stall-stripe" d="M29 22h30L49 71H11l18-49Zm60 0h30l4 49H85l4-49Zm60 0h26l18 49h-38l-6-49Z" />
        <rect className="stall-counter" x="12" y="106" width="180" height="22" rx="6" />
        <rect className="stall-window" x="42" y="139" width="54" height="43" rx="6" />
        <rect className="stall-window" x="112" y="139" width="42" height="43" rx="6" />
        <g className="steam steam-one">
          <path d="M66 18c-14-18 12-18 0-35" />
          <path d="M85 15c-12-16 11-17 1-30" />
        </g>
        <text
          className="stall-label"
          x="102"
          y="117"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: '#FFF7EF', fontSize: '8.5px', letterSpacing: '1.25px' }}
        >
          LOCAL FAVOURITE
        </text>
      </g>

      <g className="story-destination" transform="translate(468 250)">
        <rect className="building-shadow" x="-8" y="132" width="140" height="18" rx="9" />
        <rect className="building-main" x="12" y="15" width="98" height="124" rx="12" />
        <rect className="building-top" x="28" y="-8" width="66" height="28" rx="8" />
        <g className="building-windows">
          <rect x="30" y="42" width="18" height="18" rx="4" />
          <rect x="72" y="42" width="18" height="18" rx="4" />
          <rect x="30" y="78" width="18" height="18" rx="4" />
          <rect x="72" y="78" width="18" height="18" rx="4" />
        </g>
        <rect className="building-door" x="50" y="105" width="24" height="34" rx="5" />
        <text
          className="building-label"
          x="61"
          y="6"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: '#FFF7EF', fontSize: '9px', letterSpacing: '1.2px' }}
        >
          YOU
        </text>
      </g>

      <path
        id="delivery-route"
        className="story-route-base"
        d="M214 381 C276 309 340 319 392 350 C436 376 472 360 509 334"
      />
      <path
        className="story-route-active"
        d="M214 381 C276 309 340 319 392 350 C436 376 472 360 509 334"
      />

      <g className="pickup-pin" transform="translate(208 365)">
        <path d="M0 0c-20 0-33 15-33 33 0 28 33 57 33 57s33-29 33-57C33 15 20 0 0 0Z" />
        <circle cx="0" cy="31" r="11" />
      </g>

      <g className="drop-pin" transform="translate(514 303)">
        <path d="M0 0c-18 0-30 13-30 30 0 25 30 52 30 52s30-27 30-52C30 13 18 0 0 0Z" />
        <circle cx="0" cy="28" r="10" />
      </g>

      <g className="food-bubble" transform="translate(251 232)">
        <rect x="0" y="0" width="132" height="72" rx="22" />
        <path className="food-bag" d="M18 27h34l-4 30H22l-4-30Zm8 0c0-9 18-9 18 0" />
        <text x="65" y="28">Your craving</text>
        <text className="food-bubble__sub" x="65" y="49">from the exact stall</text>
      </g>

      <g className="rider" transform="translate(-26 -19)">
        <circle className="rider-wheel" cx="9" cy="24" r="9" />
        <circle className="rider-wheel" cx="43" cy="24" r="9" />
        <path className="rider-bike" d="M9 24 21 10l10 14H9Zm12-14h12l10 14M21 10l-5-8h9" />
        <circle className="rider-head" cx="28" cy="-3" r="7" />
        <path className="rider-body" d="m25 5 11 12-7 8" />
        <rect className="rider-box" x="34" y="2" width="17" height="16" rx="4" />
        <animateMotion dur="5.8s" repeatCount="indefinite" rotate="auto" path="M214 381 C276 309 340 319 392 350 C436 376 472 360 509 334" />
      </g>

      <g className="story-note" transform="translate(300 424)">
        <circle cx="0" cy="0" r="5" />
        <path d="M13 0h78" />
        <text x="103" y="5">someone already heading your way</text>
      </g>
    </svg>
  );
}
