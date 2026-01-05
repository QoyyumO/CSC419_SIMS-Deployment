'use client';
import Link from 'next/link';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/convex';
import { Id } from '@/../convex/_generated/dataModel';
import { Dropdown } from '../ui/dropdown/Dropdown';
import { DropdownItem } from '../ui/dropdown/DropdownItem';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  
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
  ) as Array<{
    _id: string;
    message: string;
    read: boolean;
    createdAt: number;
    courseId?: string;
  }> | undefined;

  // Mutation to mark notification as read
  const markAsRead = useMutation(api.functions.notifications.markAsRead);

  // Fetch unread count
  const unreadCount = useQuery(
    api.functions.notifications.getUnreadCount,
    sessionToken ? { token: sessionToken } : 'skip'
  ) as number | undefined;

  // Check if there are unread notifications
  const hasUnread = useMemo(() => {
    return (unreadCount ?? 0) > 0;
  }, [unreadCount]);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleClick = () => {
    toggleDropdown();
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} min ago`;
    } else {
      return 'Just now';
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: {
    _id: string;
    message: string;
    read: boolean;
    createdAt: number;
    courseId?: string;
  }) => {
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

    // Close dropdown
    closeDropdown();

    // Redirect to grades page with courseId if available
    if (notification.courseId) {
      router.push(`/grades?courseId=${notification.courseId}`);
    } else {
      router.push('/grades');
    }
  };
  return (
    <div className="relative">
      <button
        className="dropdown-toggle relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleClick}
      >
        {hasUnread && (
          <span className="absolute top-0.5 right-0 z-10 h-2 w-2 rounded-full bg-red-500 flex">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
          </span>
        )}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="shadow-theme-lg dark:bg-gray-dark absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 sm:w-[361px] lg:right-0 dark:border-gray-800"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notification
          </h5>
          <button
            onClick={toggleDropdown}
            className="dropdown-toggle text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className="fill-current"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <ul className="custom-scrollbar flex h-auto flex-col overflow-y-auto">
          {notifications === undefined ? (
            <li className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              Loading notifications...
            </li>
          ) : notifications.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              No notifications
            </li>
          ) : (
            notifications.map((notification) => (
              <li key={notification._id}>
                <DropdownItem
                  onItemClick={() => handleNotificationClick(notification)}
                  className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 cursor-pointer ${
                    !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <span className="relative z-1 block h-10 w-full max-w-10 rounded-full">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/20">
                      <svg
                        className="h-5 w-5 text-brand-500 dark:text-brand-400"
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
                      <span className="bg-brand-500 absolute right-0 bottom-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white dark:border-gray-900"></span>
                    )}
                  </span>

                  <span className="block flex-1">
                    <span className="text-theme-sm mb-1.5 block text-gray-800 dark:text-white/90">
                      {notification.message}
                    </span>
                    <span className="text-theme-xs flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <span>{formatTimeAgo(notification.createdAt)}</span>
                    </span>
                  </span>
                </DropdownItem>
              </li>
            ))
          )}
        </ul>
        <Link
          href="/notifications"
          className="mt-3 block rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          View All Notifications
        </Link>
      </Dropdown>
    </div>
  );
}
