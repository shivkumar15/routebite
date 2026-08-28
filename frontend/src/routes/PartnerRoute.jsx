import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import { socket } from '../socket/socket.js';

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      }),
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      },
    );
  });
}

export default function PartnerRoute({ children }) {
  const { user, partner, loading } = useAuth();
  const [offerCount, setOfferCount] = useState(0);

  const approved = Boolean(
    user &&
      user.role !== 'ADMIN' &&
      partner.exists &&
      partner.verificationStatus === 'APPROVED',
  );

  useEffect(() => {
    if (!approved) return undefined;
    let active = true;

    async function refreshOffers() {
      try {
        const { data } = await api.get('/partner/offers');
        if (active) setOfferCount(data.data.offers.length);
      } catch {
        if (active) setOfferCount(0);
      }
    }

    async function keepAvailableLocationFresh() {
      try {
        const { data } = await api.get('/partner/operational-state');
        if (data.data.partner.availabilityStatus !== 'AVAILABLE_NOW') return;
        const location = await getBrowserLocation();
        await api.put('/partner/location', location);
      } catch {
        // Best-effort browser heartbeat. Matching also has a short grace window
        // because browsers can throttle background tabs.
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        keepAvailableLocationFresh();
        refreshOffers();
      }
    }

    function refreshWhenFocused() {
      keepAvailableLocationFresh();
      refreshOffers();
    }

    const handleOfferChange = () => refreshOffers();
    socket.connect();
    socket.on('offer:new', handleOfferChange);
    socket.on('offer:expired', handleOfferChange);
    socket.on('offer:cancelled', handleOfferChange);
    socket.on('offer:accepted', handleOfferChange);

    refreshOffers();
    keepAvailableLocationFresh();

    const locationTimer = window.setInterval(keepAvailableLocationFresh, 15000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenFocused);
    window.addEventListener('online', refreshWhenFocused);

    return () => {
      active = false;
      window.clearInterval(locationTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenFocused);
      window.removeEventListener('online', refreshWhenFocused);
      socket.off('offer:new', handleOfferChange);
      socket.off('offer:expired', handleOfferChange);
      socket.off('offer:cancelled', handleOfferChange);
      socket.off('offer:accepted', handleOfferChange);
      socket.disconnect();
    };
  }, [approved]);

  if (loading) {
    return <main className="app-shell"><p>Checking partner access…</p></main>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/account" replace />;
  if (!partner.exists || partner.verificationStatus !== 'APPROVED') {
    return <Navigate to="/account" replace />;
  }

  return (
    <>
      <Link className={`partner-offer-shortcut ${offerCount > 0 ? 'has-offers' : ''}`} to="/partner/offers">
        Delivery offers{offerCount > 0 ? ` · ${offerCount}` : ''}
      </Link>
      {children}
    </>
  );
}
