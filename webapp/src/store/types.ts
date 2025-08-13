export type LinkType = 'direct' | 'inherited' | 'global'

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  isLeaf: boolean;
  counts: {
    attributesDirect: number;
    products: number;
};
  children: CategoryNode[]; // nested structure from API
};

export type Attribute = {
  id: string
  name: string
  slug: string
  linkType?: LinkType
}

export type State = {
  categoryTree: CategoryNode[]
  selectedCategoryIds: string[]
  attributes: Attribute[]
  q: string
  linkTypes: LinkType[]
  page: number
  pageSize: number
  total: number
  loading: boolean
  error?: string
}

export type Action =
  | { type: 'SET_TREE'; payload: CategoryNode[] }
  | { type: 'SET_SELECTED_CATEGORIES'; payload: string[] }
  | { type: 'SET_QUERY'; payload: string }
  | { type: 'SET_LINK_TYPES'; payload: LinkType[] }
  | { type: 'SET_ATTRIBUTES'; payload: { items: Attribute[]; total: number } }
  | { type: 'SET_PAGINATION'; payload: { page: number; pageSize?: number } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload?: string }
