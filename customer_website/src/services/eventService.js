import { eventApi } from '../api/eventApi';

export const eventService = {
  async like(eventId) {
    const response = await eventApi.like(eventId);
    return response.data;
  },

  async unlike(eventId) {
    const response = await eventApi.unlike(eventId);
    return response.data;
  },

  async comments(eventId) {
    const response = await eventApi.comments(eventId);
    return response.data;
  },

  async postComment(eventId, payload) {
    const response = await eventApi.postComment(eventId, payload);
    return response.data;
  },
};
