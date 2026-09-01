import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';

const PARTNER_IMAGE_UPLOAD_TIMEOUT_MS = 60000;

async function uploadAsset(file, purpose) {
  const formData = new FormData();
  formData.append('purpose', purpose);
  formData.append('file', file);

  try {
    const { data } = await api.post('/uploads', formData, {
      timeout: PARTNER_IMAGE_UPLOAD_TIMEOUT_MS,
    });
    return data.data.asset.id;
  } catch (error) {
    error.routeBiteStep = 'image-upload';
    throw error;
  }
}

function applicationErrorMessage(error) {
  const backendMessage = error.response?.data?.error?.message;
  if (backendMessage) return backendMessage;

  if (error.code === 'ECONNABORTED' && error.routeBiteStep === 'image-upload') {
    return 'The image upload took too long. Check your internet connection and use images smaller than 5 MB.';
  }

  if (!error.response && error.routeBiteStep === 'image-upload') {
    return 'The images could not reach RouteBite storage. Check that the backend is running and your internet connection is stable.';
  }

  if (!error.response) {
    return 'RouteBite could not reach the API. Check that the backend is running, then try again.';
  }

  return 'Partner application failed. Please try again.';
}

export default function PartnerApplyPage() {
  const { user, partner, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ collegeName: '', enrollmentNumber: '' });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [collegeId, setCollegeId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!profilePhoto || !collegeId) {
      setError('Choose both your profile photo and college ID image.');
      return;
    }

    setSubmitting(true);

    try {
      const [profilePhotoAssetId, collegeIdAssetId] = await Promise.all([
        uploadAsset(profilePhoto, 'PROFILE_PHOTO'),
        uploadAsset(collegeId, 'COLLEGE_ID'),
      ]);

      await api.post('/partner/apply', {
        ...form,
        profilePhotoAssetId,
        collegeIdAssetId,
      });

      await refreshSession();
      navigate('/account', { replace: true });
    } catch (requestError) {
      setError(applicationErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (user.role === 'ADMIN') {
    return (
      <main className="app-shell">
        <section className="account-card">
          <p className="eyebrow">RouteBite admin</p>
          <h1>Partner onboarding is unavailable</h1>
          <p className="form-intro">
            Administrator accounts are reserved for RouteBite operations and cannot participate as delivery partners.
          </p>
          <Link className="secondary-link" to="/account">Back to account</Link>
        </section>
      </main>
    );
  }

  if (partner.exists) {
    return (
      <main className="app-shell">
        <section className="account-card">
          <p className="eyebrow">Partner application</p>
          <h1>Application already submitted</h1>
          <p className="form-intro">Current status: {partner.verificationStatus}</p>
          <Link className="secondary-link" to="/account">Back to account</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card partner-application-card">
        <Link className="brand-link" to="/account">← RouteBite account</Link>
        <p className="eyebrow">Become a delivery partner</p>
        <h1>Verify your campus identity</h1>
        <p className="form-intro">
          We use a profile photo and college ID image only for partner review. Do not upload Aadhaar.
          {user.emailVerified ? ' Your email is already verified.' : ' Verify your email from your account before admin approval.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            College name
            <input
              value={form.collegeName}
              onChange={(event) => setForm({ ...form, collegeName: event.target.value })}
              minLength="2"
              maxLength="120"
              required
            />
          </label>

          <label>
            Enrollment number
            <input
              value={form.enrollmentNumber}
              onChange={(event) => setForm({ ...form, enrollmentNumber: event.target.value })}
              minLength="2"
              maxLength="80"
              required
            />
          </label>

          <label>
            Profile photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setProfilePhoto(event.target.files?.[0] ?? null)}
              required
            />
          </label>

          <label>
            College ID image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setCollegeId(event.target.files?.[0] ?? null)}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      </section>
    </main>
  );
}
