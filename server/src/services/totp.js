import crypto from 'node:crypto'
import QRCode from 'qrcode'
import {
  generateSecret as otplibGenerateSecret,
  generateURI as otplibGenerateURI,
  verifySync as otplibVerifySync,
} from 'otplib'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32ToBuffer(base32) {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i])
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

// Fallback legacy calculation for backwards compatibility with any 20-char secrets
export function generateTOTPLegacy(secret, timeStep = 30, time = Date.now()) {
  const counter = Math.floor(time / 1000 / timeStep)
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter))

  const key = base32ToBuffer(secret)
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest()

  const offset = hmac[hmac.length - 1] & 0xf
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const otp = (binary % 1000000).toString().padStart(6, '0')
  return otp
}

/**
 * Generate standard RFC-compliant 32-character Base32 secret (160 bits)
 * Fully compatible with Google Authenticator and Microsoft Authenticator.
 */
export function generateSecret() {
  return otplibGenerateSecret()
}

/**
 * Verify TOTP code from Google Authenticator
 * Supports +/- 60 seconds time drift and legacy fallbacks.
 */
export function verifyTOTP(token, secret, window = 2, timeStep = 30) {
  if (!token || typeof token !== 'string') return false
  const cleanToken = token.trim().replace(/\s+/g, '')
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false
  if (!secret) return false

  // 1. Standard RFC 6238 check via otplib with 60-second drift tolerance
  try {
    const result = otplibVerifySync({
      secret,
      token: cleanToken,
      epochTolerance: 60,
    })
    if (result && result.valid) return true
  } catch {
    // If secret has legacy non-standard padding, continue to legacy check
  }

  // 2. Legacy check with +/- 2 window (60s drift)
  const now = Date.now()
  for (let i = -window; i <= window; i++) {
    const expected = generateTOTPLegacy(secret, timeStep, now + i * timeStep * 1000)
    if (cleanToken === expected) return true
  }

  return false
}

export function getOtpAuthURI(email, secret, issuer = 'Priority Handling Services, Inc.') {
  try {
    return otplibGenerateURI({
      secret,
      label: email,
      issuer,
    })
  } catch {
    const encodedIssuer = encodeURIComponent(issuer)
    const encodedEmail = encodeURIComponent(email)
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
  }
}

export async function generateQRCodeDataUrl(otpAuthURI) {
  return QRCode.toDataURL(otpAuthURI, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: {
      dark: '#1e1b2e',
      light: '#ffffff',
    },
  })
}

export function generateBackupCodes(count = 8) {
  const codes = []
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push(code.slice(0, 4) + '-' + code.slice(4, 8))
  }
  return codes
}
