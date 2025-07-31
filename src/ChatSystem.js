import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Send, MapPin, Clock, User, Car, MessageCircle } from 'lucide-react';

const ChatSystem = ({ 
  tripId, 
  pilotId, 
  buddyId, 
  pilotName, 
  buddyName, 
  rideStatus, 
  onRideStatusUpdate,
  pickupPoint,
  destination,
  currentUserId 
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [isChatActive, setIsChatActive] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Create or get chat room
  useEffect(() => {
    const createOrGetChat = async () => {
      try {
        // Check if chat already exists
        const chatQuery = query(
          collection(db, 'chats'),
          orderBy('createdAt', 'desc')
        );
        
        const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
          const existingChat = snapshot.docs.find(doc => 
            doc.data().tripId === tripId && 
            doc.data().participants.includes(pilotId) && 
            doc.data().participants.includes(buddyId)
          );
          
          if (existingChat) {
            setChatId(existingChat.id);
            setIsChatActive(existingChat.data().isActive);
          } else {
            // Create new chat
            createNewChat();
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error creating/getting chat:', error);
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
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp()
        };

        const chatRef = await addDoc(collection(db, 'chats'), chatData);
        setChatId(chatRef.id);
        setIsChatActive(true);
      } catch (error) {
        console.error('Error creating chat:', error);
      }
    };

    if (tripId && pilotId && buddyId) {
      createOrGetChat();
    }
  }, [tripId, pilotId, buddyId, pilotName, buddyName, pickupPoint, destination]);

  // Listen to messages
  useEffect(() => {
    if (!chatId) return;

    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messageList);
    });

    return unsubscribe;
  }, [chatId]);

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !isChatActive) return;

    setIsLoading(true);
    try {
      const messageData = {
        text: newMessage.trim(),
        senderId: currentUserId,
        senderName: currentUserId === pilotId ? pilotName : buddyName,
        timestamp: serverTimestamp(),
        type: 'text'
      };

      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      
      // Update last message timestamp
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessageAt: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Send system message (ride status updates)
  const sendSystemMessage = async (message, type = 'system') => {
    if (!chatId) return;

    try {
      const messageData = {
        text: message,
        senderId: 'system',
        senderName: 'System',
        timestamp: serverTimestamp(),
        type
      };

      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  };

  // Listen for ride status changes and send system messages
  useEffect(() => {
    if (!chatId) return;

    const sendStatusMessage = async () => {
      switch (rideStatus) {
        case 'accepted':
          await sendSystemMessage(`✅ Booking accepted! Pilot ${pilotName} has accepted your ride request.`);
          break;
        case 'started':
          await sendSystemMessage(`🚗 Ride started! Pilot ${pilotName} has started the trip from ${pickupPoint}.`);
          break;
        case 'finished':
          await sendSystemMessage(`✅ Ride completed! The trip has been finished successfully. Chat will be closed.`);
          setIsChatActive(false);
          // Update chat status in database
          await updateDoc(doc(db, 'chats', chatId), {
            isActive: false,
            rideStatus: 'finished'
          });
          break;
        default:
          break;
      }
    };

    sendStatusMessage();
  }, [rideStatus, chatId, pilotName, pickupPoint]);

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get message bubble styling
  const getMessageStyle = (senderId) => {
    const isOwnMessage = senderId === currentUserId;
    return isOwnMessage 
      ? 'bg-blue-500 text-white ml-auto' 
      : 'bg-gray-200 text-gray-800';
  };

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Initializing chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Ride Chat</h3>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <MapPin className="w-3 h-3" />
              <span>{pickupPoint} → {destination}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            isChatActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {isChatActive ? 'Active' : 'Closed'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {rideStatus === 'started' ? 'Ride in Progress' : 
             rideStatus === 'finished' ? 'Ride Completed' : 'Waiting to Start'}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No messages yet</p>
            <p className="text-xs text-gray-400">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${getMessageStyle(message.senderId)}`}>
                {message.type === 'system' ? (
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      {message.senderName}
                    </div>
                    <div className="text-sm text-gray-700 bg-yellow-100 px-2 py-1 rounded">
                      {message.text}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm">{message.text}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {formatTime(message.timestamp)}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      {isChatActive && rideStatus !== 'finished' ? (
        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-center text-gray-500 text-sm">
            {rideStatus === 'finished' ? 'Chat closed - Ride completed' : 'Chat is not active'}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSystem; 