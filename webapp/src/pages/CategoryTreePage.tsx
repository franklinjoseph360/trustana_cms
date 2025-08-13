import CategoryTree from '@components/CategoryTree'

export default function CategoryTreePage() {
  return (
    <div className="grid">
      <div>
        <div className="card">
          <p className="subtle">Use the tree to select one or more leaf nodes. Group nodes are not selectable.</p>
        </div>
      </div>
      <div>
        <CategoryTree />
      </div>
    </div>
  )
}
