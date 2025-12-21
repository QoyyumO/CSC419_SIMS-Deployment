'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { useSidebar } from '@/context/SidebarContext';
import AppHeader from '@/layout/AppHeader';
import AppSidebar from '@/layout/AppSidebar';
import Backdrop from '@/layout/Backdrop';
import { getUser } from '@/services/users.service';
import { useUserStore } from '@/store/user';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/loading/Loading';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { setUser } = useUserStore();
  const { user: authUser, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !authUser) {
      router.push(
        "/login?errorTitle=Session Expired&errorMessage=You've been logged out automatically. Please re-authenticate."
      );
      return;
    }

    const user = getUser(authUser);
    if (user) {
      setUser(user);
    }
  }, [pathname, setUser, router, authUser, isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!isAuthenticated || !authUser) {
    return null;
  }

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
      ? 'lg:ml-[290px]'
      : 'lg:ml-[90px]';

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader />
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

