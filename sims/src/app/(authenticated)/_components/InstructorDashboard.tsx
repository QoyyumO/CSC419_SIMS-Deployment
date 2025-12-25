"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/convex";
import { Id } from "@/lib/convex";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import { FileIcon, GroupIcon, TimeIcon } from "@/icons";
import Button from "@/components/ui/button/Button";

type Section = {
  _id: Id<"sections">;
  courseTitle: string;
  courseCode: string;
  currentEnrollment: number;
  capacity: number;
  schedule: string;
  scheduleSlots: Array<{
    day: string;
    startTime: string;
    endTime: string;
    room: string;
  }>;
};

export default function InstructorDashboard() {
  const router = useRouter();
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sims_session_token");
    }
    return null;
  });

  // Fetch instructor dashboard data
  const sections = useQuery(
    api.instructors.getDashboard,
    sessionToken ? { token: sessionToken } : "skip"
  ) as Section[] | undefined;

  const isLoading = sections === undefined;

  const handleSectionClick = (sectionId: Id<"sections">) => {
    router.push(`/sections/${sectionId}`);
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="Instructor Dashboard" />

      {isLoading ? (
        <div className="space-y-6">
          {/* Loading skeleton */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50"
              />
            ))}
          </div>
        </div>
      ) : sections ? (
        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              My Classes
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage your course sections and view student rosters
            </p>
          </div>

          {/* Section Cards */}
          {sections.length === 0 ? (
            <ComponentCard
              title="No Active Sections"
              desc="You don't have any sections assigned for the current term"
            >
              <div className="py-12 text-center">
                <FileIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <p className="mt-4 text-lg font-medium text-gray-500 dark:text-gray-400">
                  No sections found
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Contact your department head if you expect to have sections assigned
                </p>
              </div>
            </ComponentCard>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((section) => (
                <div
                  key={section._id}
                  className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-brand-500 hover:shadow-lg dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500"
                  onClick={() => handleSectionClick(section._id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <FileIcon className="h-5 w-5 text-brand-500" />
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                          {section.courseCode}
                        </h3>
                      </div>
                      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                        {section.courseTitle}
                      </p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <GroupIcon className="h-4 w-4" />
                          <span>
                            {section.currentEnrollment} / {section.capacity} students
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <TimeIcon className="h-4 w-4" />
                          <span>{section.schedule || "TBA"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full"
                      onClick={(e) => {
                        e?.stopPropagation();
                        handleSectionClick(section._id);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

