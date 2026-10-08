import apiClient from './client';

export const eventApi = {
  like: (eventId) => apiClient.post(`/social/events/${eventId}/like`),
  unlike: (eventId) => apiClient.delete(`/social/events/${eventId}/like`),
  likeStatus: (eventId) => apiClient.get(`/social/events/${eventId}/like`),
  comments: (eventId) => apiClient.get(`/social/events/${eventId}/comments`),
  postComment: (eventId, payload) => apiClient.post(`/social/events/${eventId}/comments`, payload),
};
