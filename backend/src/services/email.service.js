import { Resend } from 'resend';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function verificationEmailHtml(otp) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#241f1d">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#e95a3d">ROUTEBITE</p>
      <h1 style="margin:0 0 16px;font-size:28px;color:#4b2030">Verify your email</h1>
      <p style="line-height:1.6;color:#746b65">Use this 6-digit code to verify your RouteBite account. It expires in 5 minutes.</p>
      <div style="margin:24px 0;padding:18px 22px;border-radius:12px;background:#fff7ef;font-size:32px;font-weight:800;letter-spacing:.22em;color:#4b2030;text-align:center">${otp}</div>
      <p style="font-size:13px;line-height:1.6;color:#746b65">If you did not request this code, you can ignore this email.</p>
    </div>
  `;
}

function logDevelopmentOtp(email, otp, reason = null) {
  if (reason) {
    console.warn(`Resend unavailable in development: ${reason}`);
  }

  console.log(`RouteBite development email OTP for ${maskEmail(email)}: ${otp}`);
}

export async function sendEmailVerificationOtp({ email, otp }) {
  if (!env.resend.apiKey) {
    if (env.nodeEnv === 'production') {
      throw new AppError('Email delivery is not configured.', {
        statusCode: 503,
        code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      });
    }

    logDevelopmentOtp(email, otp, 'RESEND_API_KEY is not configured');
    return { delivery: 'console' };
  }

  const resend = new Resend(env.resend.apiKey);

  try {
    const { error } = await resend.emails.send({
      from: env.resend.fromEmail,
      to: [email],
      subject: 'Your RouteBite verification code',
      text: `Your RouteBite verification code is ${otp}. It expires in 5 minutes.`,
      html: verificationEmailHtml(otp),
    });

    if (error) {
      const providerMessage = error.message ?? 'Unknown Resend error';

      console.error('Resend email delivery failed', {
        name: error.name,
        message: providerMessage,
      });

      if (env.nodeEnv !== 'production') {
        logDevelopmentOtp(email, otp, providerMessage);
        return { delivery: 'console' };
      }

      throw new AppError('We could not send the verification email. Please try again.', {
        statusCode: 502,
        code: 'EMAIL_PROVIDER_FAILED',
      });
    }

    return { delivery: 'email' };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const providerMessage = error?.message ?? 'Unknown Resend request error';

    console.error('Resend email request failed', {
      name: error?.name,
      message: providerMessage,
    });

    if (env.nodeEnv !== 'production') {
      logDevelopmentOtp(email, otp, providerMessage);
      return { delivery: 'console' };
    }

    throw new AppError('We could not send the verification email. Please try again.', {
      statusCode: 502,
      code: 'EMAIL_PROVIDER_FAILED',
    });
  }
}
