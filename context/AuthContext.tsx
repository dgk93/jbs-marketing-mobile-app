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

function stripJoinedUser(row: Record<string, unknown>): UserLocation {
  const { users: _users, ...location } = row;
  return location as UserLocation;
}

async function fetchAppUserWithLocations(
  email: string
): Promise<{ user: AppUser; locations: UserLocation[] } | null> {
  // Join users → locations (FK: locations.user_id → users)
  const { data, error } = await supabase
    .from('users')
    .select(
      `
      *,
      locations (
        id,
        location_name,
        location_type,
        mobile,
        address,
        created_at,
        owner_name,
        user_id
      )
    `
    )
    .eq('email', email)
    .maybeSingle();

  if (!error && data) {
    const { locations, ...userFields } = data as AppUser & {
      locations: UserLocation[] | UserLocation | null;
    };
    const normalizedLocations = Array.isArray(locations)
      ? locations
      : locations
        ? [locations]
        : [];

    return {
      user: userFields as AppUser,
      locations: normalizedLocations,
    };
  }

  if (error) {
    console.error('users→locations join failed, trying locations→users:', error);
  }

  // Reverse join: locations with matching users.email
  const { data: locationRows, error: joinError } = await supabase
    .from('locations')
    .select(
      `
      id,
      location_name,
      location_type,
      mobile,
      address,
      created_at,
      owner_name,
      user_id,
      users!inner ( id, email, user_id )
    `
    )
    .eq('users.email', email);

  if (joinError) {
    console.error('locations→users join failed:', joinError);
  }

  const { data: userOnly, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (userError || !userOnly) {
    console.error('Error fetching user:', userError);
    return null;
  }

  const locationsFromJoin = (locationRows || []).map((row) =>
    stripJoinedUser(row as Record<string, unknown>)
  );

  return {
    user: userOnly as AppUser,
    locations: locationsFromJoin,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (email: string) => {
    const result = await fetchAppUserWithLocations(email);
    if (result) {
      setUser(result.user);
      setUserLocations(result.locations);
    } else {
      setUser(null);
      setUserLocations([]);
    }
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
