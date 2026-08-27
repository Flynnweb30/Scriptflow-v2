import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useFirebase } from '../../hooks/useFirebase';

interface DashboardStats {
  totalItems: number;
  recentActivity: Array<{
    id: string;
    type: string;
    timestamp: string;
  }>;
}

export const Dashboard: React.FC = () => {
  const { user, userName, userEmail } = useAuth();
  const { readDocuments, loading } = useFirebase();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    recentActivity: [],
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const items = await readDocuments('contacts', []);
      setStats({
        totalItems: items.length,
        recentActivity: items.slice(0, 5).map((item: any) => ({
          id: item.id,
          type: item.name || 'contact',
          timestamp: item.createdAt || new Date().toISOString(),
        })),
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <span className="text-sm text-slate-400">
          Welcome back, {userName || userEmail}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Total Contacts</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold text-white mt-2">
            {loading ? '...' : stats.totalItems}
          </p>
        </div>

        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Status</span>
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-lg font-medium text-green-400 mt-2">Active</p>
        </div>

        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Account</span>
            <span className="text-2xl">👤</span>
          </div>
          <p className="text-lg font-medium text-blue-400 mt-2 truncate">
            {userEmail}
          </p>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        {loading ? (
          <div className="text-slate-400">Loading...</div>
        ) : stats.recentActivity.length === 0 ? (
          <div className="text-slate-400">No recent activity. Add your first contact!</div>
        ) : (
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                <span className="text-slate-300 capitalize">Added {activity.type}</span>
                <span className="text-sm text-slate-500">
                  {new Date(activity.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;