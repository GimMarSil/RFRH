import React, { createContext, useContext, useState, ReactNode, useEffect, PropsWithChildren } from 'react';
import { useMsal } from "@azure/msal-react";
import { 
    InteractionStatus, 
    type AccountInfo, 
    type IPublicClientApplication 
} from "@azure/msal-browser";

interface SelectedEmployeeContextType {
  selectedEmployeeId: string | null;
  setSelectedEmployeeId: (employeeId: string | null) => void;
  systemUserId: string | null; // The actual MSAL/system-wide user ID
  setSystemUserId: (userId: string | null) => void;
  employeeProfileName: string | null; // Display name for the selectedEmployeeId profile
  setEmployeeProfileName: (name: string | null) => void;
  isManagerRole: boolean; // Does the selectedEmployeeId represent a manager role?
  setIsManagerRole: (isManager: boolean) => void;
  msalInstance: IPublicClientApplication | null; // Added for direct pass-through
  accounts: AccountInfo[]; // Added for direct pass-through
  inProgress: InteractionStatus; // Added for direct pass-through
}

const SelectedEmployeeContext = createContext<SelectedEmployeeContextType | undefined>(undefined);

export const SelectedEmployeeProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const { instance, accounts, inProgress } = useMsal(); // From @azure/msal-react

  // Log MSAL state changes from useMsal() directly in the provider
  useEffect(() => {
    console.log('[SelectedEmployeeContext] MSAL state from useMsal():', {
      instanceReady: !!instance,
      accountsLength: accounts?.length,
      inProgressStatus: inProgress,
    });
  }, [instance, accounts, inProgress]);

  const [selectedEmployeeId, setSelectedEmployeeIdState] = useState<string | null>(null);
  const [systemUserId, setSystemUserIdState] = useState<string | null>(null);
  const [employeeProfileName, setEmployeeProfileNameState] = useState<string | null>(null);
  const [isManagerRole, setIsManagerRoleState] = useState<boolean>(false);

  // Persistência em localStorage
  useEffect(() => {
    const storedEmployeeId = localStorage.getItem('selectedEmployeeId');
    if (storedEmployeeId && !selectedEmployeeId) {
      setSelectedEmployeeIdState(storedEmployeeId);
    }
  }, []);

  // Wrapper functions to potentially add logging or other side effects if needed later
  const setSelectedEmployeeId = (employeeId: string | null) => {
    console.log('[SelectedEmployeeContext] setSelectedEmployeeId called with:', employeeId);
    setSelectedEmployeeIdState(employeeId);
    if (employeeId) {
      localStorage.setItem('selectedEmployeeId', employeeId);
    } else {
      localStorage.removeItem('selectedEmployeeId');
    }
  };

  const setSystemUserId = (userId: string | null) => {
    console.log('[SelectedEmployeeContext] setSystemUserId called with:', userId);
    setSystemUserIdState(userId);
    // console.log("System User ID set to:", userId);
  };

  const setEmployeeProfileName = (name: string | null) => {
    console.log('[SelectedEmployeeContext] setEmployeeProfileName called with:', name);
    setEmployeeProfileNameState(name);
    // console.log("Employee Profile Name set to:", name);
  };

  const setIsManagerRole = (isManager: boolean) => {
    console.log('[SelectedEmployeeContext] setIsManagerRole called with:', isManager);
    setIsManagerRoleState(isManager);
    // console.log("Is Manager Role set to:", isManager);
  };

  return (
    <SelectedEmployeeContext.Provider 
      value={{
        selectedEmployeeId, 
        setSelectedEmployeeId, 
        systemUserId, 
        setSystemUserId, 
        employeeProfileName, 
        setEmployeeProfileName,
        isManagerRole,
        setIsManagerRole,
        msalInstance: instance, // Pass instance through
        accounts: accounts,       // Pass accounts through
        inProgress: inProgress     // Pass inProgress through
      }}
    >
      {children}
    </SelectedEmployeeContext.Provider>
  );
};

export const useSelectedEmployee = () => {
  const context = useContext(SelectedEmployeeContext);
  if (context === undefined) {
    throw new Error('useSelectedEmployee must be used within a SelectedEmployeeProvider');
  }
  // No need to call useMsal() here again, as values are passed from provider
  // const { instance, accounts, inProgress } = useMsal(); 
  return {
    selectedEmployeeId: context.selectedEmployeeId,
    setSelectedEmployeeId: context.setSelectedEmployeeId,
    systemUserId: context.systemUserId,
    setSystemUserId: context.setSystemUserId,
    employeeProfileName: context.employeeProfileName,
    setEmployeeProfileName: context.setEmployeeProfileName,
    isManagerRole: context.isManagerRole,
    setIsManagerRole: context.setIsManagerRole,
    msalInstance: context.msalInstance, // Get from context
    accounts: context.accounts,         // Get from context
    inProgress: context.inProgress       // Get from context
  };
}; 