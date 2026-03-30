import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

type AuthState = {
  user: any | null;
  role: string | null;
  isInitialized: boolean;
  setSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isInitialized: false, // Starts false, trapping the ProtectedRoute
  
  setSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      set({
        user: session?.user || null,
        role: session?.user?.user_metadata?.role || 'viewer',
        isInitialized: true, // UNLOCKS THE PROTECTED ROUTE
      });
    } catch (err) {
      console.error("Session retrieval failed:", err);
      set({ user: null, role: null, isInitialized: true }); // Unlock even on fail so it routes to login
    }
  },
  
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, role: null });
  }
}));

// CRITICAL FIX: Automatically trigger session check when the app boots
useAuthStore.getState().setSession();