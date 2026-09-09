import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { organizationsApi } from "@/features/organizations/organizations-api";

const ACTIVE_ORGANIZATION_KEY = "intouch.active-organization.v1";

interface WorkspaceContextValue {
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider = ({ children }: PropsWithChildren) => {
  const { status } = useAuth();
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<
    string | null
  >(null);
  const organizations = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
    enabled: status === "authenticated",
  });

  useEffect(() => {
    void AsyncStorage.getItem(ACTIVE_ORGANIZATION_KEY).then(
      setActiveOrganizationIdState,
    );
  }, []);

  useEffect(() => {
    if (!organizations.data) return;
    const valid = organizations.data.some(
      ({ id }) => id === activeOrganizationId,
    );
    if (!valid) {
      const fallback = organizations.data[0]?.id ?? null;
      setActiveOrganizationIdState(fallback);
      if (fallback)
        void AsyncStorage.setItem(ACTIVE_ORGANIZATION_KEY, fallback);
    }
  }, [activeOrganizationId, organizations.data]);

  const setActiveOrganizationId = useCallback((id: string | null) => {
    setActiveOrganizationIdState(id);
    if (id) void AsyncStorage.setItem(ACTIVE_ORGANIZATION_KEY, id);
    else void AsyncStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{ activeOrganizationId, setActiveOrganizationId }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is missing");
  return value;
};
