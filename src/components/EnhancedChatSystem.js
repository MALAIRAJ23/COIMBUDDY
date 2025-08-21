import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  where,
  limit,
  setDoc // Added setDoc here
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../firebase/collections';
import { Send, MapPin, Clock, User, Car, MessageCircle, Phone, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const EnhancedChatSystem = ({
  tripId,
  pilotId,
  buddyId,
  pilotName,
  buddyName,
  rideStatus,
  pickupPoint,
  destination,
  currentUserId,
  onRideStatusUpdate
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [isChatActive, setIsChatActive] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeen, setLastSeen] = useState({});
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Create or get chat room
  useEffect(() => {
    const createOrGetChat = async () => {
      try {
        // Check if chat already exists
        const chatQuery = query(
          collection(db, COLLECTIONS.CHATS),
          where('tripId', '==', tripId),
          where('participants', 'array-contains', currentUserId)
        );

        const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
          const existingChat = snapshot.docs[0];

          if (existingChat) {
            setChatId(existingChat.id);
            setIsChatActive(existingChat.data().isActive);
            setLastSeen(existingChat.data().lastSeen || {});
          } else {
            // Create new chat
            createNewChat();
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error creating/getting chat:', error);
        toast.error('Failed to initialize chat');
      }
    };

    const createNewChat = async () => {
      try {
        const chatData = {
          tripId,
          participants: [pilotId, buddyId],
          pilotId,
          buddyId,
          pilotName,
          buddyName,
          pickupPoint,
          destination,
          isActive: true,
          rideStatus: 'pending',
          lastSeen: {
            [pilotId]: serverTimestamp(),
            [buddyId]: serverTimestamp()
          },
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp()
        };

        const chatRef = await addDoc(collection(db, COLLECTIONS.CHATS), chatData);
        setChatId(chatRef.id);
        setIsChatActive(true);

        // Send welcome message
        await sendSystemMessage('🚗 Chat started! You can now communicate with your ride partner.');
      } catch (error) {
        console.error('Error creating chat:', error);
        toast.error('Failed to create chat room');
      }
    };

    if (tripId && pilotId && buddyId) {
      createOrGetChat();
    }
  }, [tripId, pilotId, buddyId, pilotName, buddyName, pickupPoint, destination, currentUserId]);

  // Listen to messages with real-time updates
  useEffect(() => {
    if (!chatId) return;

    const messagesQuery = query(
      collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date()
      }));

      setMessages(newMessages);

      // Update unread count
      const unread = newMessages.filter(msg =>
        msg.senderId !== currentUserId &&
        !msg.readBy?.includes(currentUserId)
      ).length;
      setUnreadCount(unread);

      // Mark messages as read
      if (unread > 0) {
        markMessagesAsRead();
      }
    }, (error) => {
      console.error('Error listening to messages:', error);
      toast.error('Failed to load messages');
    });

    return unsubscribe;
  }, [chatId, currentUserId]);

  // Listen to typing indicators
  useEffect(() => {
    if (!chatId) return;

    const typingQuery = query(
      collection(db, COLLECTIONS.CHATS, chatId, 'typing'),
      where('userId', '!=', currentUserId)
    );

    const unsubscribe = onSnapshot(typingQuery, (snapshot) => {
      const typingUsersSet = new Set();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (Date.now() - data.timestamp.toMillis() < 3000) { // 3 second timeout
          typingUsersSet.add(data.userId);
        }
      });
      setTypingUsers(typingUsersSet);
    });

    return unsubscribe;
  }, [chatId, currentUserId]);

  // Update last seen
  useEffect(() => {
    if (!chatId) return;

    const updateLastSeen = async () => {
      try {
        await updateDoc(doc(db, COLLECTIONS.CHATS, chatId), {
          [`lastSeen.${currentUserId}`]: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating last seen:', error);
      }
    };

    updateLastSeen();
  }, [chatId, currentUserId]);

  // Send system message
  const sendSystemMessage = async (content) => {
    try {
      const messageData = {
        content,
        senderId: 'system',
        senderName: 'System',
        messageType: 'system',
        timestamp: serverTimestamp(),
        readBy: [pilotId, buddyId]
      };

      await addDoc(collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES), messageData);
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  };

  // Send regular message
  const sendMessage = async () => {
    if (!newMessage.trim() || !chatId) return;

    setIsLoading(true);
    try {
      const messageData = {
        content: newMessage.trim(),
        senderId: currentUserId,
        senderName: currentUserId === pilotId ? pilotName : buddyName,
        messageType: 'text',
        timestamp: serverTimestamp(),
        readBy: [currentUserId]
      };

      await addDoc(collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES), messageData);

      // Update chat's last message timestamp
      await updateDoc(doc(db, COLLECTIONS.CHATS, chatId), {
        lastMessageAt: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!chatId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Add typing indicator
    const typingRef = doc(collection(db, COLLECTIONS.CHATS, chatId, 'typing'), currentUserId);
    updateDoc(typingRef, {
      userId: currentUserId,
      timestamp: serverTimestamp()
    }).catch(() => {
      // Create if doesn't exist
      setDoc(typingRef, { // Changed addDoc to setDoc
        userId: currentUserId,
        timestamp: serverTimestamp()
      });
    });

    // Remove typing indicator after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      const typingRef = doc(collection(db, COLLECTIONS.CHATS, chatId, 'typing'), currentUserId);
      updateDoc(typingRef, {
        timestamp: serverTimestamp()
      }).catch(() => {});
    }, 3000);
  }, [chatId, currentUserId]);

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!chatId) return;

    try {
      const unreadMessages = messages.filter(msg =>
        msg.senderId !== currentUserId &&
        !msg.readBy?.includes(currentUserId)
      );

      for (const message of unreadMessages) {
        await updateDoc(
          doc(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES, message.id),
          {
            readBy: [...(message.readBy || []), currentUserId]
          }
        );
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else {
      handleTyping();
    }
  };

  // Get message status
  const getMessageStatus = (message) => {
    if (message.senderId === currentUserId) {
      if (message.readBy?.length >= 2) {
        return '✓✓'; // Read
      } else {
        return '✓'; // Sent
      }
    }
    return null;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Ride Chat</h3>
            <div className="text-sm text-gray-600">
              {currentUserId === pilotId ? buddyName : pilotName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            rideStatus === 'completed' ? 'bg-green-100 text-green-800' :
            rideStatus === 'started' ? 'bg-blue-100 text-blue-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {rideStatus}
          </span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Trip Info */}
      <div className="p-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <MapPin className="w-4 h-4" />
          <span>Pickup: {pickupPoint}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-blue-800 mt-1">
          <MapPin className="w-4 h-4" />
          <span>Destination: {destination}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              message.messageType === 'system'
                ? 'bg-gray-100 text-gray-600 text-center mx-auto'
                : message.senderId === currentUserId
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}>
              {message.messageType !== 'system' && (
                <div className="text-xs opacity-75 mb-1">
                  {message.senderName}
                </div>
              )}
              <div className="text-sm">{message.content}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs opacity-75">
                  {formatTime(message.timestamp)}
                </span>
                {getMessageStatus(message) && (
                  <span className="text-xs ml-2">
                    {getMessageStatus(message)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
              <div className="flex items-center gap-1">
                <span className="text-sm">Typing</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows="1"
            disabled={!isChatActive || isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isChatActive || isLoading}
            className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedChatSystem;