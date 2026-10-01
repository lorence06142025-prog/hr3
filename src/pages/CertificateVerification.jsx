import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle, XCircle, AlertTriangle, Link as LinkIcon, X } from 'lucide-react'
import QRCodeImage from '../components/QRCodeImage'
import { api } from '../lib/api'

const formatDate = (val) => (val ? new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A')

export default function CertificateVerification() {
  const { verificationCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showCertificateView, setShowCertificateView] = useState(false)

  useEffect(() => {
    if (!verificationCode) {
      setLoading(false)
      setError('No verification code provided.')
      return
    }
    setLoading(true)
    setError(null)
    api.verifyCertificate(verificationCode)
      .then(res => {
        setResult(res)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Unable to connect to verification server.')
        setLoading(false)
      })
  }, [verificationCode])

  const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, '')
  const verifyUrl = `${publicAppUrl}/verify/certificate/${verificationCode}`

  const handleDownloadPdf = () => {
    const backendUrl = import.meta.env.VITE_API_URL || ''
    window.open(`${backendUrl}/api/certificates/verify/${verificationCode}/pdf?print=true`, '_blank')
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verifyUrl)
    alert('Verification link copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="verify-page-container">
        <div className="verify-card loading-state">
          <div className="verify-spinner"></div>
          <h2>Verifying certificate...</h2>
          <p>Checking PerDevSys official database records</p>
        </div>
      </div>
    )
  }

  if (error || (!loading && !result) || (result && result.valid === false && !result.certificate)) {
    return (
      <div className="verify-page-container">
        <div className="verify-card invalid-state">
          <div className="verify-badge invalid">
            <X className="w-5 h-5" />
            <span>Certificate Not Found</span>
          </div>
          <h1>Invalid Certificate Code</h1>
          <p className="verify-description">
            {error || result?.message || 'This certificate could not be verified.'}
          </p>
          <div className="verify-code-box">
            Code: <code>{verificationCode}</code>
          </div>
          <div className="verify-footer-text">
            Please ensure you have scanned or entered a valid PerDevSys verification URL.
          </div>
        </div>
      </div>
    )
  }

  const cert = result.certificate || {}
  const isValid = result.valid === true && cert.status === 'valid'
  const isRevoked = result.status === 'revoked' || cert.status === 'revoked'
  const isExpired = result.status === 'expired' || cert.status === 'expired'

  return (
    <div className="verify-page-container">
      <div className="verify-header-brand">
        <span className="brand-seal">PDS</span>
        <div>
          <h2>PerDevSys</h2>
          <small>Official Certificate Verification Portal</small>
        </div>
      </div>

      <div className={`verify-card ${isValid ? 'valid-state' : isRevoked ? 'revoked-state' : isExpired ? 'expired-state' : 'invalid-state'}`}>
        {/* BADGES */}
        {isValid && (
          <div className="verify-badge valid">
            <CheckCircle className="w-5 h-5" />
            <span>Certificate Verified</span>
          </div>
        )}
        {isRevoked && (
          <div className="verify-badge revoked">
            <XCircle className="w-5 h-5" />
            <span>Certificate Revoked</span>
          </div>
        )}
        {isExpired && (
          <div className="verify-badge expired">
            <AlertTriangle className="w-5 h-5" />
            <span>Certificate Expired</span>
          </div>
        )}

        <div className="verify-main-details">
          <span className="cert-type-eyebrow">{cert.certificateType || 'Official Certificate'}</span>
          <h1 className="cert-title">{cert.title || 'Certificate of Excellence'}</h1>
          {cert.subtitle && <p className="cert-subtitle">{cert.subtitle}</p>}

          <div className="cert-recipient-block">
            <small>This certificate is awarded to</small>
            <h2 className="recipient-name">{cert.recipientName}</h2>
          </div>

          <div className="cert-details-grid">
            <div className="detail-item">
              <span className="detail-label">Certificate Number</span>
              <span className="detail-value mono">{cert.certificateNumber}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <span className={`detail-value status-tag ${cert.status}`}>
                {cert.status ? cert.status.toUpperCase() : 'UNKNOWN'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Issued Date</span>
              <span className="detail-value">{formatDate(cert.issuedDate)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Expiry Date</span>
              <span className="detail-value">{cert.expiryDate ? formatDate(cert.expiryDate) : 'Does not expire'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Issuing Organization</span>
              <span className="detail-value">{cert.issuer || 'PerDevSys Hospitality'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Authorized Signatory</span>
              <span className="detail-value">{cert.signatory}{cert.signatoryPosition ? ` (${cert.signatoryPosition})` : ''}</span>
            </div>
            {isRevoked && cert.revokedReason && (
              <div className="detail-item full-width revoked-notice-box">
                <span className="detail-label">Revocation Reason</span>
                <span className="detail-value">{cert.revokedReason}</span>
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="verify-actions">
            <button
              className="verify-btn primary"
              onClick={() => setShowCertificateView(v => !v)}
            >
              {showCertificateView ? 'Hide Certificate' : 'View Certificate'}
            </button>
            <button
              className="verify-btn secondary"
              onClick={handleDownloadPdf}
            >
              View / Download PDF
            </button>
            <button
              className="verify-btn outline flex items-center justify-center gap-1.5"
              onClick={handleCopyLink}
              title="Copy verification link"
            >
              <LinkIcon className="w-4 h-4 inline" />
              <span>Copy Verification Link</span>
            </button>
          </div>
        </div>

        {/* EMBEDDED CERTIFICATE COPY VIEW */}
        {showCertificateView && (
          <div className="verify-certificate-preview-wrapper">
            <div className="certificate-preview standalone">
              {cert.logoUrl && <img className="certificate-logo" src={cert.logoUrl} alt="Organization Logo" />}
              <div className="certificate-seal">PDS</div>
              <small>{cert.issuer || 'PerDevSys Hospitality'}</small>
              <h2>{cert.title || 'Certificate of Excellence'}</h2>
              {cert.subtitle && <em>{cert.subtitle}</em>}
              <p>This certificate is presented to</p>
              <h1>{cert.recipientName}</h1>
              <div className="certificate-rule" />
              <p className="certificate-body">{cert.achievement || 'For outstanding achievement and professional growth.'}</p>
              <div className="certificate-foot">
                <span>Date awarded<br /><b>{formatDate(cert.issuedDate)}</b></span>
                <div className="certificate-qr-container">
                  <QRCodeImage value={verifyUrl} size={90} />
                  <small style={{ fontSize: 7, color: '#111827', marginTop: 2, display: 'block' }}>VERIFY ONLINE</small>
                </div>
                <span>
                  {cert.signatureUrl && <img className="certificate-signature" src={cert.signatureUrl} alt="Authorized signature" />}
                  Authorized by<br /><b>{cert.signatory || 'Authorized Signatory'}</b>
                </span>
              </div>
              <footer>Certificate No. {cert.certificateNumber} · Code: {cert.verificationCode}</footer>
            </div>
          </div>
        )}

        {/* FOOTER VERIFICATION SECURE SEAL */}
        <div className="verify-footer-seal">
          <QRCodeImage value={verifyUrl} size={90} />
          <div>
            <strong>Authentic PerDevSys Certificate</strong>
            <p>Verification Code: <code>{cert.verificationCode || verificationCode}</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}
