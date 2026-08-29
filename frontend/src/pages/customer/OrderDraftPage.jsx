import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios.js';
import LocationPicker from '../../components/location/LocationPicker.jsx';
import { isCompleteLocation, locationToApiPayload } from '../../utils/location.js';

const EMPTY_FORM = {
  vendorDisplayName: '',
  requestedItems: '',
  pickupInstructions: '',
  pickup: { label: '', latitude: '', longitude: '' },
  drop: { label: '', latitude: '', longitude: '' },
  deliveryType: 'ASAP',
  deliveryWindowStart: '',
  deliveryWindowEnd: '',
  estimatedFoodCostRupees: '',
};

function rupeesToPaise(value) {
  const clean = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [rupees, paise = ''] = clean.split('.');
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
}

function paiseToRupees(value) {
  return (Number(value) / 100).toFixed(2);
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function OrderDraftPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(orderId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;

    let active = true;
    api.get(`/orders/${orderId}`)
      .then(({ data }) => {
        if (!active) return;
        const order = data.data.order;
        setForm({
          vendorDisplayName: order.vendorDisplayName,
          requestedItems: order.requestedItems,
          pickupInstructions: order.pickupInstructions ?? '',
          pickup: {
            label: order.pickup.label,
            latitude: String(order.pickup.latitude),
            longitude: String(order.pickup.longitude),
          },
          drop: {
            label: order.drop.label,
            latitude: String(order.drop.latitude),
            longitude: String(order.drop.longitude),
          },
          deliveryType: order.deliveryType,
          deliveryWindowStart: order.deliveryType === 'SCHEDULED' ? toDateTimeLocal(order.deliveryWindowStart) : '',
          deliveryWindowEnd: order.deliveryType === 'SCHEDULED' ? toDateTimeLocal(order.deliveryWindowEnd) : '',
          estimatedFoodCostRupees: paiseToRupees(order.estimatedFoodCostPaise),
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error?.message ?? 'Could not load this draft.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [editing, orderId]);

  function setLocation(kind, location) {
    setForm((current) => ({
      ...current,
      [kind]: location,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const estimatedFoodCostPaise = rupeesToPaise(form.estimatedFoodCostRupees);
    if (estimatedFoodCostPaise === null) {
      setError('Enter the estimated food cost with at most two decimal places.');
      return;
    }

    if (!isCompleteLocation(form.pickup) || !isCompleteLocation(form.drop)) {
      setError('Select both pickup and delivery locations, including a clear location name.');
      return;
    }

    const payload = {
      vendorDisplayName: form.vendorDisplayName,
      requestedItems: form.requestedItems,
      pickupInstructions: form.pickupInstructions,
      pickup: locationToApiPayload(form.pickup),
      drop: locationToApiPayload(form.drop),
      deliveryType: form.deliveryType,
      estimatedFoodCostPaise,
    };

    if (form.deliveryType === 'SCHEDULED') {
      payload.deliveryWindowStart = new Date(form.deliveryWindowStart).toISOString();
      payload.deliveryWindowEnd = new Date(form.deliveryWindowEnd).toISOString();
    }

    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/orders/${orderId}`, payload);
      } else {
        await api.post('/orders', payload);
      }
      navigate('/orders', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? 'Could not save the food request.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="app-shell"><p>Loading draft…</p></main>;
  }

  return (
    <main className="order-shell">
      <section className="order-form-card">
        <div className="order-page-heading">
          <div>
            <p className="eyebrow">{editing ? 'Edit food request' : 'New food request'}</p>
            <h1>{editing ? 'Refine your draft.' : 'What are you craving?'}</h1>
            <p className="form-intro">The food place does not need to be registered on RouteBite. Tell us where it is and what you want.</p>
          </div>
          <Link className="secondary-link" to="/orders">My requests</Link>
        </div>

        <form className="order-form" onSubmit={handleSubmit}>
          <label>
            Local food place
            <input value={form.vendorDisplayName} onChange={(e) => setForm({ ...form, vendorDisplayName: e.target.value })} placeholder="e.g. Sharma Chaat, Civil Lines" required />
          </label>

          <label>
            What should the partner buy?
            <textarea value={form.requestedItems} onChange={(e) => setForm({ ...form, requestedItems: e.target.value })} placeholder="2 pav bhaji, extra butter, no onion" rows="4" required />
          </label>

          <label>
            Pickup instructions <span className="optional-text">optional</span>
            <textarea value={form.pickupInstructions} onChange={(e) => setForm({ ...form, pickupInstructions: e.target.value })} placeholder="Red cart opposite Hanuman Mandir" rows="2" />
          </label>

          <LocationPicker
            label="Pickup point"
            description="Search for the food place or a nearby landmark, then adjust the pin to the exact stall or shop."
            purpose="pickup"
            value={form.pickup}
            onChange={(location) => setLocation('pickup', location)}
          />

          <LocationPicker
            label="Deliver to"
            description="Choose where the partner should hand over the food."
            purpose="delivery destination"
            value={form.drop}
            onChange={(location) => setLocation('drop', location)}
          />

          <fieldset className="delivery-choice">
            <legend>When do you need it?</legend>
            <label className="choice-row">
              <input type="radio" name="deliveryType" value="ASAP" checked={form.deliveryType === 'ASAP'} onChange={(e) => setForm({ ...form, deliveryType: e.target.value })} />
              <span><strong>ASAP</strong><small>Target delivery within about 45 minutes.</small></span>
            </label>
            <label className="choice-row">
              <input type="radio" name="deliveryType" value="SCHEDULED" checked={form.deliveryType === 'SCHEDULED'} onChange={(e) => setForm({ ...form, deliveryType: e.target.value })} />
              <span><strong>Schedule</strong><small>Choose a future delivery window.</small></span>
            </label>
          </fieldset>

          {form.deliveryType === 'SCHEDULED' ? (
            <div className="coordinate-grid">
              <label>
                Window starts
                <input type="datetime-local" value={form.deliveryWindowStart} onChange={(e) => setForm({ ...form, deliveryWindowStart: e.target.value })} required />
              </label>
              <label>
                Window ends
                <input type="datetime-local" value={form.deliveryWindowEnd} onChange={(e) => setForm({ ...form, deliveryWindowEnd: e.target.value })} required />
              </label>
            </div>
          ) : null}

          <label>
            Estimated food cost (₹)
            <input inputMode="decimal" value={form.estimatedFoodCostRupees} onChange={(e) => setForm({ ...form, estimatedFoodCostRupees: e.target.value })} placeholder="200.00" required />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save draft' : 'Create food request'}
          </button>
        </form>
      </section>
    </main>
  );
}
