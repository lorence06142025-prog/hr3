import { useEffect, useRef, useState } from 'react'

export default function SearchableSelector({ label = 'Employee', options, value, onChange }) {
  const [query, setQuery] = useState(value?.label || '')
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const matches = options.filter((option) => `${option.label} ${option.description || ''}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const close = (event) => { if (!box.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const choose = (option) => { onChange(option); setQuery(option.label); setOpen(false) }
  return <div className="employee-picker" ref={box}>
    <label>{label}</label>
    <input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} placeholder="Search by employee name" aria-label={`Search ${label.toLowerCase()}`} />
    {open && <div className="employee-picker-results">
      {matches.length ? matches.map((option) => <button key={option.value} type="button" onClick={() => choose(option)}><b>{option.label}</b>{option.description && <small>{option.description}</small>}</button>) : <p>No employees found.</p>}
    </div>}
  </div>
}
