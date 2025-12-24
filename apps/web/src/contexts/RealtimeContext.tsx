import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from 'react-oidc-context';
import { useUser } from './UserContext';
import { env } from '../config';
import type {
  RealtimeEvent,
  RealtimeEntityType,
  SubscriptionRequest,
} from '@ursly/shared/types';

type EventCallback = (event: RealtimeEvent) => void;

interface RealtimeContextType {
  isConnected: boolean;
  connectionError: string | null;
  subscribe: (
    entityType: RealtimeEntityType,
    entityId?: string,
    callback?: EventCallback,
  ) => () => void;
  unsubscribe: (entityType: RealtimeEntityType, entityId?: string) => void;
  addListener: (callback: EventCallback) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(
  undefined,
);

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const auth = useAuth();
  const { currentOrg } = useUser();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const listenersRef = useRef<Set<EventCallback>>(new Set());
  const subscriptionCallbacksRef = useRef<Map<string, Set<EventCallback>>>(
    new Map(),
  );

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (auth.isLoading || !auth.user || !currentOrg) return;

    const socket = io(`${env.ws.url}/realtime`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Realtime] Connected to server');
      setIsConnected(true);
      setConnectionError(null);

      // Authenticate
      socket.emit('authenticate', {
        userId: auth.user?.profile.sub,
        organizationId: currentOrg.id,
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Realtime] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Realtime] Connection error:', error);
      setConnectionError(error.message);
    });

    // Handle incoming events
    socket.on('entityUpdate', (event: RealtimeEvent) => {
      // Notify global listeners
      listenersRef.current.forEach((cb) => cb(event));

      // Notify subscription-specific callbacks
      const roomKey = `${event.entityType}:${event.entityId}`;
      const allKey = `${event.entityType}:all`;

      subscriptionCallbacksRef.current.get(roomKey)?.forEach((cb) => cb(event));
      subscriptionCallbacksRef.current.get(allKey)?.forEach((cb) => cb(event));
    });

    socket.on('notification', (event: RealtimeEvent) => {
      listenersRef.current.forEach((cb) => cb(event));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auth.isLoading, auth.user, currentOrg]);

  const subscribe = useCallback(
    (
      entityType: RealtimeEntityType,
      entityId?: string,
      callback?: EventCallback,
    ): (() => void) => {
      if (!socketRef.current?.connected) {
        console.warn('[Realtime] Cannot subscribe: not connected');
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return () => {};
      }

      const roomKey = entityId
        ? `${entityType}:${entityId}`
        : `${entityType}:all`;

      const request: SubscriptionRequest = {
        entityType,
        entityId,
        organizationId: currentOrg?.id || '',
      };

      socketRef.current.emit('subscribe', request);

      // Register callback if provided
      if (callback) {
        if (!subscriptionCallbacksRef.current.has(roomKey)) {
          subscriptionCallbacksRef.current.set(roomKey, new Set());
        }
        subscriptionCallbacksRef.current.get(roomKey)!.add(callback);
      }

      // Return unsubscribe function
      return () => {
        if (callback) {
          subscriptionCallbacksRef.current.get(roomKey)?.delete(callback);
        }
        socketRef.current?.emit('unsubscribe', request);
      };
    },
    [currentOrg],
  );

  const unsubscribe = useCallback(
    (entityType: RealtimeEntityType, entityId?: string) => {
      if (!socketRef.current?.connected) return;

      const request: SubscriptionRequest = {
        entityType,
        entityId,
        organizationId: currentOrg?.id || '',
      };

      socketRef.current.emit('unsubscribe', request);
    },
    [currentOrg],
  );

  const addListener = useCallback((callback: EventCallback): (() => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        connectionError,
        subscribe,
        unsubscribe,
        addListener,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error(
      'useRealtimeContext must be used within a RealtimeProvider',
    );
  }
  return context;
}
