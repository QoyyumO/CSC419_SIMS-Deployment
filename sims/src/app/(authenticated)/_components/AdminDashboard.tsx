"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@/lib/convex";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Loading from "@/components/loading/Loading";
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

  // Format activity message into user-friendly text
  const formatActivityMessage = (activity: ActivityLog): string => {
    const { entity, action, details } = activity;
    
    // Handle grade-related actions
    if (entity === "grade" || entity === "enrollment") {
      if (action === "GradeEdited" || action === "CourseGradePosted") {
        const previousGrade = details?.previousGrade as string | undefined;
        const newGrade = details?.newGrade as string | undefined;
        const courseCode = details?.courseCode as string | undefined;
        const courseTitle = details?.courseTitle as string | undefined;
        
        if (previousGrade && newGrade) {
          const courseInfo = courseCode || courseTitle 
            ? ` in ${courseCode || courseTitle}` 
            : "";
          return `Grade changed from ${previousGrade} to ${newGrade}${courseInfo}`;
        } else if (newGrade) {
          const courseInfo = courseCode || courseTitle 
            ? ` in ${courseCode || courseTitle}` 
            : "";
          return `Grade posted: ${newGrade}${courseInfo}`;
        }
      }
      
      if (action === "StudentEnrolled") {
        const courseCode = details?.courseCode as string | undefined;
        const courseTitle = details?.courseTitle as string | undefined;
        const sectionName = details?.sectionName as string | undefined;
        const studentName = details?.studentName as string | undefined;
        
        if (studentName && (courseCode || courseTitle)) {
          return `${studentName} enrolled in ${courseCode || courseTitle}${sectionName ? ` (${sectionName})` : ""}`;
        } else if (courseCode || courseTitle) {
          return `Student enrolled in ${courseCode || courseTitle}${sectionName ? ` (${sectionName})` : ""}`;
        }
      }
      
      if (action === "StudentDropped") {
        const courseCode = details?.courseCode as string | undefined;
        const courseTitle = details?.courseTitle as string | undefined;
        const studentName = details?.studentName as string | undefined;
        
        if (studentName && (courseCode || courseTitle)) {
          return `${studentName} dropped ${courseCode || courseTitle}`;
        } else if (courseCode || courseTitle) {
          return `Student dropped ${courseCode || courseTitle}`;
        }
      }
    }
    
    // Handle user-related actions
    if (entity === "user") {
      if (action === "UserRoleChanged") {
        const previousRole = details?.previousRole as string | undefined;
        const newRole = details?.newRole as string | undefined;
        const userName = details?.userName as string | undefined;
        
        if (previousRole && newRole) {
          const name = userName ? `${userName}'s ` : "";
          return `${name}Role changed from ${previousRole} to ${newRole}`;
        }
      }
      
      if (action === "StudentCreated" || action === "StudentUpdated") {
        const studentName = details?.studentName as string | undefined;
        const actionText = action === "StudentCreated" ? "created" : "updated";
        return studentName 
          ? `Student ${studentName} ${actionText}`
          : `Student ${actionText}`;
      }
    }
    
    // Handle course-related actions
    if (entity === "course") {
      const courseCode = details?.courseCode as string | undefined;
      const courseTitle = details?.courseTitle as string | undefined;
      const courseName = courseCode || courseTitle || "course";
      
      if (action === "CourseCreated") {
        return `Course ${courseName} created`;
      }
      if (action === "CourseUpdated") {
        return `Course ${courseName} updated`;
      }
    }
    
    // Handle section-related actions
    if (entity === "section") {
      const sectionName = details?.sectionName as string | undefined;
      const courseCode = details?.courseCode as string | undefined;
      const sectionInfo = sectionName || courseCode || "section";
      
      if (action === "SectionCreated") {
        return `Section ${sectionInfo} created`;
      }
      if (action === "SectionUpdated") {
        return `Section ${sectionInfo} updated`;
      }
      if (action === "SectionCancelled") {
        return `Section ${sectionInfo} cancelled`;
      }
    }
    
    // Handle assessment-related actions
    if (entity === "assessment") {
      const assessmentName = details?.assessmentName as string | undefined;
      const assessmentTitle = details?.title as string | undefined;
      const name = assessmentName || assessmentTitle || "assessment";
      
      if (action === "AssessmentCreated") {
        return `Assessment "${name}" created`;
      }
      if (action === "AssessmentUpdated") {
        return `Assessment "${name}" updated`;
      }
    }
    
    // Handle graduation actions
    if (entity === "graduation") {
      if (action === "GraduationApproved") {
        const studentName = details?.studentName as string | undefined;
        return studentName 
          ? `Graduation approved for ${studentName}`
          : "Graduation approved";
      }
    }
    
    // Handle program actions
    if (entity === "program") {
      const programName = details?.programName as string | undefined;
      const name = programName || "program";
      
      if (action === "ProgramCreated") {
        return `Program ${name} created`;
      }
      if (action === "ProgramUpdated") {
        return `Program ${name} updated`;
      }
    }
    
    // Default fallback: format action and entity nicely
    const actionText = action
      .replace(/([A-Z])/g, " $1")
      .trim()
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
    
    const entityText = entity.charAt(0).toUpperCase() + entity.slice(1);
    
    return `${actionText} ${entityText}`;
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="Admin Dashboard" />

      {isLoading ? (
        <Loading />
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
                        {formatActivityMessage(activity)}
                      </p>
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

