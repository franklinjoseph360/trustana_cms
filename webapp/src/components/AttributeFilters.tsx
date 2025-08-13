import { useStore } from '@store/context'
import type { LinkType } from '@store/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CategoryPicker from './CategoryPicker'

const ALL: LinkType[] = ['direct', 'inherited', 'global']

export default function AttributeFilters() {
  const { state, dispatch } = useStore()

  // Local UI state for snappy typing and toggling
  const [q, setQ] = useState(state.q)
  const [linkTypesLocal, setLinkTypesLocal] = useState<LinkType[]>(state.linkTypes)

  // Sync local state if external changes happen
  useEffect(() => setQ(state.q), [state.q])
  useEffect(() => setLinkTypesLocal(state.linkTypes), [state.linkTypes])

  const hasCategories = state.selectedCategoryIds.length > 0

  const onToggle = useCallback((lt: LinkType) => {
    setLinkTypesLocal(prev => {
      const set = new Set(prev)
      set.has(lt) ? set.delete(lt) : set.add(lt)
      return Array.from(set) as LinkType[]
    })
  }, [])

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i])

  const isDirty = useMemo(() => {
    return q.trim() !== state.q.trim() || !arraysEqual(linkTypesLocal, state.linkTypes)
  }, [q, state.q, linkTypesLocal, state.linkTypes])

  const apply = useCallback(() => {
    const qTrim = q.trim()
    if (qTrim !== state.q) dispatch({ type: 'SET_QUERY', payload: qTrim })
    if (!arraysEqual(linkTypesLocal, state.linkTypes)) {
      dispatch({ type: 'SET_LINK_TYPES', payload: linkTypesLocal })
    }
    if (qTrim !== state.q || !arraysEqual(linkTypesLocal, state.linkTypes)) {
      dispatch({ type: 'SET_PAGINATION', payload: { page: 1 } })
    }
  }, [dispatch, q, state.q, linkTypesLocal, state.linkTypes])

  const onClear = () => {
    setQ('')
    setLinkTypesLocal([])
    dispatch({ type: 'SET_QUERY', payload: '' })
    dispatch({ type: 'SET_LINK_TYPES', payload: [] })
    dispatch({ type: 'SET_PAGINATION', payload: { page: 1 } })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') apply()
  }

  // Auto-apply stored link-type selections once categories are picked
  const prevHasCategories = useRef(hasCategories)
  useEffect(() => {
    if (!prevHasCategories.current && hasCategories) {
      // Only push if different, and reset to first page
      if (!arraysEqual(linkTypesLocal, state.linkTypes)) {
        dispatch({ type: 'SET_LINK_TYPES', payload: linkTypesLocal })
        dispatch({ type: 'SET_PAGINATION', payload: { page: 1 } })
      }
      if (q.trim() !== state.q.trim()) {
        dispatch({ type: 'SET_QUERY', payload: q.trim() })
        dispatch({ type: 'SET_PAGINATION', payload: { page: 1 } })
      }
    }
    prevHasCategories.current = hasCategories
  }, [hasCategories, linkTypesLocal, state.linkTypes, q, state.q, dispatch])

  // Hint when link-type filters will not be sent to the API
  const hintTitle = !hasCategories
    ? 'Select one or more categories to apply link-type filters'
    : undefined

  return (
    <div className="card">
      <div className="panel-title">
        <h3>Filters</h3>
        <div className="chips" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CategoryPicker />
          <span className="badge">Filters {linkTypesLocal.length || 0}</span>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 10, gap: 8 }}>
        <input
          className="input"
          placeholder="Search attributes"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="btn primary" onClick={apply} disabled={!isDirty}>
          Apply
        </button>
        <button type="button" className="btn" onClick={onClear}>
          Reset
        </button>
      </div>

      <div className="row" style={{ gap: 16, opacity: hasCategories ? 1 : 0.6 }}>
        {ALL.map(lt => (
          <label key={lt} className="checkbox" title={hintTitle}>
            <input
              type="checkbox"
              checked={linkTypesLocal.includes(lt)}
              onChange={() => onToggle(lt)}
            />
            <span>{lt}</span>
          </label>
        ))}
      </div>

      {!hasCategories && (
        <div className="subtle" style={{ marginTop: 6 }}>
          Link-type filters will apply after you select category nodes.
        </div>
      )}
    </div>
  )
}
