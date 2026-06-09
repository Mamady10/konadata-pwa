import { createHash, createHmac, randomInt } from 'crypto';

function getHmacSecret(): string {
  return (
    process.env.SURVEY_SECURITY_HMAC_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    'kona-survey-dev-secret-change-me'
  );
}

export function hashSurveyValue(kind: string, value: string): string {
  return createHmac('sha256', getHmacSecret()).update(`${kind}:${value}`).digest('hex');
}

export function hashPhoneE164(phone: string): string {
  return hashSurveyValue('phone', phone);
}

export function hashClientIp(ip: string): string {
  return hashSurveyValue('ip', ip);
}

export function hashDeviceFingerprint(surveyId: string, clientFingerprint: string): string {
  return createHmac('sha256', getHmacSecret())
    .update(`device:${surveyId}:${clientFingerprint}`)
    .digest('hex');
}

export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
