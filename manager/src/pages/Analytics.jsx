import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Eye } from 'lucide-react';
import { analyticsApi } from '../api/analyticsApi';
import { barApi } from '../api/barApi';
import { inventoryApi } from '../api/inventoryApi';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Analytics = () => {
  const [dashboard, setDashboard] = useState(null);
  const [visits, setVisits] = useState(null);
  const [followersData, setFollowersData] = useState(null);
  const [reviewsData, setReviewsData] = useState(null);
  const [customerInsights, setCustomerInsights] = useState([]);
  const [salesSummary, setSalesSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { load(); }, []);

  const toArray = (value, keys = []) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key];
    }
    return [];
  };

  const toObject = (value, keys = []) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return null;
    for (const key of keys) {
      const candidate = value[key];
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const load = async () => {
    try {
      const results = await Promise.allSettled([
        analyticsApi.dashboard(),
        analyticsApi.visits(),
        analyticsApi.reviews(),
        barApi.getFollowers(), // Use bar followers API to get real count
        barApi.getCustomerInsights(),
        inventoryApi.salesSummary(),
      ]);

      if (results[0].status === 'fulfilled') {
        const payload = results[0].value.data?.data || results[0].value.data;
        setDashboard(toObject(payload, ['dashboard', 'data']));
      } else {
        setDashboard(null);
      }

      if (results[1].status === 'fulfilled') {
        const payload = results[1].value.data?.data || results[1].value.data;
        setVisits(toObject(payload, ['visits', 'data']));
      } else {
        setVisits(null);
      }

      if (results[3].status === 'fulfilled') {
        const payload = results[3].value.data?.data || results[3].value.data;
        // Map bar API follower payload to analytics widget fields
        setFollowersData({
          total_followers: payload?.follower_count || 0,
          total: payload?.follower_count || 0,
          new_followers: 0, // Not provided by this endpoint
          new_this_month: 0,
        });
      } else {
        setFollowersData(null);
      }

      if (results[2].status === 'fulfilled') {
        const payload = results[2].value.data?.data || results[2].value.data;
        setReviewsData({
          total_reviews: payload?.total_reviews || 0,
          total: payload?.total_reviews || 0,
          average_rating: payload?.average_rating || '0.0',
          rating: payload?.average_rating || '0.0',
        });
      } else {
        setReviewsData(null);
      }

      if (results[4].status === 'fulfilled') {
        const payload = results[4].value.data?.data || results[4].value.data;
        setCustomerInsights(toArray(payload, ['customers', 'data', 'items']));
      } else {
        setCustomerInsights([]);
      }

      if (results[5].status === 'fulfilled') {
        const payload = results[5].value.data?.data || results[5].value.data;
        setSalesSummary(payload || null);
      } else {
        setSalesSummary(null);
      }

      const allFailed = results.every((result) => result.status === 'rejected');
      setLoadError(allFailed ? 'Analytics data is temporarily unavailable.' : '');
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="card py-3" style={{ borderColor: 'rgba(204,0,0,0.3)', borderLeft: '3px solid #CC0000', background: 'rgba(204,0,0,0.06)' }}>
          <p className="text-sm" style={{ color: '#ff6666' }}>{loadError}</p>
        </div>
      )}

      {/* Sales Summary */}
      {salesSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs" style={{ color: '#888' }}>Today's Revenue</p>
            <p className="text-2xl font-extrabold" style={{ color: '#CC0000' }}>₱{Number(salesSummary.today?.revenue || 0).toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: '#555' }}>{salesSummary.today?.count || 0} transactions</p>
          </div>
          <div className="card">
            <p className="text-xs" style={{ color: '#888' }}>This Week</p>
            <p className="text-2xl font-extrabold" style={{ color: '#60a5fa' }}>₱{Number(salesSummary.week?.revenue ?? salesSummary.this_week?.total_revenue ?? 0).toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: '#555' }}>{salesSummary.week?.count ?? salesSummary.this_week?.total_transactions ?? 0} transactions</p>
          </div>
          <div className="card">
            <p className="text-xs" style={{ color: '#888' }}>This Month</p>
            <p className="text-2xl font-extrabold" style={{ color: '#4ade80' }}>₱{Number(salesSummary.month?.revenue ?? salesSummary.this_month?.total_revenue ?? 0).toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: '#555' }}>{salesSummary.month?.count ?? salesSummary.this_month?.total_transactions ?? 0} transactions</p>
          </div>
          <div className="card">
            <p className="text-xs" style={{ color: '#888' }}>Best Seller</p>
            <p className="text-lg font-bold text-white">{salesSummary.best_seller?.name || '—'}</p>
            <p className="text-xs mt-1" style={{ color: '#555' }}>{salesSummary.best_seller?.total_qty || 0} sold</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Insights */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-white">Top Customers</h3>
          </div>
          <div className="space-y-2">
            {(Array.isArray(customerInsights) ? customerInsights : []).slice(0, 10).map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>{i + 1}</span>
                  <span className="text-sm" style={{ color: '#ccc' }}>{c.first_name} {c.last_name}</span>
                </div>
                <span className="text-xs font-medium" style={{ color: '#666' }}>{c.reservation_count || c.visit_count || 0} visits</span>
              </div>
            ))}
            {(!customerInsights || customerInsights.length === 0) && <p className="text-sm" style={{ color: '#555' }}>No data yet.</p>}
          </div>
        </div>

        {/* Reviews */}
        {reviewsData && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-white">Review Analytics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(249,115,22,0.08)' }}>
                <p className="text-2xl font-extrabold" style={{ color: '#fb923c' }}>{reviewsData.total_reviews || reviewsData.total || 0}</p>
                <p className="text-xs mt-1" style={{ color: '#fb923c', opacity: 0.7 }}>Total Reviews</p>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(249,115,22,0.08)' }}>
                <p className="text-2xl font-extrabold" style={{ color: '#fb923c' }}>{reviewsData.average_rating || reviewsData.rating || 0}</p>
                <p className="text-xs mt-1" style={{ color: '#fb923c', opacity: 0.7 }}>Avg Rating</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Visits & Followers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visits && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-purple-500" />
              <h3 className="font-bold text-white">Visit Analytics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(168,85,247,0.08)' }}>
                <p className="text-2xl font-extrabold" style={{ color: '#c084fc' }}>{visits.total_visits || visits.total || 0}</p>
                <p className="text-xs mt-1" style={{ color: '#c084fc', opacity: 0.7 }}>Total Visits</p>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(168,85,247,0.08)' }}>
                <p className="text-2xl font-extrabold" style={{ color: '#c084fc' }}>{visits.unique_visitors || visits.unique || 0}</p>
                <p className="text-xs mt-1" style={{ color: '#c084fc', opacity: 0.7 }}>Unique Visitors</p>
              </div>
            </div>
          </div>
        )}

        {followersData && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary-500" />
              <h3 className="font-bold text-white">Follower Analytics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(204,0,0,0.08)' }}>
                <p className="text-2xl font-extrabold" style={{ color: '#CC0000' }}>{followersData.total_followers || followersData.total || 0}</p>
                <p className="text-xs mt-1" style={{ color: '#CC0000', opacity: 0.7 }}>Total Followers</p>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(204,0,0,0.08)' }}>
                <p className="text-2xl font-extrabold" style={{ color: '#CC0000' }}>{followersData.new_followers || followersData.new_this_month || 0}</p>
                <p className="text-xs mt-1" style={{ color: '#CC0000', opacity: 0.7 }}>New This Month</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
