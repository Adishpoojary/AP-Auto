import React, { createContext, useContext, useRef, useState } from 'react';

/**
 * ChatContext - Global state for the floating conversation chat window.
 * Allows the chat modal to persist across page navigation when minimized.
 *
 * modalType:
 *   'conversation'       → ConversationDetailsModal  (flagged / historical chats)
 *   'startConversation'  → StartConversationModal    (start / join live chats)
 */
const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [chatState, setChatState] = useState({
    isOpen: false,
    isMinimized: false,
    modalType: null,       // 'conversation' | 'startConversation'
    customerId: null,
    conversationId: null,
    userId: null,
    isOngoingSession: false,
    isJoining: false,
    displayName: null,
    displayPhone: null,
    unreadCount: 0,
  });

  // Independent WebSocket owned by ChatContext, used ONLY for unread counting while minimized.
  // The modal's own display socket is completely unaffected.
  const unreadWsRef = useRef(null);

  const stopUnreadTracking = () => {
    if (unreadWsRef.current) {
      unreadWsRef.current.close();
      unreadWsRef.current = null;
    }
  };

  const startUnreadTracking = (wsUrl) => {
    stopUnreadTracking();
    if (!wsUrl) return;
    try {
      const ws = new WebSocket(wsUrl);
      unreadWsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            const role = (data.message?.role || '').toLowerCase();
            if (role !== 'assistant' && role !== 'system' && role !== 'tool') {
              setChatState(prev => ({ ...prev, unreadCount: (prev.unreadCount || 0) + 1 }));
            }
          }
        } catch (e) { /* ignore parse errors */ }
      };
      ws.onerror = () => {};
      ws.onclose = () => {};
    } catch (e) {
      console.warn('Failed to open unread-tracking WebSocket:', e);
    }
  };

  /** Open the chat window with a given config */
  const openChat = (config) => {
    setChatState({
      isOpen: true,
      isMinimized: false,
      modalType: config.modalType || 'conversation',
      customerId: config.customerId || null,
      conversationId: config.conversationId || null,
      userId: config.userId || null,
      isOngoingSession: config.isOngoingSession || false,
      isJoining: config.isJoining || false,
      displayName: config.displayName || null,
      displayPhone: config.displayPhone || null,
      unreadCount: 0,
    });
  };

  /** Minimize the chat — opens an independent WS for unread counting */
  const minimizeChat = (displayInfo = {}) => {
    startUnreadTracking(displayInfo.wsUrl);
    setChatState(prev => ({
      ...prev,
      isOpen: false,
      isMinimized: true,
      displayName: displayInfo.displayName !== undefined ? displayInfo.displayName : prev.displayName,
      displayPhone: displayInfo.displayPhone !== undefined ? displayInfo.displayPhone : prev.displayPhone,
    }));
  };

  /** Restore the chat from the minimized bubble */
  const restoreChat = () => {
    stopUnreadTracking();
    setChatState(prev => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
      unreadCount: 0,
    }));
  };

  /** Close and discard the chat entirely */
  const closeChat = () => {
    stopUnreadTracking();
    setChatState({
      isOpen: false,
      isMinimized: false,
      modalType: null,
      customerId: null,
      conversationId: null,
      userId: null,
      isOngoingSession: false,
      isJoining: false,
      displayName: null,
      displayPhone: null,
      unreadCount: 0,
    });
  };

  // Kept for backward compatibility — unread is now driven by the context's own WS
  const incrementUnread = () => {
    setChatState(prev => ({ ...prev, unreadCount: (prev.unreadCount || 0) + 1 }));
  };

  return (
    <ChatContext.Provider value={{ chatState, openChat, minimizeChat, incrementUnread, restoreChat, closeChat }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export default ChatContext;
