import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { ID } from '@/mock-api';

const SESSION_KEY = 'kanteen.parent.session';

interface Stored {
  parentId: ID;
  childId: ID | null;
}

interface ParentSession {
  parentId: ID | null;
  childId: ID | null;
  login: (parentId: ID, childIds: ID[]) => void;
  selectChild: (id: ID) => void;
  logout: () => void;
}

const Ctx = createContext<ParentSession | null>(null);

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** Fake auth: the "session" is just the parent id remembered in localStorage. */
export function ParentSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored | null>(readStored);

  const save = useCallback((next: Stored | null) => {
    setState(next);
    try {
      if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value: ParentSession = {
    parentId: state?.parentId ?? null,
    childId: state?.childId ?? null,
    login: (parentId, childIds) => save({ parentId, childId: childIds.length === 1 ? childIds[0] : null }),
    selectChild: (id) => state && save({ ...state, childId: id }),
    logout: () => save(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useParentSession(): ParentSession {
  const c = useContext(Ctx);
  if (!c) throw new Error('useParentSession outside provider');
  return c;
}
