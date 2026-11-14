import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: async (email, password) => {
    // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const response = await api.post('/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  register: async (name, email, password) => {
    const response = await api.post('/users/', {
      name,
      email,
      password,
    });
    return response.data;
  },
};

export const urlAPI = {
  create: async (urlData) => {
    const response = await api.post('/urls/', urlData);
    return response.data;
  },

  getAll: async () => {
    const response = await api.get('/urls/');
    return response.data;
  },

  getInfo: async (id) => {
    const response = await api.get(`/urls/${id}`);
    return response.data;
  },

  update: async (id, urlData) => {
    const response = await api.put(`/urls/${id}`, urlData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/urls/${id}`);
    return response.data;
  },
};

export default api;
