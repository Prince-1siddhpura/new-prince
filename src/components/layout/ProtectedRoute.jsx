import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EduNovaLoadingScreen } from '../common/EduNovaLoadingScreen';
import { UnauthorizedState, getDefaultDashboardRoute } from '../common/UnauthorizedState';

export { getDefaultDashboardRoute };

export const ProtectedRoute = ({
  children,
  allowedRoles = [],
  fallback = 'unauthorized', // 'unauthorized' (shows styled message & auto-redirects) or 'redirect'
}) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // Normalize allowedRoles to array
  const roles = Array.isArray(allowedRoles)
    ? allowedRoles
    : typeof allowedRoles === 'string' && allowedRoles
    ? [allowedRoles]
    : [];

  // Render premium 3D EduNova loading screen during auth checking
  if (loading && !user) {
    return <EduNovaLoadingScreen message="Negotiating with the Wi-Fi… 📶" fullScreen={true} />;
  }

  if (!isAuthenticated && !loading) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 1. Role-based Access Control Check
  if (roles.length > 0 && user && !roles.includes(user.role)) {
    if (fallback === 'redirect') {
      const defaultDashboard = getDefaultDashboardRoute(user.role);
      return <Navigate to={defaultDashboard} replace />;
    }
    return (
      <UnauthorizedState
        allowedRoles={roles}
        currentRole={user.role}
        autoRedirect={true}
      />
    );
  }

  // 2. Check onboarding status exclusively for STUDENT learners
  const isStudent = user?.role === 'STUDENT';
  const onboardingCompleted =
    user?.learnerProfile?.onboardingCompleted ?? user?.onboardingCompleted ?? true;
  if (isStudent && !onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export default ProtectedRoute;
