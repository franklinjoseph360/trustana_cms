import { Action, State } from './types'

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_TREE':
      return { ...state, categoryTree: action.payload }
    case 'SET_SELECTED_CATEGORIES':
      return { ...state, selectedCategoryIds: action.payload, page: 1 }
    case 'SET_QUERY':
      return { ...state, q: action.payload, page: 1 }
    case 'SET_LINK_TYPES':
      return { ...state, linkTypes: action.payload, page: 1 }
    case 'SET_ATTRIBUTES':
      return { ...state, attributes: action.payload.items, total: action.payload.total }
    case 'SET_PAGINATION':
      return { ...state, page: action.payload.page, pageSize: action.payload.pageSize ?? state.pageSize }
    case 'SET_LOADING':
      return { ...state, loading: action.payload, error: action.payload ? undefined : state.error }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    default:
      return state
  }
}
