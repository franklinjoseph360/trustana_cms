import { State } from './types'

export const initialState: State = {
  categoryTree: [],
  selectedCategoryIds: [],
  attributes: [],
  q: '',
  linkTypes: [],
  page: 1,
  pageSize: 20,
  total: 0,
  loading: false
}
