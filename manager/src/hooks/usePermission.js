import useAuthStore from '../stores/authStore';

export const usePermission = () => {
  const { permissions, user, hasPermission } = useAuthStore();

  const isOwner = user?.role === 'bar_owner';
  const isManager = user?.role === 'manager';
  const isHR = user?.role === 'hr';
  const isStaff = user?.role === 'staff';
  const isCashier = user?.role === 'cashier';

  const can = (requiredPermissions) => {
    return hasPermission(
      Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions]
    );
  };

  return { permissions, user, isOwner, isManager, isHR, isStaff, isCashier, can };
};
