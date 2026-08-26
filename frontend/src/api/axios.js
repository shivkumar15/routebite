import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 10000,
});

export default api;
