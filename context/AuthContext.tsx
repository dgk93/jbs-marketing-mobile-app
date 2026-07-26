import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AppUser = {
  id: number;
  user_id: string;
  name: string;
  mobile_number: string;
  email: string;
  nic: string;
  user_type: string;
  created_at: string;
  updated_at: string;
};

export type UserLocation = {
  id: number;
  location_name: string;
  location_type: string;
  mobile: number | null;
  address: string | null;
  created_at: string;
  owner_name: string | null;
  user_id: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: AppUser | null;
  userLocations: UserLocation[];
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userLocations: [],
  loading: true,
  signOut: async () => {},
});

async function fetchAppUser(email: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !data) return null;
  return data as AppUser;
}

async function fetchUserLocation(userId: string): Promise<UserLocation[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('user_id', userId);
  if (error || !data) return [];
  return data as UserLocation[];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (email: string) => {
    const appUser = await fetchAppUser(email);
    if (appUser?.user_id) {
      const locations = await fetchUserLocation(appUser.user_id);
      setUserLocations(locations);
    }
    setUser(appUser);
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        await loadUserData(session.user.email);
      } else {
        setUser(null);
        setUserLocations([]);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        await loadUserData(session.user.email);
      } else {
        setUser(null);
        setUserLocations([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserLocations([]);
  };

  return (
    <AuthContext.Provider value={{ session, user, userLocations, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
