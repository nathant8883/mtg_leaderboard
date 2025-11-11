import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Pod, PodInvite, podApi, authApi } from '../services/api';
import { useAuth } from './AuthContext';

interface PodContextType {
  currentPod: Pod | null;
  userPods: Pod[];
  pendingInvites: PodInvite[];
  loading: boolean;
  switchPod: (podId: string) => Promise<void>;
  refreshPods: () => Promise<void>;
  refreshInvites: () => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  createPod: (name: string, description?: string) => Promise<Pod>;
}

const PodContext = createContext<PodContextType | undefined>(undefined);

const CURRENT_POD_KEY = 'mtg_current_pod_id';

export const PodProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentPlayer, refreshPlayer } = useAuth();
  const [currentPod, setCurrentPod] = useState<Pod | null>(null);
  const [userPods, setUserPods] = useState<Pod[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PodInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Load pods when user logs in
  useEffect(() => {
    if (currentPlayer && !currentPlayer.is_guest) {
      loadPodsAndInvites();
    } else {
      setUserPods([]);
      setCurrentPod(null);
      setPendingInvites([]);
      setLoading(false);
    }
  }, [currentPlayer?.id]);

  const loadPodsAndInvites = async () => {
    try {
      setLoading(true);

      // Load user's pods
      const pods = await podApi.getAll();
      setUserPods(pods);

      // Load pending invites
      await loadPendingInvites();

      // Set current pod based on player's current_pod_id or localStorage
      if (currentPlayer?.current_pod_id) {
        const pod = pods.find(p => p.id === currentPlayer.current_pod_id);
        if (pod) {
          setCurrentPod(pod);
          localStorage.setItem(CURRENT_POD_KEY, pod.id!);
        } else if (pods.length > 0) {
          // Fallback to first pod if current_pod_id is invalid
          await switchPod(pods[0].id!);
        }
      } else if (pods.length > 0) {
        // No current pod set, use first pod
        await switchPod(pods[0].id!);
      }
    } catch (error) {
      console.error('Error loading pods:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingInvites = async () => {
    try {
      const invites = await podApi.getPendingInvites();
      setPendingInvites(invites);
    } catch (error) {
      console.error('Error loading invites:', error);
    }
  };

  const switchPod = async (podId: string) => {
    try {
      // Call backend to update current pod
      await authApi.switchPod(podId);

      // Update local state
      const pod = userPods.find(p => p.id === podId);
      if (pod) {
        setCurrentPod(pod);
        localStorage.setItem(CURRENT_POD_KEY, podId);
      }

      // Refresh player data to get updated current_pod_id
      await refreshPlayer();

      // Trigger data refresh in other components
      window.dispatchEvent(new CustomEvent('podSwitched', { detail: { podId } }));
    } catch (error) {
      console.error('Error switching pod:', error);
      throw error;
    }
  };

  const refreshPods = async () => {
    try {
      const pods = await podApi.getAll();
      setUserPods(pods);

      // Update current pod if it's still in the list
      if (currentPod?.id) {
        const updatedPod = pods.find(p => p.id === currentPod.id);
        if (updatedPod) {
          setCurrentPod(updatedPod);
        } else {
          // Current pod no longer exists (removed), switch to first pod
          if (pods.length > 0) {
            await switchPod(pods[0].id!);
          } else {
            setCurrentPod(null);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing pods:', error);
    }
  };

  const refreshInvites = async () => {
    await loadPendingInvites();
  };

  const acceptInvite = async (inviteId: string) => {
    try {
      await podApi.acceptInvite(inviteId);

      // Remove from pending invites
      setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));

      // Refresh pods to include newly joined pod
      await refreshPods();
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  };

  const declineInvite = async (inviteId: string) => {
    try {
      await podApi.declineInvite(inviteId);

      // Remove from pending invites
      setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    } catch (error) {
      console.error('Error declining invite:', error);
      throw error;
    }
  };

  const createPod = async (name: string, description?: string): Promise<Pod> => {
    try {
      const newPod = await podApi.create(name, description);

      // Refresh pods and switch to new pod
      await refreshPods();
      await switchPod(newPod.id!);

      return newPod;
    } catch (error) {
      console.error('Error creating pod:', error);
      throw error;
    }
  };

  const value: PodContextType = {
    currentPod,
    userPods,
    pendingInvites,
    loading,
    switchPod,
    refreshPods,
    refreshInvites,
    acceptInvite,
    declineInvite,
    createPod,
  };

  return <PodContext.Provider value={value}>{children}</PodContext.Provider>;
};

export const usePod = (): PodContextType => {
  const context = useContext(PodContext);
  if (context === undefined) {
    throw new Error('usePod must be used within a PodProvider');
  }
  return context;
};
