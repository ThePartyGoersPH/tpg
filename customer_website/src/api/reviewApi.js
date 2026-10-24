import { barApi } from './barApi';

export const reviewApi = {
  list: (barId) => barApi.reviews(barId),
  mine: (barId) => barApi.myReview(barId),
  eligibility: (barId) => barApi.reviewEligibility(barId),
  save: (barId, payload) => barApi.submitReview(barId, payload),
  remove: (barId) => barApi.deleteReview(barId),
};
