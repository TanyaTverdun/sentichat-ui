import React, { useState, useEffect, useLayoutEffect, useRef, type UIEvent } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import * as signalR from '@microsoft/signalr';

interface MessageDto {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
  sentiment: string;
}

interface ChatInfo {
  chatId: string;
  name: string;
  initials: string;
  partnerId: string;
  isOnline: boolean; 
}

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null); 
  const hubConnection = useRef<signalR.HubConnection | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingOldMessagesRef = useRef(false);
  const previousScrollHeightRef = useRef<number | null>(null);

  const isInitialLoadRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useLayoutEffect(() => {
    if (previousScrollHeightRef.current !== null && mainScrollRef.current) {
      const scrollDiff = mainScrollRef.current.scrollHeight - previousScrollHeightRef.current;
      mainScrollRef.current.scrollTop += scrollDiff;
      
      previousScrollHeightRef.current = null;
      isFetchingOldMessagesRef.current = false;
      
    } else if (!isFetchingOldMessagesRef.current) {
      const scrollBehavior = isInitialLoadRef.current ? 'auto' : 'smooth';
      scrollToBottom(scrollBehavior);
      if (messages.length > 0) {
        isInitialLoadRef.current = false;
      }
    }
  }, [messages]);

  const fetchMessages = async (beforeDate?: string, appendAtStart: boolean = false) => {
    const token = localStorage.getItem('jwt_token');
    if (!token || !chatId) return;

    try {
      if (appendAtStart) setIsLoadingMore(true);

      let url = `${API_BASE_URL}/api/chats/${chatId}/messages?pageSize=50`;      
      if (beforeDate) {
        url += `&before=${encodeURIComponent(beforeDate)}`;
      }

      const response = await axios.get<MessageDto[]>(url, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      const newMessages = response.data;

      if (newMessages.length < 50) {
        setHasMore(false);
      }

      if (appendAtStart && mainScrollRef.current) {
        isFetchingOldMessagesRef.current = true; 
        previousScrollHeightRef.current = mainScrollRef.current.scrollHeight;

        setMessages(prev => {
          const uniqueNew = newMessages.filter(nm => !prev.some(pm => pm.id === nm.id));
          return [...uniqueNew, ...prev]; 
        });

        setIsLoadingMore(false);

      } else {
        setMessages(newMessages);
      }

    } catch (err) {
      console.error('Помилка завантаження повідомлень:', err);
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e: UIEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.scrollTop <= 2 && hasMore && !isLoadingMore && messages.length > 0) {
      const oldestMessageDate = messages[0].sentAt;
      fetchMessages(oldestMessageDate, true); 
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token || !chatId) {
      navigate('/login');
      return;
    }

    const decoded = parseJwt(token);
    if (decoded) {
      setCurrentUserId(decoded.sub || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']);
    }

    const config = { headers: { Authorization: `Bearer ${token}` } };

    const loadInitialData = async () => {
      try {
        const chatsResponse = await axios.get<ChatInfo[]>(`${API_BASE_URL}/api/chats`, config);
        const currentChat = chatsResponse.data.find(c => c.chatId === chatId || (c as any).id === chatId);
        
        if (currentChat) {
          setChatInfo(currentChat);
          setIsPartnerOnline(currentChat.isOnline);
        }

        setHasMore(true);
        fetchMessages(undefined, false);

      } catch (err) {
        console.error('Помилка завантаження чату:', err);
      }
    };

    loadInitialData();

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/chat`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    connection.start()
      .then(() => {
        connection.invoke("JoinChat", chatId);
        
        connection.on("ReceiveMessage", (message: MessageDto) => {
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            isFetchingOldMessagesRef.current = false; 
            return [...prev, message];
          });
          setIsPartnerTyping(false);
        });

        connection.on("UserStatusChanged", (userId: string, isOnline: boolean) => {
          setChatInfo(prevChat => {
            if (prevChat && prevChat.partnerId?.toLowerCase() === userId?.toLowerCase()) {
              setIsPartnerOnline(isOnline);
            }
            return prevChat;
          });
        });

        connection.on("UserTyping", (senderId: string, typingChatId: string, isTyping: boolean) => {
          if (typingChatId === chatId) {
            setIsPartnerTyping(isTyping);
          }
        });
      })
      .catch(err => console.error('SignalR Connection Error: ', err));

    hubConnection.current = connection;

    return () => {
      if (hubConnection.current) {
        hubConnection.current.stop();
      }
    };
  }, [chatId, navigate]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (hubConnection.current && chatInfo?.partnerId) {
      hubConnection.current.invoke("SendTypingNotification", chatId, chatInfo.partnerId, true);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        if (hubConnection.current && chatInfo?.partnerId) {
          hubConnection.current.invoke("SendTypingNotification", chatId, chatInfo.partnerId, false);
        }
      }, 2000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    if (hubConnection.current && chatInfo?.partnerId) {
      hubConnection.current.invoke("SendTypingNotification", chatId, chatInfo.partnerId, false);
    }

    setIsSending(true);
    const token = localStorage.getItem('jwt_token');

    try {
      const response = await axios.post<MessageDto>(
        `${API_BASE_URL}/api/chats/${chatId}/messages`,
        { content: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages(prev => {
        isFetchingOldMessagesRef.current = false; 
        return [...prev, response.data];
      });
      setNewMessage('');
    } catch (err) {
      console.error('Помилка відправки:', err);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  const getAvatarColor = (name: string | null) => {
    const safeName = name || 'User';
    const colors = ['bg-teal-500', 'bg-purple-500', 'bg-orange-500', 'bg-blue-500', 'bg-pink-500', 'bg-green-500'];
    return colors[safeName.length % colors.length];
  };

  const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
    if (sentiment === 'Positive') return <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full mt-1">😊</span>;
    if (sentiment === 'Negative') return <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full mt-1">😠</span>;
    return null;
  };

  const getMessageBubbleClasses = (isMine: boolean, sentiment: string) => {
    const baseClasses = "max-w-[70%] px-5 py-3 shadow-sm relative rounded-2xl border transition-all duration-300 bg-white";
    let colorClass = "border-gray-100";
    if (sentiment === 'Positive') colorClass = "border-green-400 bg-green-50/30"; 
    else if (sentiment === 'Negative') colorClass = "border-red-400 bg-red-50/30"; 
    else if (isMine) colorClass = "border-purple-200"; 
    const cornerClass = isMine ? "rounded-tr-sm" : "rounded-tl-sm";
    return `${baseClasses} ${colorClass} ${cornerClass} text-gray-800`;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="bg-white px-6 py-3 flex items-center border-b border-gray-100 shadow-sm z-10 shrink-0">
        <button onClick={() => navigate('/chats')} className="mr-4 text-gray-500 hover:text-gray-800 transition-colors p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        {chatInfo && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(chatInfo.name)}`}>
                {chatInfo.initials || '💬'}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full transition-colors duration-500 ${isPartnerOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">{chatInfo.name || 'Невідомий користувач'}</h2>
              <p className="text-xs font-medium transition-all duration-300">
                {isPartnerTyping ? (
                  <span className="text-purple-600 animate-pulse">друкує...</span>
                ) : (
                  <span className="text-gray-500">{isPartnerOnline ? 'у мережі' : 'офлайн'}</span>
                )}
              </p>
            </div>
          </div>
        )}
      </header>

      <main 
        ref={mainScrollRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 relative"
      >
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
        )}

        {messages.length === 0 && !isLoadingMore ? (
          <div className="m-auto text-center text-gray-400 text-sm bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
            Тут поки немає повідомлень. Напишіть щось!
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div className={getMessageBubbleClasses(isMine, msg.sentiment)}>
                  <p className="text-[15px] leading-relaxed text-gray-800">{msg.content}</p>
                </div>
                <div className={`flex items-center gap-2 mt-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-[11px] text-gray-400 font-medium">{formatTime(msg.sentAt)}</span>
                  <SentimentBadge sentiment={msg.sentiment} />
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white p-4 border-t border-gray-100 shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto relative flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder="Напишіть повідомлення..."
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-full py-3.5 pl-6 pr-14 outline-none focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="absolute right-2 w-10 h-10 bg-purple-400 hover:bg-purple-500 text-white flex items-center justify-center rounded-full transition-colors shadow-sm disabled:opacity-50"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </footer>
    </div>
  );
}