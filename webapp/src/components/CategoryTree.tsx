import { useEffect, useMemo, useState, Fragment } from 'react';
import { fetchCategoryTree } from '@services/api';
import { useStore } from '@store/context';
import type { CategoryNode } from '@store/types';

type Counts = {
  attributesDirect?: number;
  attributesInherited?: number;
  attributesGlobal?: number;
  attributesTotal?: number;
  productsDirect?: number;
  productsTotal?: number;
  products?: number; // <-- API currently sends this
};

type CategoryNodeWithCounts = CategoryNode & {
  counts?: Counts;
  children?: CategoryNodeWithCounts[];
};

function Indent({ level }: { level: number }) {
  return <span style={{ display: 'inline-block', width: level * 16 }} />;
}

function Caret({
  open,
  visible,
  onClick
}: {
  open: boolean;
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return <span style={{ width: 16, display: 'inline-block' }} />;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Collapse' : 'Expand'}
      style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: 16 }}
    >
      {open ? '▾' : '▸'}
    </button>
  );
}

function CategoryRow({
  node,
  level,
  selected,
  toggleSelect,
  isOpen,
  toggleOpen
}: {
  node: CategoryNodeWithCounts;
  level: number;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  isOpen: boolean;
  toggleOpen: (id: string) => void;
}) {
  const isLeaf = node.isLeaf;

  const attrAssoc =
    node.counts?.attributesTotal ??
    node.counts?.attributesDirect ??
    0;

  const productAssoc =
    node.counts?.productsTotal ??
    node.counts?.productsDirect ??
    node.counts?.products ??
    0;

  return (
    <tr
      style={{
        backgroundColor: isOpen && !isLeaf ? '#2d2d2d' : 'transparent', // dark background if expanded
        color: isOpen && !isLeaf ? '#fff' : 'inherit', // text color for contrast
        transition: 'background-color 0.2s ease'
      }}
    >
      <td>
        <Indent level={level} />
        <Caret
          open={isOpen}
          visible={!isLeaf}
          onClick={() => toggleOpen(node.id)}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={selected.has(node.id)}
            onChange={() => toggleSelect(node.id)}
            disabled={!isLeaf}
            aria-label={`Select ${node.name}`}
          />
          <span>
            {node.name}
            {!isLeaf ? ' (group)' : ''}
          </span>
        </label>
      </td>

      <td>
        <span className="badge" title="Associated attributes">{attrAssoc}</span>
      </td>

      <td>
        <span className="badge" title="Associated products">{productAssoc}</span>
      </td>

      <td>
        <button type="button" onClick={() => { /* no-op for now */ }}>
          More
        </button>
      </td>
    </tr>
  );
}


function Rows({
  nodes,
  level,
  selected,
  toggleSelect,
  openIds,
  toggleOpen
}: {
  nodes: CategoryNodeWithCounts[];
  level: number;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  openIds: Set<string>;
  toggleOpen: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((n) => {
        const open = openIds.has(n.id);
        return (
          <Fragment key={n.id}>
            <CategoryRow
              node={n}
              level={level}
              selected={selected}
              toggleSelect={toggleSelect}
              isOpen={open}
              toggleOpen={toggleOpen}
            />
            {!n.isLeaf && open && n.children?.length ? (
              <Rows
                nodes={n.children as CategoryNodeWithCounts[]}
                level={level + 1}
                selected={selected}
                toggleSelect={toggleSelect}
                openIds={openIds}
                toggleOpen={toggleOpen}
              />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

// helper: walk the tree and ensure productsTotal is populated for groups
function withAggregatedCounts(nodes: CategoryNodeWithCounts[]): CategoryNodeWithCounts[] {
  const clone = (arr: CategoryNodeWithCounts[]): CategoryNodeWithCounts[] =>
    arr.map(n => ({
      ...n,
      counts: { ...(n.counts ?? {}) },
      children: n.children ? clone(n.children as CategoryNodeWithCounts[]) : n.children
    }));

  const roots = clone(nodes);

  function dfs(node: CategoryNodeWithCounts): number {
    if (node.isLeaf) {
      const direct =
        node.counts?.products ??
        node.counts?.productsDirect ??
        node.counts?.productsTotal ??
        0;
      node.counts = { ...(node.counts ?? {}), productsTotal: direct };
      return direct;
    }
    const sum = (node.children ?? []).reduce((acc, c) => acc + dfs(c), 0);
    const provided = node.counts?.productsTotal;
    node.counts = { ...(node.counts ?? {}), productsTotal: provided ?? sum };
    return node.counts.productsTotal ?? 0;
  }

  roots.forEach(dfs);
  return roots;
}

export default function CategoryTreeTable() {
  const { state, dispatch } = useStore();
  const [loading, setLoading] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const selectedSet = useMemo(
    () => new Set(state.selectedCategoryIds),
    [state.selectedCategoryIds]
  );

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetchCategoryTree(ac.signal)
      .then((tree) => {
        // Expecting tree to already be nested and each node may include counts.{productsDirect|productsTotal}
        const withProducts = withAggregatedCounts(tree as unknown as CategoryNodeWithCounts[]);
        dispatch({
          type: 'SET_TREE',
          payload: withProducts
        });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [dispatch]);

  const toggleSelect = (id: string) => {
    const set = new Set(selectedSet);
    set.has(id) ? set.delete(id) : set.add(id);
    dispatch({
      type: 'SET_SELECTED_CATEGORIES',
      payload: Array.from(set)
    });
  };

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next as Set<string>;
    });
  };

  return (
    <div className="card">
      <div className="panel-title">
        <h3>Category Tree</h3>
      </div>

      {loading && <div className="subtle">Loading tree…</div>}

      <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Category name</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Associated attributes</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Associated products</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>More</th>
          </tr>
        </thead>
        <tbody>
          <Rows
            nodes={state.categoryTree as CategoryNodeWithCounts[]}
            level={0}
            selected={selectedSet}
            toggleSelect={toggleSelect}
            openIds={openIds}
            toggleOpen={toggleOpen}
          />
        </tbody>
      </table>

      <div style={{ marginTop: 8 }}>
        <span className="badge">Selected {state.selectedCategoryIds.length}</span>
      </div>
    </div>
  );
}
