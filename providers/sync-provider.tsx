"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { createClient } from "@/lib/supabase/client";

interface SyncContextType {
  state: Record<string, any>;
  isSync: boolean;
  updateState: (key: string, data: any) => Promise<void>;
  clearState: (key: string) => void;
  isSyncing: boolean;
  isLoading: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: React.ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const [state, setState] = useState<Record<string, any>>({});
  const [isSync, setIsSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Check if localStorage is available
  const isLocalStorageAvailable = () => {
    try {
      return typeof window !== "undefined" && "localStorage" in window;
    } catch {
      return false;
    }
  };

  // Load all data from localStorage and Supabase on mount
  useEffect(() => {
    const loadInitialState = async () => {
      if (!isLocalStorageAvailable()) {
        setIsLoading(false);
        return;
      }

      try {
        // First, load all localStorage data
        const localState: Record<string, any> = {};

        // Get all localStorage keys and load them
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !key.startsWith("sb-") && !key.includes("api_key")) {
            // Skip Supabase auth keys and API keys
            try {
              const item = localStorage.getItem(key);
              if (item) {
                localState[key] = JSON.parse(item);
              }
            } catch (error) {
              // If parsing fails, store as string
              console.error("Error parsing localStorage item:", error);
              localState[key] = localStorage.getItem(key);
            }
          }
        }

        // Set initial state from localStorage
        setState(localState);

        // Check if user is authenticated and sync with Supabase
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: userData, error } = await supabase
            .from("user_data")
            .select("data")
            .single();

          if (!error && userData?.data) {
            const supabaseData = userData.data;
            const mergedState = { ...localState };
            let hasUpdates = false;

            // Merge Supabase data with localStorage data
            for (const [key, value] of Object.entries(supabaseData)) {
              if (
                !localState[key] ||
                JSON.stringify(localState[key]) !== JSON.stringify(value)
              ) {
                mergedState[key] = value;
                // Update localStorage with Supabase data
                localStorage.setItem(key, JSON.stringify(value));
                hasUpdates = true;
              }
            }

            if (hasUpdates) {
              setState(mergedState);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load initial state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialState();
  }, [supabase]);

  const updateState = useCallback(
    async (key: string, data: any) => {
      if (!isLocalStorageAvailable()) {
        console.warn("localStorage is not available");
        return;
      }

      setIsSyncing(true);
      setIsSync(false);

      try {
        // Update local state immediately
        setState((prevState) => ({
          ...prevState,
          [key]: data,
        }));

        const serializedData = JSON.stringify(data);
        localStorage.setItem(key, serializedData);

        // Check if user is authenticated and sync to Supabase
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Try to get existing user_data row
          const { data: userData, error: fetchError } = await supabase
            .from("user_data")
            .select("data")
            .single();

          if (fetchError && fetchError.code !== "PGRST116") {
            // PGRST116 is "no rows returned", which is expected for new users
            throw fetchError;
          }

          // Prepare the data object with the new key-value pair
          const currentData = userData?.data || {};
          const updatedData = {
            ...currentData,
            [key]: data,
          };

          if (userData) {
            // Update existing row
            const { error: updateError } = await supabase
              .from("user_data")
              .update({ data: updatedData })
              .neq("data", null);

            if (updateError) throw updateError;
          } else {
            // Insert new row
            const { error: insertError } = await supabase
              .from("user_data")
              .insert({ data: updatedData });

            if (insertError) throw insertError;
          }
        }

        setIsSync(true);
      } catch (error) {
        console.error("Failed to save data:", error);
        setIsSync(false);
      } finally {
        setIsSyncing(false);
      }
    },
    [supabase]
  );

  const clearState = useCallback(
    async (key: string) => {
      if (!isLocalStorageAvailable()) {
        return;
      }

      try {
        // Update local state immediately
        setState((prevState) => {
          const newState = { ...prevState };
          delete newState[key];
          return newState;
        });

        localStorage.removeItem(key);

        // Check if user is authenticated and clear from Supabase
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: userData, error: fetchError } = await supabase
            .from("user_data")
            .select("data")
            .single();

          if (!fetchError && userData?.data) {
            const updatedData = { ...userData.data };
            delete updatedData[key];

            const { error: updateError } = await supabase
              .from("user_data")
              .update({ data: updatedData })
              .neq("data", null);

            if (updateError) throw updateError;
          }
        }

        setIsSync(true);
      } catch (error) {
        console.error("Failed to clear data:", error);
      }
    },
    [supabase]
  );

  const value: SyncContextType = {
    state,
    isSync,
    updateState,
    clearState,
    isSyncing,
    isLoading,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
