import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as signalR from '@microsoft/signalr';

interface ChatListItem {
  id?: string;
  chatId?: string;
  name: string | null;
  initials: string | null;
  lastMessageText: string | null;
  lastMessageTime: string | null;
  partnerId: string;
  isOnline: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  initials: string;
}

interface NewChatFormData {
  targetUserEmail: string;
}

export default function ChatListPage() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  
  const navigate = useNavigate();
  const hubConnection = useRef<signalR.HubConnection | null>(null);

  const { 
    register: registerNewChat, 
    handleSubmit: handleNewChatSubmit, 
    setError: setNewChatError, 
    reset: resetNewChat,
    formState: { errors: newChatErrors } 
  } = useForm<NewChatFormData>();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        navigate('/login');
        return;
      }

      const config = { headers: { Authorization: `Bearer ${token}` } };

      try {
        const [profileResponse, chatsResponse] = await Promise.all([
          axios.get<UserProfile>('https://localhost:7052/api/users/profile', config),
          axios.get<ChatListItem[]>('https://localhost:7052/api/chats', config)
        ]);
        
        setCurrentUser(profileResponse.data);
        setChats(chatsResponse.data);
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.removeItem('jwt_token');
          navigate('/login');
        } else {
          setError('Не вдалося завантажити дані.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7052/hubs/chat", {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    connection.start()
      .then(() => {
        console.log('SignalR Connected on ChatList!');
        
        connection.on("UserStatusChanged", (userId: string, isOnline: boolean) => {
          setChats(prevChats => 
            prevChats.map(chat => 
              chat.partnerId?.toLowerCase() === userId?.toLowerCase() 
                ? { ...chat, isOnline: isOnline } 
                : chat
            )
          );
        });
      })
      .catch(err => console.error('SignalR Connection Error on ChatList: ', err));

    hubConnection.current = connection;

    return () => {
      if (hubConnection.current) {
        hubConnection.current.stop();
      }
    };
  }, []); 

  const onNewChatSubmit = async (data: NewChatFormData) => {
    setIsCreatingChat(true);
    const token = localStorage.getItem('jwt_token');

    try {
      const response = await axios.post(
        'https://localhost:7052/api/chats/personal',
        { targetUserEmail: data.targetUserEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsModalOpen(false);
      resetNewChat();
      
      const targetId = response.data.chatId || response.data.id;
      navigate(`/chats/${targetId}`);
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.Error || 'Не вдалося створити чат.';
      setNewChatError('targetUserEmail', { type: 'server', message: errorMessage });
    } finally {
      setIsCreatingChat(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetNewChat();
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const utcDate = dateString.endsWith('Z') ? date : new Date(dateString + 'Z');
    return utcDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  const getAvatarColor = (name: string | null) => {
    const safeName = name || 'User';
    const colors = ['bg-teal-500', 'bg-purple-500', 'bg-orange-500', 'bg-blue-500', 'bg-pink-500', 'bg-green-500'];
    return colors[safeName.length % colors.length];
  };

  const handleChatClick = (chat: ChatListItem) => {
    const idToUse = chat.chatId || chat.id;
    if (idToUse) {
      navigate(`/chats/${idToUse}`);
    } else {
      console.error("Помилка: У цього чату немає ID!", chat);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col relative">
      <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 relative">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <MessageSquare size={24} fill="currentColor" className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Чати</h1>
            <p className="text-sm text-gray-400">
              {isLoading ? 'Завантаження...' : `${chats.length} розмов`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus size={18} />
            Новий
          </button>
          
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md hover:scale-105 hover:opacity-90 transition-all active:scale-95"
            title="Перейти в мій кабінет"
          >
            {currentUser?.initials || '...'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-8">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
          
          {isLoading && (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full mt-20">
              <span className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></span>
              Завантаження...
            </div>
          )}

          {error && <div className="p-8 text-center text-red-500 mt-20">{error}</div>}

          {!isLoading && !error && chats.length === 0 && (
            <div className="p-12 text-center text-gray-500 mt-10">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-700">У вас ще немає розмов</p>
              <p className="text-sm mt-2">Натисніть "+ Новий", щоб почати спілкування!</p>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {chats.map((chat, index) => (
              <div 
                key={chat.chatId || chat.id || index} 
                className="flex items-center gap-4 p-5 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleChatClick(chat)}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${getAvatarColor(chat.name)}`}>
                    {chat.initials || '💬'}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full transition-colors duration-500 ${chat.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {chat.name || 'Невідомий користувач'}
                  </h3>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {chat.lastMessageText || 'Немає повідомлень'}
                  </p>
                </div>

                <div className="text-xs text-gray-400 flex-shrink-0 mb-auto mt-1">
                  {formatTime(chat.lastMessageTime)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={closeModal}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Новий чат</h2>
            <p className="text-sm text-gray-500 mb-8">Введіть email користувача, з яким хочете почати розмову.</p>

            <form onSubmit={handleNewChatSubmit(onNewChatSubmit)}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email співрозмовника
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  className={`w-full p-4 border rounded-2xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${newChatErrors.targetUserEmail ? 'border-red-500' : 'border-gray-200'}`}
                  {...registerNewChat("targetUserEmail", { 
                    required: "Введіть email",
                    pattern: { value: /^\S+@\S+$/i, message: "Невірний формат email" }
                  })}
                />
                
                {newChatErrors.targetUserEmail && (
                  <span className="text-sm text-red-500 mt-2 block pl-1 font-medium">
                    {newChatErrors.targetUserEmail.message}
                  </span>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 text-gray-700 font-medium py-3.5 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isCreatingChat}
                  className="flex-1 bg-indigo-600 text-white font-medium py-3.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center"
                >
                  {isCreatingChat ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    "Створити"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}