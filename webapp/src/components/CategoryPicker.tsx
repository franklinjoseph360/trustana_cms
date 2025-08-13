import { useState, useRef, useEffect } from 'react'
import { useStore } from '@store/context'
import CategoryTree from './CategoryTree'

export default function CategoryPicker() {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const clear = () => {
    dispatch({ type: 'SET_SELECTED_CATEGORIES', payload: [] })
  }

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Categories {state.selectedCategoryIds.length}
      </button>

      <dialog ref={dialogRef} onClose={() => setOpen(false)} style={{ width: 720, maxWidth: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>Select categories</h3>
          <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
        </div>

        <div style={{ marginTop: 8, maxHeight: '60vh', overflow: 'auto' }}>
          {/* CategoryTree already fetches the tree and dispatches SET_SELECTED_CATEGORIES as you toggle */}
          <CategoryTree />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn" onClick={clear}>Clear</button>
          <button type="button" className="btn primary" onClick={() => setOpen(false)}>Done</button>
        </div>
      </dialog>
    </>
  )
}
