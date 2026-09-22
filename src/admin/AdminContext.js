import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, configured } from '../data/supabase';

const AdminContext = createContext({ session: null, ready: false, signOut: () => {} });

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured || !supabase) {
      setReady(true);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
      if (sub && sub.subscription) sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AdminContext.Provider value={{ session, ready, signOut }}>
      {children}
    </AdminContext.Provider>
  );
}