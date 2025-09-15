import axios from "axios";

export const lambdaApi = axios.create({
  baseURL: import.meta.env.VITE_LAMBDA_URL,
});