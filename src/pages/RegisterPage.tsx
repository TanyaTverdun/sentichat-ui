import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { User, Mail, Lock, UserPlus, HelpCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const { register, handleSubmit, setError: setFieldError, formState: { errors } } = useForm<RegisterFormData>();
  
  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, data);      const token = response.data.token;
      localStorage.setItem('jwt_token', token);
      
      console.log('Реєстрація успішна! Токен збережено.');
      
      navigate('/chats');
      
    } catch (err: any) {
      if (err.response?.data?.errors) {
        const validationErrors = err.response.data.errors;
        
        Object.keys(validationErrors).forEach((key) => {
          const fieldName = (key.charAt(0).toLowerCase() + key.slice(1)) as keyof RegisterFormData;
          const errorMessage = validationErrors[key][0]; 
          setFieldError(fieldName, { type: 'server', message: errorMessage });
        });

        setError('Будь ласка, виправте помилки в полях нижче.');
      } 
      else if (err.response?.data?.error || err.response?.data?.Error) {
        setError(err.response.data.error || err.response.data.Error);
      } 
      else {
        setError('Не вдалося з\'єднатися з сервером. Спробуйте пізніше.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-blue-700 p-12 text-white flex-col justify-between relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-16">
            <div className="bg-white/20 p-2 rounded-xl">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-2xl font-bold">SentyChat</span>
          </div>

          <h1 className="text-5xl font-bold leading-tight mb-6">
            Спілкуйтесь<br />без обмежень
          </h1>
          <p className="text-blue-100 text-lg max-w-md mb-12">
            Сучасний месенджер з аналізом тональності повідомлень.
          </p>

          <div className="space-y-4 max-w-sm">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl rounded-tl-none p-4 text-sm w-fit border border-white/20 shadow-lg">
              Привіт! Як справи?
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-2xl rounded-tr-none p-4 text-sm w-fit ml-auto border border-white/20 shadow-lg">
              Все чудово, дякую!
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl rounded-tl-none p-4 text-sm w-fit border border-white/20 shadow-lg">
              Круто! Давай зустрінемось
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
        <button className="absolute bottom-8 right-8 w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg">
          <HelpCircle size={20} />
        </button>

        <div className="max-w-md w-full">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Створити акаунт</h2>
          <p className="text-gray-500 mb-8">Заповніть форму для реєстрації</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ім'я</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Ваше ім'я"
                  className={`pl-10 w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${errors.name ? 'border-red-500' : 'border-gray-200'}`}
                  {...register("name", { required: "Ім'я обов'язкове", maxLength: 100 })}
                />
              </div>
              {errors.name && <span className="text-xs text-red-500 mt-1 block">{errors.name.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Електронна пошта</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  placeholder="email@example.com"
                  className={`pl-10 w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${errors.email ? 'border-red-500' : 'border-gray-200'}`}
                  {...register("email", { 
                    required: "Email обов'язковий",
                    pattern: { value: /^\S+@\S+$/i, message: "Невірний формат email" }
                  })}
                />
              </div>
              {errors.email && <span className="text-xs text-red-500 mt-1 block">{errors.email.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  placeholder="Мінімум 6 символів"
                  className={`pl-10 w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${errors.password ? 'border-red-500' : 'border-gray-200'}`}
                  {...register("password", { 
                    required: "Пароль обов'язковий",
                    minLength: { value: 6, message: "Мінімум 6 символів" },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W]).{6,}$/,
                      message: "Пароль має містити велику та малу літеру, цифру та спецсимвол"
                    }
                  })}
                />
              </div>
              {errors.password && <span className="text-xs text-red-500 mt-1 block">{errors.password.message}</span>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center font-medium shadow-md disabled:opacity-70 mt-4"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Зареєструватися
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            Вже є акаунт? <a href="/login" className="text-indigo-600 font-semibold hover:underline">Увійти</a>
          </div>
        </div>
      </div>
    </div>
  );
}