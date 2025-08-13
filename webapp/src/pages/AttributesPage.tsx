import AttributeFilters from '@components/AttributeFilters'
import AttributeTable from '@components/AttributeTable'

export default function AttributesPage() {
  return (
    <div className="grid">
      <div>
        <AttributeFilters />
      </div>
      <div>
        <AttributeTable />
      </div>
    </div>
  )
}
