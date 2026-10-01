import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// In-memory cache for generated QR code data URLs to avoid redundant canvas computations
const qrCache = new Map()

export default function QRCodeImage({ value, size = 70, className = '' }) {
  const cacheKey = `${value}_${size}`
  const [dataUrl, setDataUrl] = useState(() => qrCache.get(cacheKey) || '')

  useEffect(() => {
    if (!value) return
    if (qrCache.has(cacheKey)) {
      setDataUrl(qrCache.get(cacheKey))
      return
    }

    let active = true
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      color: {
        dark: '#282631',
        light: '#ffffff'
      }
    })
      .then(url => {
        qrCache.set(cacheKey, url)
        if (active) setDataUrl(url)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [value, size, cacheKey])

  if (!dataUrl) {
    return (
      <div
        className={`qr-placeholder ${className}`}
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          background: '#f4f2ff',
          borderRadius: 4,
          fontSize: 10,
          color: '#111827'
        }}
      >
        QR
      </div>
    )
  }

  return (
    <img
      src={dataUrl}
      alt="Certificate Verification QR Code"
      className={`qr-code-img ${className}`}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4 }}
    />
  )
}
