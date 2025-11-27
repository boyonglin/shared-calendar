/**
 * Hook for managing application UI state
 *
 * Centralizes modal states and user selection logic
 * to reduce complexity in App.tsx
 */
import { useState, useCallback, useMemo } from "react";
import type { User } from "../types";

export interface ModalState {
  settings: boolean;
  friends: boolean;
  icloud: boolean;
}

export interface UseAppStateOptions {
  currentUser: User | null;
  initialSelectedUsers?: string[];
}

export interface UseAppStateReturn {
  // User selection
  selectedUsers: string[];
  toggleUser: (userId: string) => void;
  setSelectedUsers: React.Dispatch<React.SetStateAction<string[]>>;

  // Modal state
  modals: ModalState;
  openModal: (modal: keyof ModalState) => void;
  closeModal: (modal: keyof ModalState) => void;
  closeAllModals: () => void;
}

const DEFAULT_SELECTED_USERS = ["1", "2", "3", "4"];

/**
 * Manages application-level UI state including:
 * - User selection for calendar filtering
 * - Modal open/close states
 */
export function useAppState({
  currentUser,
  initialSelectedUsers = DEFAULT_SELECTED_USERS,
}: UseAppStateOptions): UseAppStateReturn {
  // User selection state - initialize with current user if present
  const [selectedUsers, setSelectedUsers] = useState<string[]>(() => {
    if (currentUser && !initialSelectedUsers.includes(currentUser.id)) {
      return [...initialSelectedUsers, currentUser.id];
    }
    return initialSelectedUsers;
  });

  // Track user IDs that have been auto-added (to avoid re-adding after manual removal)
  const [autoAddedUsers, setAutoAddedUsers] = useState<Set<string>>(
    () => new Set(currentUser ? [currentUser.id] : []),
  );

  // Modal states consolidated into a single object
  const [modals, setModals] = useState<ModalState>({
    settings: false,
    friends: false,
    icloud: false,
  });

  // Derive selectedUsers with current user included (if logged in and not already selected)
  const selectedUsersWithCurrentUser = useMemo(() => {
    if (!currentUser) {
      return selectedUsers;
    }

    // If user is already in the list, return as-is
    if (selectedUsers.includes(currentUser.id)) {
      return selectedUsers;
    }

    // If this user was previously auto-added and then manually removed, don't re-add
    if (autoAddedUsers.has(currentUser.id)) {
      return selectedUsers;
    }

    // Auto-add new current user - need to update autoAddedUsers state
    return [...selectedUsers, currentUser.id];
  }, [currentUser, selectedUsers, autoAddedUsers]);

  /**
   * Toggle a user's selection in the calendar view
   */
  const toggleUser = useCallback(
    (userId: string) => {
      // If this is the current user being toggled, mark as auto-added so we don't re-add
      if (currentUser?.id === userId) {
        setAutoAddedUsers((prev) => new Set(prev).add(userId));
      }
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId],
      );
    },
    [currentUser?.id],
  );

  /**
   * Open a specific modal
   */
  const openModal = useCallback((modal: keyof ModalState) => {
    setModals((prev) => ({ ...prev, [modal]: true }));
  }, []);

  /**
   * Close a specific modal
   */
  const closeModal = useCallback((modal: keyof ModalState) => {
    setModals((prev) => ({ ...prev, [modal]: false }));
  }, []);

  /**
   * Close all modals at once
   */
  const closeAllModals = useCallback(() => {
    setModals({
      settings: false,
      friends: false,
      icloud: false,
    });
  }, []);

  return {
    selectedUsers: selectedUsersWithCurrentUser,
    toggleUser,
    setSelectedUsers,
    modals,
    openModal,
    closeModal,
    closeAllModals,
  };
}
