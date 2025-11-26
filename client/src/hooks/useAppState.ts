/**
 * Hook for managing application UI state
 *
 * Centralizes modal states and user selection logic
 * to reduce complexity in App.tsx
 */
import { useState, useCallback } from "react";
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

  // Modal states consolidated into a single object
  const [modals, setModals] = useState<ModalState>({
    settings: false,
    friends: false,
    icloud: false,
  });

  // Track previous user ID to detect changes
  const [prevUserId, setPrevUserId] = useState<string | null>(
    currentUser?.id ?? null,
  );

  // Handle user changes (login/logout) - update derived state
  if (currentUser?.id !== prevUserId) {
    setPrevUserId(currentUser?.id ?? null);
    if (currentUser && !selectedUsers.includes(currentUser.id)) {
      setSelectedUsers((prev) => [...prev, currentUser.id]);
    }
  }

  /**
   * Toggle a user's selection in the calendar view
   */
  const toggleUser = useCallback((userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }, []);

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
    selectedUsers,
    toggleUser,
    setSelectedUsers,
    modals,
    openModal,
    closeModal,
    closeAllModals,
  };
}
