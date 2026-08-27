import { Link } from 'react-router-dom';

export default function BrandMark({ compact = false }) {
  return (
    <Link className="brand-mark" to="/" aria-label="RouteBite home">
      <svg className="brand-mark__icon" viewBox="0 0 44 44" aria-hidden="true">
        <rect x="2" y="2" width="40" height="40" rx="13" />
        <path d="M11 29.5c4.2-9.7 9.7-14.7 21.5-15.1" />
        <circle cx="11" cy="29.5" r="3.2" />
        <circle cx="32.5" cy="14.4" r="3.2" />
        <path d="M18.7 26.2c2.1.2 4.2-.2 6-1.4" className="brand-mark__dash" />
      </svg>
      {!compact && (
        <span className="brand-mark__word">
          Route<span>Bite</span>
        </span>
      )}
    </Link>
  );
}
