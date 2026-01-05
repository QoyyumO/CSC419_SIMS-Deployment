"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@/lib/convex";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import { UserIcon, GroupIcon, UserCircleIcon, TimeIcon } from "@/icons";

// Type for activity log entry
type ActivityLog = {
  _id: Id<"auditLogs">;
  entity: string;
  action: string;
  userId: Id<"users">;
  userEmail: string;
  userName: string;
  timestamp: number;
  details: Record<string, unknown>;
};

export default function AdminDashboardOverview() {
  const stats = useQuery(api.functions.dashboard.getStats);
  const recentActivity = useQuery(api.functions.dashboard.getRecentActivity) as ActivityLog[] | undefined;

  const isLoading = stats === undefined || recentActivity === undefined;

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="Admin Dashboard" />

      {isLoading ? (
        <div className="space-y-6">
          {/* Loading skeleton for stats */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50"
              />
            ))}
          </div>
          {/* Loading skeleton for activity */}
          <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Total Users"
              value={stats.totalUsers}
              icon={<UserIcon className="h-6 w-6 text-brand-500" />}
            />
            <MetricCard
              title="Students"
              value={stats.students}
              icon={<GroupIcon className="h-6 w-6 text-brand-500" />}
            />
            <MetricCard
              title="Instructors"
              value={stats.instructors}
              icon={<UserCircleIcon className="h-6 w-6 text-brand-500" />}
            />
          </div>

          {/* Recent Activity */}
          <ComponentCard title="Recent Activity" desc="Latest system activities">
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No recent activity
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity: ActivityLog) => (
                  <div
                    key={activity._id}
                    className="flex items-start justify-between rounded-lg border border-gray-100 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-white/90">
                          {activity.userName}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({activity.userEmail})
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-medium capitalize">
                          {activity.action}
                        </span>{" "}
                        <span className="lowercase">{activity.entity}</span>
                      </p>
                      {activity.details && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {JSON.stringify(activity.details)}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <TimeIcon className="h-4 w-4" />
                      <span>{formatTimestamp(activity.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ComponentCard>
        </div>
      )}
    </div>
  );
}

