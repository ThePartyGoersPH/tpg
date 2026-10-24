import client from './client';

export const feedWidgetsApi = {
  activeBars: (hours = 48) => client.get(`/feed-widgets/active-bars?hours=${hours}`),
  quickStats: () => client.get('/feed-widgets/quick-stats'),
  hotTonight: () => client.get('/feed-widgets/hot-tonight'),
  genreTags: () => client.get('/feed-widgets/genre-tags'),
  barCities: () => client.get('/feed-widgets/bar-cities'),
};
