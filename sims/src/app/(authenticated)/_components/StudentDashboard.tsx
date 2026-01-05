"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/convex";
import { Id } from "@/lib/convex";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import MetricCard from "@/components/common/MetricCard";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { PieChartIcon, TaskIcon, CheckCircleIcon, CalenderIcon, AlertIcon } from "@/icons";
import Button from "@/components/ui/button/Button";
import WeeklyCalendarView from "./WeeklyCalendarView";
import { Modal } from "@/components/ui/modal";
import Alert from "@/components/ui/alert/Alert";
import { useAuth } from "@/hooks/useAuth";
import { useHasRole } from "@/hooks/useHasRole";
import Link from "next/link";

type ScheduleSlot = {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
};

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
    enrollmentId: string;
    enrollmentStatus: string;
    courseCode: string;
    courseTitle: string;
    schedule: string;
    scheduleSlots: ScheduleSlot[];
    room: string;
    instructor: string;
  }>;
};

export default function StudentDashboardView() {
  const router = useRouter();
  const { user } = useAuth();
  const isRegistrar = useHasRole('registrar');
  
  // Initialize session token from localStorage using lazy initialization
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sims_session_token");
    }
    return null;
  });

  const [showDropModal, setShowDropModal] = useState(false);
  const [courseToDrop, setCourseToDrop] = useState<{ enrollmentId: string; courseCode: string; courseTitle: string } | null>(null);
  const [droppingEnrollmentId, setDroppingEnrollmentId] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropSuccess, setDropSuccess] = useState(false);

  // Fetch student stats
  const stats = useQuery(
    api.dashboard.getStudentStats,
    sessionToken ? { token: sessionToken } : "skip"
  ) as StudentStats | undefined;

  // Fetch transcript data to get the official GPA from transcript table
  const transcriptData = useQuery(
    api.transcript.getFullHistory,
    sessionToken ? { token: sessionToken } : "skip"
  ) as {
    cumulativeGPA: number;
    groupedData: Record<string, Array<{
      courseCode: string;
      courseTitle: string;
      credits: number;
      grade: {
        percentage: number;
        letter: string;
        points: number;
      };
    }>>;
    termGPAs: Record<string, number>;
    studentInfo: {
      studentNumber: string;
      name: string;
      departmentId: string;
      departmentName: string;
    };
  } | undefined | Error;

  // @ts-expect-error - Convex API path with slashes
  const dropCourseMutation = useMutation(api["mutations/enrollmentMutations"].dropCourse);

  // Get student record to get studentId for graduation check
  type UserProfile = {
    student?: {
      _id: Id<'students'>;
      studentNumber: string;
      admissionYear: number;
      level: string;
      status: string;
      department?: {
        _id: Id<'departments'>;
        name: string;
      } | null;
    };
  };

  const studentRecord = useQuery(
    api.users.getProfile,
    user?._id ? { userId: user._id } : "skip"
  ) as UserProfile | undefined;

  const studentId = studentRecord?.student?._id;

  // State for graduation eligibility
  const [graduationEligibility, setGraduationEligibility] = useState<{
    eligible: boolean;
    missingRequirements: string[];
    totalCredits: number;
    requiredCredits: number;
    gpa: number;
    requiredGPA: number;
  } | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const checkEligibilityMutation = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any)["mutations/graduationMutations"].checkGraduationEligibility
  );

  // Check graduation eligibility when studentId is available
  useEffect(() => {
    if (studentId && !checkingEligibility && !graduationEligibility) {
      setCheckingEligibility(true);
      checkEligibilityMutation({ studentId })
        .then((result) => {
          setGraduationEligibility(result);
        })
        .catch((error) => {
          console.error('Error checking graduation eligibility:', error);
        })
        .finally(() => {
          setCheckingEligibility(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const isLoading = stats === undefined || transcriptData === undefined;
  
  // Use GPA from transcript table (official GPA) instead of calculated GPA from stats
  const officialGPA = transcriptData && !(transcriptData instanceof Error) 
    ? transcriptData.cumulativeGPA 
    : (stats?.academicStats.gpa ?? 0);
  
  // Calculate total credits from transcript entries for more accurate description
  const transcriptTotalCredits = transcriptData && !(transcriptData instanceof Error) && transcriptData.groupedData
    ? Object.values(transcriptData.groupedData).reduce((total, termEntries) => {
        return total + termEntries.reduce((termTotal, entry) => termTotal + entry.credits, 0);
      }, 0)
    : stats?.academicStats.totalCredits ?? 0;

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

  // Get enrollment status badge color
  const getEnrollmentStatusColor = (status: string): "success" | "warning" | "info" => {
    switch (status.toLowerCase()) {
      case "enrolled":
      case "active":
        return "success";
      case "waitlisted":
        return "warning";
      default:
        return "info";
    }
  };

  // Normalize enrollment status for display
  const normalizeEnrollmentStatus = (status: string): string => {
    switch (status.toLowerCase()) {
      case "active":
      case "enrolled":
        return "Enrolled";
      case "waitlisted":
        return "Waitlisted";
      default:
        return status;
    }
  };

  const handleDropClick = (course: { enrollmentId: string; courseCode: string; courseTitle: string }) => {
    setCourseToDrop(course);
    setShowDropModal(true);
    setDropError(null);
  };

  const handleDropConfirm = async () => {
    if (!courseToDrop || !sessionToken) {
      setDropError("Authentication required. Please log in.");
      return;
    }

    setDroppingEnrollmentId(courseToDrop.enrollmentId);
    setDropError(null);

    try {
      await dropCourseMutation({
        enrollmentId: courseToDrop.enrollmentId as Id<"enrollments">,
        token: sessionToken,
      });
      
      setDropSuccess(true);
      setShowDropModal(false);
      setCourseToDrop(null);
      setTimeout(() => setDropSuccess(false), 3000);
    } catch (error) {
      let errorMessage = "Failed to drop course";
      
      if (error instanceof Error) {
        const fullMessage = error.message;
        if (fullMessage.includes("Cannot drop enrollment")) {
          errorMessage = fullMessage.replace(/.*Cannot drop enrollment[^:]*:\s*/, "");
        } else if (fullMessage.includes("You can only drop your own enrollments")) {
          errorMessage = "You can only drop your own enrollments.";
        } else if (fullMessage.includes("Authentication required")) {
          errorMessage = "Authentication required. Please log in.";
        } else if (fullMessage.includes("Invalid session token")) {
          errorMessage = "Your session has expired. Please log in again.";
        } else {
          const errorMatch = fullMessage.match(/(?:Uncaught )?Error:\s*(.+?)(?:\s+Called by client)?$/);
          if (errorMatch && errorMatch[1]) {
            errorMessage = errorMatch[1].trim();
          }
        }
      }
      
      setDropError(errorMessage);
    } finally {
      setDroppingEnrollmentId(null);
    }
  };

  const handleDropCancel = () => {
    setShowDropModal(false);
    setCourseToDrop(null);
    setDropError(null);
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
          {dropSuccess && (
            <Alert variant="success" title="Success" message="Course dropped successfully!" />
          )}
          {dropError && (
            <Alert variant="error" title="Error" message={dropError} />
          )}
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
              value={formatGPA(officialGPA)}
              icon={<PieChartIcon className="h-6 w-6 text-brand-500" />}
              description={
                transcriptTotalCredits > 0
                  ? `Official GPA from transcript (${transcriptTotalCredits} credits)`
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

          {/* Graduation Status */}
          {graduationEligibility && (
            <ComponentCard
              title="Graduation Status"
              desc="Your graduation eligibility status"
            >
              <div className="space-y-4">
                {graduationEligibility.eligible ? (
                  <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
                            Eligible for Graduation
                          </h3>
                        </div>
                        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
                          You have met all graduation requirements and are eligible to graduate.
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-green-600 dark:text-green-400">GPA: </span>
                            <span className="font-medium text-green-800 dark:text-green-300">
                              {graduationEligibility.gpa.toFixed(2)} / {graduationEligibility.requiredGPA}
                            </span>
                          </div>
                          <div>
                            <span className="text-green-600 dark:text-green-400">Credits: </span>
                            <span className="font-medium text-green-800 dark:text-green-300">
                              {graduationEligibility.totalCredits} / {graduationEligibility.requiredCredits}
                            </span>
                          </div>
                        </div>
                        {isRegistrar && (
                          <div className="mt-4">
                            <Link href="/graduation">
                              <Button variant="outline" size="sm">
                                View Graduation Management
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <AlertIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">
                            Not Yet Eligible for Graduation
                          </h3>
                        </div>
                        <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                          You still need to meet some requirements before you can graduate.
                        </p>
                        <div className="mt-4 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-yellow-800 dark:text-yellow-300">Missing Requirements:</span>
                            <ul className="mt-2 list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-400">
                              {graduationEligibility.missingRequirements.map((req, index) => (
                                <li key={index}>{req}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-yellow-600 dark:text-yellow-400">Current GPA: </span>
                              <span className="font-medium text-yellow-800 dark:text-yellow-300">
                                {graduationEligibility.gpa.toFixed(2)} / {graduationEligibility.requiredGPA}
                              </span>
                            </div>
                            <div>
                              <span className="text-yellow-600 dark:text-yellow-400">Current Credits: </span>
                              <span className="font-medium text-yellow-800 dark:text-yellow-300">
                                {graduationEligibility.totalCredits} / {graduationEligibility.requiredCredits}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ComponentCard>
          )}

          {/* Weekly Schedule Calendar */}
          {stats.currentSchedule.length > 0 && (
            <ComponentCard
              title="Weekly Schedule"
              desc="Visual view of your class schedule"
            >
              <WeeklyCalendarView courses={stats.currentSchedule} />
            </ComponentCard>
          )}

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
                        Status
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
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stats.currentSchedule.map((course, index) => (
                      <tr
                        key={course.enrollmentId || index}
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
                        <td className="px-4 py-4">
                          <Badge
                            color={getEnrollmentStatusColor(course.enrollmentStatus)}
                            variant="light"
                            size="sm"
                          >
                            {normalizeEnrollmentStatus(course.enrollmentStatus)}
                          </Badge>
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
                        <td className="px-4 py-4">
                          {(course.enrollmentStatus === "active" || course.enrollmentStatus === "enrolled") && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDropClick(course)}
                              disabled={droppingEnrollmentId === course.enrollmentId}
                            >
                              {droppingEnrollmentId === course.enrollmentId ? "Dropping..." : "Drop"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ComponentCard>

          {/* Drop Confirmation Modal */}
          <Modal
            isOpen={showDropModal}
            onClose={handleDropCancel}
            className="max-w-[500px] p-6"
          >
            <div>
              <h4 className="text-title-sm mb-4 font-semibold text-gray-800 dark:text-white/90">
                Drop Course
              </h4>
              <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                Are you sure you want to drop this course?
              </p>
              {courseToDrop && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {courseToDrop.courseCode} - {courseToDrop.courseTitle}
                  </p>
                </div>
              )}
              {dropError && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                  <p className="text-sm text-red-600 dark:text-red-400">{dropError}</p>
                </div>
              )}
              <div className="mt-6 flex w-full items-center justify-end gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDropCancel}
                  disabled={droppingEnrollmentId !== null}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleDropConfirm}
                  disabled={droppingEnrollmentId !== null}
                >
                  {droppingEnrollmentId ? "Dropping..." : "Drop Course"}
                </Button>
              </div>
            </div>
          </Modal>
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

