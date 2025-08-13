import React, { createContext, useContext, useReducer, useMemo } from 'react'
import { reducer } from './reducer'
import { initialState } from './initialState'
import type { Action, State } from './types'

type StoreCtx = { state: State; dispatch: React.Dispatch<Action> }

const Ctx = createContext<StoreCtx | undefined>(undefined)

export const StoreProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
