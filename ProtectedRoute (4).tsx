import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Login } from './Login';
import { BrandMark } from '../ui/BrandMark';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, fallback }) => {
  const { isAuthenticated, loading } = useAuth();

  // Show elegant loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#030712]">
        <div className="text-center">
          <div className="relative">
            <BrandMark size="lg" className="mb-6 inline-grid animate-float" />
            <div className="absolute -inset-8 bg-blue-500/10 rounded-full blur-2xl animate-pulse"></div>
          </div>
          <div className="text-slate-400 font-medium text-lg">Loading your workspace</div>
          <div className="mt-4 w-48 h-1 bg-slate-800 rounded-full overflow-hidden mx-auto">
            <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shimmer"></div>
          </div>
          <div className="mt-2 text-xs text-slate-600">Please wait...</div>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Login onSuccess={() => {}} />;
  }

  // Show protected content
  return <>{children}</>;
};

export default ProtectedRoute;