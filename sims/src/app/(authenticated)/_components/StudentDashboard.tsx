"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/convex";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { PieChartIcon, TaskIcon, CheckCircleIcon, CalenderIcon } from "@/icons";
import Button from "@/components/ui/button/Button";

type StudentStats = {
  studentProfile: {
    name: string;
    department: string;
    session: string;
    term: string;
    status: string;
  };
  academicStats: {
    gpa: number;
    creditsEarned: number;
    totalCredits: number;
  };
  currentSchedule: Array<{
    courseCode: string;
    courseTitle: string;
    schedule: string;
    room: string;
    instructor: string;
  }>;
};

export default function StudentDashboardView() {
  const router = useRouter();
  // Initialize session token from localStorage using lazy initialization
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sims_session_token");
    }
    return null;
  });

  // Fetch student stats
  const stats = useQuery(
    api.dashboard.getStudentStats,
    sessionToken ? { token: sessionToken } : "skip"
  ) as StudentStats | undefined;

  const isLoading = stats === undefined;

  // Format GPA to 2 decimal places
  const formatGPA = (gpa: number) => {
    return gpa.toFixed(2);
  };

  // Get status badge color
  const getStatusColor = (status: string): "success" | "error" | "primary" | "info" => {
    switch (status.toLowerCase()) {
      case "active":
        return "success";
      case "suspended":
        return "error";
      case "graduated":
        return "primary";
      default:
        return "info";
    }
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="Dashboard" />

      {isLoading ? (
        <div className="space-y-6">
          {/* Loading skeleton for welcome header */}
          <div className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50" />
          {/* Loading skeleton for metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50"
              />
            ))}
          </div>
          {/* Loading skeleton for schedule */}
          <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50" />
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              Welcome back, {stats.studentProfile.name}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {stats.studentProfile.department} | {stats.studentProfile.session}{" "}
              {stats.studentProfile.term}
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="GPA"
              value={formatGPA(stats.academicStats.gpa)}
              icon={<PieChartIcon className="h-6 w-6 text-brand-500" />}
              description={
                stats.academicStats.totalCredits > 0
                  ? `Based on ${stats.academicStats.totalCredits} credits`
                  : "No completed courses yet"
              }
            />
            <MetricCard
              title="Credits Earned"
              value={`${stats.academicStats.creditsEarned} / 120`}
              icon={<TaskIcon className="h-6 w-6 text-brand-500" />}
              description="Total credits completed"
            />
            <div className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </p>
                  <div className="mt-2">
                    <Badge
                      color={getStatusColor(stats.studentProfile.status)}
                      variant="light"
                      size="sm"
                    >
                      {stats.studentProfile.status}
                    </Badge>
                  </div>
                </div>
                <div className="ml-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
                  <CheckCircleIcon className="h-6 w-6 text-brand-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Current Schedule */}
          <ComponentCard
            title="My Classes"
            desc="Your current course schedule"
          >
            {stats.currentSchedule.length === 0 ? (
              <div className="py-12 text-center">
                <CalenderIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <p className="mt-4 text-lg font-medium text-gray-500 dark:text-gray-400">
                  You are not enrolled in any classes
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Browse the course catalog to find courses to enroll in
                </p>
                <Button
                  onClick={() => router.push("/courses")}
                  className="mt-6"
                  variant="primary"
                >
                  Go to Course Catalog
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Course
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Schedule
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Room
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Instructor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stats.currentSchedule.map((course, index) => (
                      <tr
                        key={index}
                        className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-medium text-gray-800 dark:text-white/90">
                              {course.courseCode}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {course.courseTitle}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {course.schedule}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {course.room}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {course.instructor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

