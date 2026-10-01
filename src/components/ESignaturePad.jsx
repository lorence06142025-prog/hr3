import React, { useRef, useEffect, useState } from 'react'
import SignaturePad from 'signature_pad'
import { Eraser, RotateCcw, PenTool, Check, Upload } from 'lucide-react'

export default function ESignaturePad({ value, onChange, onFileNameChange, fileName }) {
  const [mode, setMode] = useState('draw') // 'draw' | 'upload'
  const [penColor, setPenColor] = useState('#0f172a')
  const [hasSignature, setHasSignature] = useState(!!value)
  const canvasRef = useRef(null)
  const padRef = useRef(null)

  // Keep latest callbacks in refs so we NEVER recreate SignaturePad on parent re-renders
  const onChangeRef = useRef(onChange)
  const onFileNameChangeRef = useRef(onFileNameChange)
  useEffect(() => {
    onChangeRef.current = onChange
    onFileNameChangeRef.current = onFileNameChange
  }, [onChange, onFileNameChange])

  // Resize canvas without losing existing drawn strokes
  const resizeCanvas = () => {
    const canvas = canvasRef.current
    const pad = padRef.current
    if (!canvas) return

    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    // Save existing strokes if any
    const data = pad ? pad.toData() : null

    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)

    if (pad && data && data.length > 0) {
      pad.fromData(data)
    }
  }

  // Initialize SignaturePad only when switching to 'draw' mode
  useEffect(() => {
    if (mode !== 'draw') return

    const canvas = canvasRef.current
    if (!canvas) return

    // Initialize dimensions
    resizeCanvas()

    // Create single persistent SignaturePad instance
    const pad = new SignaturePad(canvas, {
      penColor: penColor,
      backgroundColor: 'rgba(255, 255, 255, 0)',
      minWidth: 1.2,
      maxWidth: 3.0,
      velocityFilterWeight: 0.7,
    })

    const handleStrokeEnd = () => {
      if (!pad.isEmpty()) {
        const dataUrl = pad.toDataURL('image/png')
        setHasSignature(true)
        onChangeRef.current?.(dataUrl)
        onFileNameChangeRef.current?.('Real-time E-Signature (drawn)')
      } else {
        setHasSignature(false)
        onChangeRef.current?.('')
        onFileNameChangeRef.current?.('')
      }
    }

    pad.addEventListener('endStroke', handleStrokeEnd)
    padRef.current = pad

    const handleResize = () => {
      resizeCanvas()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      pad.off()
      padRef.current = null
    }
  }, [mode]) // ONLY run when mode changes, NEVER on stroke or onChange!

  // Change pen color dynamically without re-creating the pad
  const handleColorChange = (color) => {
    setPenColor(color)
    if (padRef.current) {
      padRef.current.penColor = color
    }
  }

  // Clear signature
  const handleClear = (e) => {
    e?.preventDefault?.()
    if (padRef.current) {
      padRef.current.clear()
      setHasSignature(false)
      onChangeRef.current?.('')
      onFileNameChangeRef.current?.('')
    }
  }

  // Undo last stroke
  const handleUndo = (e) => {
    e?.preventDefault?.()
    if (padRef.current) {
      const data = padRef.current.toData()
      if (data && data.length > 0) {
        data.pop()
        padRef.current.fromData(data)
        if (padRef.current.isEmpty()) {
          setHasSignature(false)
          onChangeRef.current?.('')
          onFileNameChangeRef.current?.('')
        } else {
          const dataUrl = padRef.current.toDataURL('image/png')
          setHasSignature(true)
          onChangeRef.current?.(dataUrl)
        }
      }
    }
  }

  // Handle image file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      setHasSignature(true)
      onChangeRef.current?.(uploadEvent.target.result)
      onFileNameChangeRef.current?.(file.name)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="esignature-container">
      {/* Mode switcher tabs */}
      <div className="esignature-tabs">
        <button
          type="button"
          className={`esign-tab-btn ${mode === 'draw' ? 'active' : ''}`}
          onClick={() => setMode('draw')}
        >
          <PenTool size={13} />
          <span>Draw Real-time Signature</span>
        </button>
        <button
          type="button"
          className={`esign-tab-btn ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => setMode('upload')}
        >
          <Upload size={13} />
          <span>Upload Image</span>
        </button>
      </div>

      {mode === 'draw' ? (
        <div className="esignature-pad-wrapper">
          {/* Pad Toolbar: Color Picker & Action Buttons */}
          <div className="esignature-pad-toolbar">
            <div className="esign-colors">
              <span className="esign-tool-label">Ink:</span>
              <button
                type="button"
                className={`esign-color-dot ${penColor === '#0f172a' ? 'active' : ''}`}
                style={{ backgroundColor: '#0f172a' }}
                onClick={() => handleColorChange('#0f172a')}
                title="Black Ink"
              />
              <button
                type="button"
                className={`esign-color-dot ${penColor === '#1d4ed8' ? 'active' : ''}`}
                style={{ backgroundColor: '#1d4ed8' }}
                onClick={() => handleColorChange('#1d4ed8')}
                title="Official Navy Blue Ink"
              />
              <button
                type="button"
                className={`esign-color-dot ${penColor === '#111827' ? 'active' : ''}`}
                style={{ backgroundColor: '#111827' }}
                onClick={() => handleColorChange('#111827')}
                title="Royal Purple Ink"
              />
            </div>

            <div className="esign-actions">
              <button
                type="button"
                className="esign-action-btn"
                onClick={handleUndo}
                title="Undo last stroke"
              >
                <RotateCcw size={12} />
                <span>Undo</span>
              </button>
              <button
                type="button"
                className="esign-action-btn danger"
                onClick={handleClear}
                title="Clear canvas"
              >
                <Eraser size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Canvas drawing area */}
          <div className="esignature-canvas-box">
            <canvas
              ref={canvasRef}
              className="esignature-canvas"
            />
            <div className="esignature-guideline">
              <span>Sign above the line</span>
            </div>
          </div>

          {/* Status info */}
          <div className="esignature-status-bar">
            {value ? (
              <span className="esign-status-text success">
                <Check size={12} /> Live signature captured
              </span>
            ) : (
              <span className="esign-status-text">
                Use your mouse, trackpad, finger, or stylus to draw
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Upload Mode */
        <div className="esignature-upload-wrapper">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="esign-file-input"
          />
          <small className="esign-upload-hint">
            {fileName || 'PNG, JPG, SVG, or WEBP with transparent background recommended'}
          </small>
        </div>
      )}

      {/* Live Signature preview on template */}
      {value && (
        <div className="esignature-live-preview">
          <span className="preview-label">Live Certificate Signature:</span>
          <div className="preview-img-container">
            <img src={value} alt="Authorized Signature" className="preview-sig-img" />
          </div>
        </div>
      )}
    </div>
  )
}
