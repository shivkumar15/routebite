import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../../components/common/BrandMark.jsx';
import RouteStoryIllustration from '../../components/common/RouteStoryIllustration.jsx';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import '../../styles/home.css';

export default function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState({ loading: true, status: 'checking', database: 'checking' });

  useEffect(() => {
    let active = true;

    api.get('/health')
      .then(({ data }) => {
        if (active) setHealth({ loading: false, status: data.status, database: data.database });
      })
      .catch(() => {
        if (active) setHealth({ loading: false, status: 'unreachable', database: 'unknown' });
      });

    return () => {
      active = false;
    };
  }, []);

  const connected = health.status === 'ok' && health.database === 'connected';
  const primaryPath = user ? '/account' : '/register';
  const primaryLabel = user ? 'Open RouteBite' : 'Start with RouteBite';

  return (
    <main className="home-page">
      <header className="home-container home-nav">
        <BrandMark />

        <nav className="home-nav__links" aria-label="Primary navigation">
          <a className="home-nav__link" href="#how-it-works">How it works</a>
          <a className="home-nav__link" href="#partners">For partners</a>
          {!user && <Link className="home-nav__link" to="/login">Sign in</Link>}
          <Link className="home-nav__account" to={primaryPath}>
            {user ? 'My account' : 'Get started'}
          </Link>
        </nav>
      </header>

      <section className="home-hero">
        <div className="home-container home-hero__grid">
          <div>
            <p className="hero-kicker">Your local favourites, unlocked</p>
            <h1>
              Food from the places that <em>don&apos;t deliver.</em>
            </h1>
            <p className="hero-copy">
              You already know the stall, bakery or tiny shop you want. RouteBite finds someone
              heading your way — or a nearby delivery partner — to bring it to you.
            </p>

            <div className="hero-actions">
              <Link className="hero-primary" to={primaryPath}>{primaryLabel} →</Link>
              <a className="hero-secondary" href="#how-it-works">See the route story</a>
            </div>

            <div className="hero-proof" aria-label="RouteBite product principles">
              <span>Vendor registration not required</span>
              <span>Exact pickup pin</span>
              <span>Route-aware delivery</span>
            </div>
          </div>

          <div className="hero-visual">
            <RouteStoryIllustration />
          </div>
        </div>
      </section>

      <section className="home-container craving-strip" aria-label="Example RouteBite request">
        <div className="craving-panel">
          <div>
            <p className="craving-panel__label">A RouteBite request</p>
            <h2>“Jalebi from that shop near Civil Lines.”</h2>
          </div>

          <div className="craving-panel__route">
            <div className="mini-location">
              <strong>Pickup</strong>
              <small>Your exact local shop</small>
            </div>
            <div className="mini-route-line" aria-hidden="true">
              <span className="mini-route-rider" />
            </div>
            <div className="mini-location">
              <strong>Deliver to</strong>
              <small>Your hostel / home</small>
            </div>
          </div>
        </div>
      </section>

      <section className="story-section" id="how-it-works">
        <div className="home-container">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">One craving. One route.</p>
              <h2>The shop can stay offline. The food doesn&apos;t have to.</h2>
            </div>
            <p className="section-heading__copy">
              RouteBite is built around pickup locations, not merchant onboarding. Tell us exactly
              where the food is, what you want and where it needs to go. We make that route
              deliverable.
            </p>
          </div>

          <div className="story-steps">
            <article className="story-card">
              <span className="story-card__number">01</span>
              <h3>Pick the exact local place.</h3>
              <p>Search the shop or drop a pin when the stall is not even listed properly online.</p>
              <span className="story-card__art" aria-hidden="true" />
            </article>

            <article className="story-card">
              <span className="story-card__number">02</span>
              <h3>We find a compatible route.</h3>
              <p>Someone already travelling that direction can take a small detour, or a nearby partner can deliver.</p>
              <span className="story-card__art" aria-hidden="true" />
            </article>

            <article className="story-card">
              <span className="story-card__number">03</span>
              <h3>Your food reaches you.</h3>
              <p>Track the trip, confirm the final food amount when needed, and complete delivery securely.</p>
              <span className="story-card__art" aria-hidden="true" />
            </article>
          </div>
        </div>
      </section>

      <section className="story-section story-section--soft" id="partners">
        <div className="home-container">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Two kinds of movement</p>
              <h2>Delivery that fits the city instead of fighting it.</h2>
            </div>
            <p className="section-heading__copy">
              RouteBite does not depend on only one delivery model. We can use movement that is
              already happening, while still having dedicated partners when a direct delivery is
              the better fit.
            </p>
          </div>

          <div className="supply-grid">
            <article className="supply-card supply-card--route">
              <span className="supply-card__tag">On my way</span>
              <h3>Already heading there?</h3>
              <p>Carry a compatible order with a small detour and earn on a route you were taking anyway.</p>
              <div className="supply-route-art" aria-hidden="true">
                <span>A</span>
                <span>B</span>
              </div>
            </article>

            <article className="supply-card supply-card--available">
              <span className="supply-card__tag">Available to deliver</span>
              <h3>Free right now?</h3>
              <p>Go online as a verified RouteBite partner and receive nearby requests that fit your location.</p>
              <div className="supply-route-art" aria-hidden="true">
                <span>●</span>
                <span>→</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="story-section">
        <div className="home-container product-belief">
          <p className="product-belief__quote">
            Why should every food seller join a platform before their food becomes <span>deliverable?</span>
          </p>
          <div className="product-belief__body">
            <p>
              RouteBite starts from a different assumption: the customer may already know exactly
              what they want and where it is sold. That local seller should not need software,
              menus, commissions or onboarding just for one customer to get their food.
            </p>
            <p>
              The customer identifies the pickup. RouteBite handles the movement. That is the
              product story our interface will keep reinforcing across ordering, matching and live tracking.
            </p>
          </div>
        </div>
      </section>

      <section className="home-final-cta">
        <div className="home-container">
          <div className="final-cta-card">
            <div>
              <h2>Your next local craving might already have a route.</h2>
              <p>Start with your RouteBite account. Ordering and route matching are being built around this experience.</p>
            </div>
            <Link className="final-cta-card__action" to={primaryPath}>{primaryLabel} →</Link>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container home-footer__inner">
          <BrandMark compact />
          <span>Built around local food, real streets and useful routes.</span>
          <span className={`system-dot ${connected ? 'is-online' : ''}`}>
            {health.loading ? 'Checking system' : connected ? 'RouteBite system online' : 'Development system unavailable'}
          </span>
        </div>
      </footer>
    </main>
  );
}
