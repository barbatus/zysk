import axios from "axios";
import axiosRetry from "axios-retry";

export const apiWithRetry = axios.create();
axiosRetry(apiWithRetry, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay.bind(axiosRetry),
  retryCondition: (err) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(err) ||
      err.code === "ECONNREFUSED" ||
      err.code === "ECONNABORTED"
    );
  },
});
