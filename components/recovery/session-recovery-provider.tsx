"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";

import { RecoveryScreen } from "@/components/recovery/recovery-screen";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type ProfileStatus = Database["public"]["Tables"]["profiles"]["Row"]["status"];

type SessionRecoveryContextValue = {
  isInitialLoading: boolean;
  isSessionChecking: boolean;
  initialProfileStatus: ProfileStatus;
  markStateRestored: () => void;
};

const SessionRecoveryContext = createContext<SessionRecoveryContextValue | null>(null);

type SessionRecoveryProviderProps = {
  userId: string;
  children: ReactNode;
};

export function SessionRecoveryProvider({
  userId,
  children,
}: SessionRecoveryProviderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isSessionChecking, setIsSessionChecking] = useState(true);
  const [isStateRestored, setIsStateRestored] = useState(false);
  const [initialProfileStatus, setInitialProfileStatus] = useState<ProfileStatus>(null);

  const markStateRestored = useCallback(() => {
    setIsStateRestored(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function checkSessionAndProfileStatus() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        if (!session) {
          router.replace("/login");
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", userId)
          .maybeSingle();

        if (!isMounted) return;

        setInitialProfileStatus(data?.status ?? null);
      } finally {
        if (isMounted) {
          setIsSessionChecking(false);
        }
      }
    }

    void checkSessionAndProfileStatus();

    return () => {
      isMounted = false;
    };
  }, [router, supabase, userId]);

  const isInitialLoading = isSessionChecking || !isStateRestored;

  const contextValue = useMemo<SessionRecoveryContextValue>(
    () => ({
      isInitialLoading,
      isSessionChecking,
      initialProfileStatus,
      markStateRestored,
    }),
    [isInitialLoading, isSessionChecking, initialProfileStatus, markStateRestored],
  );

  return (
    <SessionRecoveryContext.Provider value={contextValue}>
      <div className="min-h-screen bg-stone-950">
        {children}
      </div>
      <AnimatePresence>
        {isInitialLoading ? <RecoveryScreen key="recovery-screen" /> : null}
      </AnimatePresence>
    </SessionRecoveryContext.Provider>
  );
}

export function useSessionRecovery() {
  const context = useContext(SessionRecoveryContext);
  if (!context) {
    throw new Error("useSessionRecovery must be used within SessionRecoveryProvider");
  }
  return context;
}
