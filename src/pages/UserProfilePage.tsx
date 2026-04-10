import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, User, FileText, Save, LogOut } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { API_BASE_URL } from '../api/config';

interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  initials: string;
}

interface UpdateProfileRequestDto {
  name: string;
  email: string;
  bio: string | null;
}

export default function UserProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateProfileRequestDto>();

  const token = localStorage.getItem('jwt_token');
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await axios.get<UserProfileDto>(`${API_BASE_URL}/api/users/profile`, config);
        reset({
          name: response.data.name,
          email: response.data.email,
          bio: response.data.bio
        });
      } catch (err) {
        console.error('Помилка завантаження профілю:', err);
        setError('Не вдалося завантажити профіль.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [navigate, reset, token]);

  const onSaveProfile = async (data: UpdateProfileRequestDto) => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
const response = await axios.put<UserProfileDto>(`${API_BASE_URL}/api/users/profile`, data, config);
      setProfile(response.data);
      setSuccessMessage('Профіль успішно оновлено! ✨');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Помилка оновлення:', err);
      const serverError = err.response?.data?.[0]?.errorMessage || 
                          err.response?.data?.error || 
                          'Помилка при збереженні даних.';
      setError(serverError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6 md:p-10 flex flex-col items-center">
      <header className="w-full max-w-4xl flex items-center mb-8">
        <button onClick={() => navigate('/chats')} className="mr-4 text-gray-500 hover:text-gray-900 transition-colors p-2 rounded-full hover:bg-white shadow-sm">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Мій кабінет</h1>
      </header>

      <main className="w-full max-w-2xl space-y-8">
        {profile && (
          <div className="bg-white rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-white overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
            <div className="px-8 pb-8 flex flex-col items-center -mt-16">
              <div className="w-32 h-32 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-4xl border-8 border-white shadow-lg mb-4">
                {profile.initials}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
              <p className="text-gray-400 text-sm mb-4">{profile.email}</p>
              {profile.bio && (
                <p className="text-gray-600 text-center italic bg-gray-50 p-4 rounded-2xl border border-gray-100 max-w-md">
                  "{profile.bio}"
                </p>
              )}
            </div>
          </div>
        )}

        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-white">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Налаштування профілю</h3>
          <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-6">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">Ваш Email</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 text-gray-400" size={20} />
                <input 
                  type="email" 
                  placeholder="email@example.com"
                  className={`w-full pl-12 pr-4 py-4 border rounded-2xl bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all ${errors.email ? 'border-red-300' : 'border-gray-100'}`}
                  {...register("email", { 
                    required: "Email обов'язковий",
                    pattern: { value: /^\S+@\S+$/i, message: "Невірний формат email" }
                  })}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-2 pl-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">Ваше ім'я</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  {...register("name", { required: "Ім'я не може бути порожнім" })}
                  className={`w-full pl-12 pr-4 py-4 bg-gray-50 border rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all ${errors.name ? 'border-red-300' : 'border-gray-100'}`} 
                />
              </div>
              {errors.name && <p className="text-xs text-red-500 mt-2 pl-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">Про себе</label>
              <div className="relative">
                <FileText className="absolute left-4 top-4 text-gray-400" size={20} />
                <textarea 
                  {...register("bio")}
                  rows={3}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all resize-none"
                />
              </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{error}</div>}
            {successMessage && <div className="p-4 bg-green-50 text-green-700 rounded-2xl text-sm border border-green-100">{successMessage}</div>}

            <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Save size={20} /> Зберегти</>}
            </button>
          </form>
        </div>

        <button onClick={handleLogout} className="w-full py-4 text-red-500 font-bold bg-white border border-red-50 rounded-2xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
          <LogOut size={20} /> Вийти з акаунта
        </button>
      </main>
    </div>
  );
}