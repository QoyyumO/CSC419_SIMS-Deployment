'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Loading from '@/components/loading/Loading';
import Badge from '@/components/ui/badge/Badge';
import Button from '@/components/ui/button/Button';
import { Id } from '@/../convex/_generated/dataModel';

type Notification = {
  _id: string;
  message: string;
  read: boolean;
  createdAt: number;
  courseId?: string;
};

type FilterType = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  // Fetch notifications
  const notifications = useQuery(
    api.functions.notifications.getMyNotifications,
    sessionToken ? { token: sessionToken } : 'skip'
  ) as Notification[] | undefined;

  // Mutations
  const markAsRead = useMutation(api.functions.notifications.markAsRead);
  const markMultipleAsRead = useMutation(api.functions.notifications.markMultipleAsRead);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    
    switch (filter) {
      case 'unread':
        return notifications.filter((n) => !n.read);
      case 'read':
        return notifications.filter((n) => n.read);
      default:
        return notifications;
    }
  }, [notifications, filter]);

  // Counts
  const unreadCount = useMemo(() => {
    return notifications?.filter((n) => !n.read).length ?? 0;
  }, [notifications]);

  const readCount = useMemo(() => {
    return notifications?.filter((n) => n.read).length ?? 0;
  }, [notifications]);

  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (weeks > 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} min ago`;
    } else {
      return 'Just now';
    }
  };

  // Format full date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.read && sessionToken) {
      try {
        await markAsRead({
          notificationId: notification._id as Id<"notifications">,
          token: sessionToken,
        });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate based on notification type
    if (notification.courseId && notification.message.includes('New grade posted')) {
      router.push(`/grades?courseId=${notification.courseId}`);
    } else {
      // Default navigation or stay on page
      router.push('/grades');
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    if (!sessionToken || !notifications) return;

    const unreadIds = notifications
      .filter((n) => !n.read)
      .map((n) => n._id as Id<"notifications">);

    if (unreadIds.length > 0) {
      try {
        await markMultipleAsRead({
          notificationIds: unreadIds,
          token: sessionToken,
        });
      } catch (error) {
        console.error('Error marking all as read:', error);
      }
    }
  };

  const isLoading = notifications === undefined;

  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Notifications" />
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Notifications" />

      <div className="space-y-6">
        {/* Header with filters and actions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
                Notifications
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {notifications?.length ?? 0} total • {unreadCount} unread
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filter buttons */}
              <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={() => setFilter('all')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter('read')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === 'read'
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  Read ({readCount})
                </button>
              </div>

              {/* Mark all as read button */}
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                >
                  Mark All as Read
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications list */}
        {filteredNotifications.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg
                  className="h-8 w-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No {filter === 'all' ? '' : filter} notifications
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {filter === 'all'
                  ? "You don't have any notifications yet."
                  : filter === 'unread'
                  ? "You're all caught up! No unread notifications."
                  : "You haven't read any notifications yet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                className={`cursor-pointer rounded-2xl border border-gray-200 bg-white transition-all hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03] ${
                  !notification.read
                    ? 'border-l-4 border-l-brand-500 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          !notification.read
                            ? 'bg-brand-100 dark:bg-brand-900/20'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        <svg
                          className={`h-5 w-5 ${
                            !notification.read
                              ? 'text-brand-500 dark:text-brand-400'
                              : 'text-gray-400'
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      {!notification.read && (
                        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500 dark:border-gray-800"></span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p
                            className={`text-sm ${
                              !notification.read
                                ? 'font-semibold text-gray-900 dark:text-white'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {notification.message}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatTimeAgo(notification.createdAt)}</span>
                            <span>•</span>
                            <span>{formatDate(notification.createdAt)}</span>
                          </div>
                        </div>

                        {/* Badge and actions */}
                        <div className="flex items-center gap-2">
                          {!notification.read && (
                            <Badge color="info" variant="light" size="sm">
                              New
                            </Badge>
                          )}
                          {notification.courseId && (
                            <Badge color="success" variant="light" size="sm">
                              Grade
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

