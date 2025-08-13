import { get } from './http'
import type { Attribute, LinkType } from '@store/types'

export type CategoryDto = {
  id: string
  name: string
  slug: string
  parentId?: string | null
  isLeaf: boolean
  counts: { attributesDirect: number; products: number } // products = associated product count (direct)
  children: CategoryDto[]
}

// No change: server already returns counts in /categories/tree
export async function fetchCategoryTree(signal?: AbortSignal) {
  return get<CategoryDto[]>('/categories/tree', signal)
}

export type AttributeQuery = {
  categoryIds?: string[]
  linkTypes?: LinkType[]            // 'direct' | 'inherited' | 'global'
  q?: string
  page?: number
  pageSize?: number
  sort?: 'name' | 'createdAt' | 'updatedAt'
}

// Extend Attribute with the count the server returns
export type AttributeListItem = Attribute & {
  /** Number of products using this attribute.
   * - Scoped to selected categories (incl. descendants) when categoryIds are provided
   * - Global usage when categoryIds are omitted
   */
  productsInUse: number
  // If your UI needs categories shown with each attribute (server returns them):
  categories?: Array<{ id: string; name: string; slug: string }>
}

export type AttributeResponse = {
  items: AttributeListItem[]
  total: number
  page?: number
  pageSize?: number
}

function buildAttributeQuery(params: AttributeQuery): string {
  const {
    categoryIds,
    linkTypes,
    q,
    page = 1,
    pageSize = 25,
    sort = 'name',
  } = params

  const qs = new URLSearchParams()

  // categories: allow repeated params
  if (categoryIds?.length) {
    for (const id of categoryIds) qs.append('categoryIds', id)
  }

  // pass link types as repeated params (server supports repeated key)
  if (linkTypes?.length) {
    for (const lt of linkTypes) qs.append('linkType', lt)
    // If your controller expects 'linkTypes' instead of 'linkType',
    // swap to: qs.append('linkTypes', lt)
  }

  if (q && q.trim()) qs.set('q', q.trim())
  qs.set('page', String(page))
  qs.set('pageSize', String(pageSize))
  if (sort) qs.set('sort', sort)

  return qs.toString()
}

export async function fetchAttributes(
  params: AttributeQuery,
  signal?: AbortSignal
): Promise<AttributeResponse> {
  const query = buildAttributeQuery(params)
  const path = query ? `/attributes?${query}` : '/attributes'
  // Server returns items with productsInUse — type it accordingly
  return get<AttributeResponse>(path, signal)
}
