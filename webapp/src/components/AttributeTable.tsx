import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchAttributes } from '@services/api'
import { useStore } from '@store/context'

type RawCategory = string | { id?: string; name?: string; slug?: string } | null | undefined
type RawAttr = {
  id: string
  name: string
  slug: string
  type?: string | null            // backend may send enum or uppercase text
  linkType?: 'direct' | 'inherited' | 'global' | string
  categories?: RawCategory[]      // may be objects
  productsInUse?: number | null
  createdAt?: string | null
  updatedAt?: string | null
}

type AttrRow = {
  id: string
  name: string
  slug: string
  type: string
  categories: string[]
  productsInUse: number | null
  createdAt: string | null
  updatedAt: string | null
}

const TYPE_LABELS: Record<string, string> = {
  TEXT: 'Short Text',
  SHORT_TEXT: 'Short Text',
  LONG_TEXT: 'Long Text',
  NUMBER: 'Number',
  DROPDOWN: 'Dropdown',
  MULTI_SELECT: 'Multi Select',
  URL: 'URL',
}

function toCategoryNames(val: unknown): string {
  if (!val) return '-'
  if (Array.isArray(val)) {
    const names = val
      .map(v => {
        if (typeof v === 'string') return v
        if (v && typeof v === 'object') {
          const o = v as { name?: string; slug?: string }
          return o.name || o.slug || null
        }
        return null
      })
      .filter(Boolean) as string[]
    return names.length ? names.join(', ') : '-'
  }
  if (typeof val === 'object') {
    const o = val as { name?: string; slug?: string }
    return o.name || o.slug || '-'
  }
  return String(val)
}

function fmt(dt?: string | null): string {
  if (!dt) return '-'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function AttributeTable() {
  const { state, dispatch } = useStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const masterRef = useRef<HTMLInputElement | null>(null)

useEffect(() => {
  const ac = new AbortController()
  dispatch({ type: 'SET_LOADING', payload: true })

  const linkTypesEff =
    state.selectedCategoryIds.length ? state.linkTypes : undefined

  fetchAttributes(
    {
      categoryIds: state.selectedCategoryIds.length
        ? state.selectedCategoryIds
        : undefined,
      linkTypes: linkTypesEff,      // only when categories are selected
      q: state.q || undefined,
      page: state.page,
      pageSize: state.pageSize,
      sort: 'name',
    },
    ac.signal
  )
    .then(({ items, total }) =>
      dispatch({ type: 'SET_ATTRIBUTES', payload: { items, total } })
    )
    .catch(err => {
      if (err?.name !== 'AbortError')
        dispatch({ type: 'SET_ERROR', payload: err?.message || 'Failed to load attributes' })
    })
    .finally(() => dispatch({ type: 'SET_LOADING', payload: false }))

  return () => ac.abort()
}, [
  state.selectedCategoryIds,
  state.linkTypes,
  state.q,
  state.page,
  state.pageSize,
  dispatch,
])



  const maxPage = useMemo(() => Math.max(1, Math.ceil(state.total / state.pageSize)), [state.total, state.pageSize])
  const next = () => { if (state.page < maxPage) dispatch({ type: 'SET_PAGINATION', payload: { page: state.page + 1 } }) }
  const prev = () => { if (state.page > 1) dispatch({ type: 'SET_PAGINATION', payload: { page: state.page - 1 } }) }

  const rows = state.attributes as AttrRow[]
  const allChecked = rows.length > 0 && rows.every(a => selectedIds.has(a.id))
  const someChecked = !allChecked && rows.some(a => selectedIds.has(a.id))
  useEffect(() => { if (masterRef.current) masterRef.current.indeterminate = someChecked }, [someChecked])

  const toggleAll = () => setSelectedIds(allChecked ? new Set() : new Set(rows.map(a => a.id)))
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  return (
    <div className="card">
      <div className="panel-title">
        <h3>Attributes</h3>
        <span className="badge">{state.total} total</span>
      </div>

      {state.loading && <div className="subtle">Loading…</div>}
      {state.error && <div style={{ color: 'crimson', marginBottom: 8 }}>{state.error}</div>}

      <div className="table-wrap">
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  ref={masterRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th>Attribute Name</th>
              <th>Product Category</th>
              <th>Products in use</th>
              <th>Type</th>
              <th>Created On</th>
              <th>Updated On</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    aria-label={`Select ${row.name}`}
                  />
                </td>

                <td>
                  <button className="linklike" title={row.slug} onClick={() => { /* navigate */ }}>
                    {row.name}
                  </button>
                </td>

                <td>{toCategoryNames(row.categories)}</td>


                <td>
                  {row.productsInUse === null || row.productsInUse === undefined
                    ? '-'
                    : row.productsInUse > 0
                      ? <button className="linklike" onClick={() => { /* open filtered products */ }}>{row.productsInUse}</button>
                      : 0}
                </td>

                <td>{row.type || '-'}</td>
                <td>{fmt(row.createdAt)}</td>
                <td>{fmt(row.updatedAt)}</td>

                <td>
                  <button className="btn-ghost" onClick={() => { /* open menu */ }}>
                    More
                  </button>
                </td>
              </tr>
            ))}

            {!state.loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 16 }} className="subtle">No attributes found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button className="btn" onClick={prev} disabled={state.page === 1}>Prev</button>
        <div className="subtle">Page {state.page} of {maxPage}</div>
        <button className="btn" onClick={next} disabled={state.page >= maxPage}>Next</button>
      </div>
    </div>
  )
}
