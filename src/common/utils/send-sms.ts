import { HttpException, Logger } from '@nestjs/common';

const logger = new Logger('SmsService');

export function normalizePhone(phone: unknown): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function isValidIndianPhone(phone: unknown): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

/**
 * PRIMARY: ApiTxt Unified OTP API (https://apitxt.com/developer/otp-api)
 * POST https://apitxt.com/api/sendOTP (form-urlencoded)
 * Params: authkey*, mobile*, otp*, channel (sms|whatsapp|voice), template_id (optional).
 * Success: { "status": "success", "message": ..., "data": { request_id, ... } }
 * channel is pinned to "sms" so OTPs never fall over to voice calls.
 *
 * Env:
 *   APITXT_AUTHKEY     — required, auth key from ApiTxt panel
 *   APITXT_TEMPLATE_ID — optional; empty = ApiTxt system default OTP config
 *   SMS_DRY_RUN=true   — log OTP instead of sending (dev testing without key)
 */
export async function sendOtpSms(phone: string, otp: string): Promise<{
  success: boolean;
  dryRun: boolean;
  provider?: string;
}> {
  const digits = normalizePhone(phone);
  const authkey = (process.env.APITXT_AUTHKEY ?? '').trim();

  if (!authkey || process.env.SMS_DRY_RUN === 'true') {
    logger.warn(`[SMS-DRY-RUN] OTP ${otp} for ${digits}`);
    return { success: true, dryRun: true };
  }

  const templateId = (process.env.APITXT_TEMPLATE_ID ?? '').trim();
  const params = new URLSearchParams({
    authkey,
    mobile: `91${digits}`,
    otp,
    channel: 'sms',
  });
  if (templateId) params.set('template_id', templateId);

  const res = await fetch('https://apitxt.com/api/sendOTP', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  });

  const data: any = await res.json().catch(() => ({}));
  logger.log(`ApiTxt SMS response: ${JSON.stringify(data)}`);

  if (String(data?.status ?? '').toLowerCase() === 'success') {
    return { success: true, dryRun: false, provider: 'apitxt' };
  }

  // Provider-side cooldown (e.g. "Please wait 15 seconds before requesting
  // another OTP for this number.") — surface as 429, not a generic 502.
  const msg = String(data?.message ?? '');
  if (Number(data?.code) === 429 || /wait \d+ second/i.test(msg)) {
    throw new HttpException(
      msg || 'Please wait before requesting another OTP',
      429,
    );
  }
  throw new Error(`ApiTxt rejected SMS: ${JSON.stringify(data)}`);
}
