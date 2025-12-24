"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@/lib/convex";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import { UserIcon, GroupIcon, FileIcon } from "@/icons";

type DashboardStats = {
  totalInstructors: number;
  activeSections: number;
  unassignedSections: number;
};

type Section = {
  _id: Id<"sections">;
  courseCode: string;
  courseTitle: string;
  sectionId: Id<"sections">;
  instructorId: Id<"users"> | null;
  instructorName: string;
  capacity: number;
  enrollmentCount: number;
  status: string;
  termId: Id<"terms">;
  termName: string;
};

type Term = {
  _id: Id<"terms">;
  name: string;
  sessionId: Id<"academicSessions">;
  startDate: number;
  endDate: number;
};

export default function DepartmentHeadDashboard() {
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sims_session_token");
    }
    return null;
  });


  // Fetch dashboard stats
  const stats = useQuery(
    api.department.getDashboardStats,
    sessionToken ? { token: sessionToken } : "skip"
  ) as DashboardStats | undefined;

  // Fetch sections
  const sections = useQuery(
    api.department.getSections,
    sessionToken
      ? {
          token: sessionToken,
        }
      : "skip"
  ) as Section[] | undefined;

  // Fetch terms for filter
  const terms = useQuery(api.department.getTerms) as Term[] | undefined;

  const isLoading = stats === undefined || sections === undefined || terms === undefined;

  // Calculate assignment progress percentage
  const assignmentProgress = stats
    ? stats.activeSections + stats.unassignedSections > 0
      ? Math.round((stats.activeSections / (stats.activeSections + stats.unassignedSections)) * 100)
      : 0
    : 0;

  return (
    <div>
      <PageBreadCrumb pageTitle="Department Dashboard" />

      {isLoading ? (
        <div className="space-y-6">
          {/* Loading skeleton */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50"
              />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50" />
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Total Instructors"
              value={stats.totalInstructors}
              icon={<UserIcon className="h-6 w-6 text-brand-500" />}
              description="Instructors teaching in your department"
            />
            <MetricCard
              title="Active Sections"
              value={stats.activeSections}
              icon={<FileIcon className="h-6 w-6 text-brand-500" />}
              description="Sections with assigned instructors"
            />
          <MetricCard
            title="Unassigned Sections"
            value={stats.unassignedSections}
            icon={<GroupIcon className="h-6 w-6 text-brand-500" />}
            description="Sections needing instructor assignment"
          />
        </div>

        {/* Assignment Progress Bar */}
        <ComponentCard title="Assignment Progress" desc="Track section assignment completion">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sections Assigned: {assignmentProgress}%
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {stats.activeSections} / {stats.activeSections + stats.unassignedSections}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-brand-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${assignmentProgress}%` }}
              />
            </div>
          </div>
        </ComponentCard>
      </div>
      ) : (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium mb-2">Unable to load dashboard</p>
          <p className="text-sm">Please try refreshing the page</p>
        </div>
      )}
    </div>
  );
}

