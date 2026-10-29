import { HttpException, Logger } from '@nestjs/common';

const logger = new Logger('EmailService');

/**
 * Unitpost transactional email (https://www.unitpost.com/api/v1/email)
 * POST https://www.unitpost.com/api/v1/email
 * Auth: Authorization: Bearer UNITPOST_API_KEY
 *
 * Env:
 *   UNITPOST_API_KEY     — required (Sending-scoped key)
 *   UNITPOST_FROM        — required, on a verified domain, e.g. "BuildHire <otp@yourdomain.com>"
 *   UNITPOST_TEMPLATE_ID — optional; published template with an {{otp}} variable.
 *                          Empty = inline HTML/text fallback below.
 *   EMAIL_DRY_RUN=true   — log OTP instead of sending (dev testing)
 */
export async function sendOtpEmail(
  to: string,
  otp: string,
  options?: { name?: string | null; expiryMinutes?: number },
): Promise<{
  success: boolean;
  dryRun: boolean;
  provider?: string;
}> {
  const email = String(to ?? '').trim().toLowerCase();
  const apiKey = (process.env.UNITPOST_API_KEY ?? '').trim();
  const from = (process.env.UNITPOST_FROM ?? '').trim();
  const templateId = (process.env.UNITPOST_TEMPLATE_ID ?? '').trim();
  const expiryMinutes = options?.expiryMinutes ?? 10;
  const name = (options?.name ?? '').trim() || 'there';

  if (!apiKey || process.env.EMAIL_DRY_RUN === 'true') {
    logger.warn(`[EMAIL-DRY-RUN] OTP ${otp} for ${email}`);
    return { success: true, dryRun: true };
  }

  const body: Record<string, unknown> = {
    from,
    to: email,
    subject: 'Your password reset OTP',
    open_tracking: false,
    click_tracking: false,
  };
  if (templateId) {
    // Publish templates with only these variables: {{name}}, {{otp}},
    // {{expiry_minutes}} — Unitpost 422s if any template variable is unsupplied.
    // Unitpost reserves: first_name, last_name, email, unsubscribe_url
    // Do NOT pass `email` in template.variables — it's resolved automatically.
    body.template = {
      id: templateId,
      variables: { name, otp, expiry_minutes: String(expiryMinutes) },
    };
  } else {
    body.text = `Your OTP is ${otp}. It expires in ${expiryMinutes} minutes. If you did not request this, ignore this email.`;
    body.html = `<p>Hi ${name},</p><p>Your OTP is:</p><h2 style="letter-spacing:4px">${otp}</h2><p>It expires in ${expiryMinutes} minutes. If you did not request this, ignore this email.</p>`;
  }

  const res = await fetch('https://www.unitpost.com/api/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'buildhire-backend/1.0',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const data: any = await res.json().catch(() => ({}));
  logger.log(`Unitpost email response: ${res.status} ${JSON.stringify(data)}`);

  if (res.ok && data?.id) {
    return { success: true, dryRun: false, provider: 'unitpost' };
  }

  // Surface provider throttling with its real status.
  if (res.status === 429) {
    throw new HttpException(
      data?.message || 'Too many requests. Please wait before retrying.',
      429,
    );
  }
  throw new Error(
    `Unitpost rejected email (${res.status}): ${JSON.stringify(data)}`,
  );
}
