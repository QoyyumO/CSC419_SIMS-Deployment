'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/convex';
import { Id } from '@/../convex/_generated/dataModel';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Loading from '@/components/loading/Loading';
import Alert from '@/components/ui/alert/Alert';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Badge from '@/components/ui/badge/Badge';
import Accordion from '@/components/ui/accordion/Accordion';
import Button from '@/components/ui/button/Button';
import MetricCard from '@/components/common/MetricCard';
import Select from '@/components/form/Select';
import Input from '@/components/form/input/InputField';
import { useHasRole } from '@/hooks/useHasRole';
import { Modal } from '@/components/ui/modal';
import TextArea from '@/components/form/input/TextArea';

type ActiveGrade = {
  enrollmentId: string;
  sectionId: string;
  course: {
    _id: string;
    code: string;
    title: string;
    credits: number;
  };
  section: {
    _id: string;
  };
  currentGrade: {
    percentage: number;
    letter: string;
    points: number;
  } | null;
  assessments: Array<{
    _id: string;
    title: string;
    totalPoints: number;
    weight: number;
    dueDate: number;
    score: number | null;
    percentage: number | null;
    letter: string | null;
    isMissing: boolean;
  }>;
};

type SectionStatus = {
  _id: Id<"sections">;
  courseCode: string;
  courseTitle: string;
  departmentId: Id<"departments">;
  departmentName: string;
  instructorId: Id<"users"> | null;
  instructorName: string;
  termId: Id<"terms">;
  termName: string;
  totalStudents: number;
  studentsWithGrades: number;
  percentageGraded: number;
  gradeStatus: "Grades Submitted" | "Pending" | "Locked";
  finalGradesPosted: boolean;
  gradesEditable: boolean;
  isLocked: boolean;
};

type Department = {
  _id: Id<"departments">;
  name: string;
  schoolId: Id<"schools">;
  schoolName: string;
  headId: Id<"users">;
};

type Term = {
  _id: Id<"terms">;
  name: string;
  sessionId: Id<"academicSessions">;
  sessionYearLabel: string;
  startDate: number;
  endDate: number;
};

export default function GradesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check if user is registrar
  const isRegistrar = useHasRole('registrar');
  
  // Get courseId from query parameters
  const courseIdFromQuery = searchParams.get('courseId');
  
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  // State to track which accordions are open (for student view)
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());
  
  // State for real-time alert (for student view)
  const [alertMessage, setAlertMessage] = useState<{ variant: 'success' | 'error' | 'warning' | 'info'; title: string; message: string } | null>(null);

  // State for registrar view filters
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');


  // Fetch active grades (for student view)
  const gradesData = useQuery(
    api.grades.getMyActiveGrades,
    !isRegistrar && sessionToken ? { token: sessionToken } : 'skip'
  ) as ActiveGrade[] | undefined | Error;

  // Fetch sections status (for registrar view)
  const sectionsStatus = useQuery(
    api.registrar.getAllSectionsStatus,
    isRegistrar && sessionToken
      ? {
          token: sessionToken,
          term: selectedTerm ? selectedTerm : undefined,
          departmentId: selectedDepartment ? (selectedDepartment as Id<"departments">) : undefined,
        }
      : 'skip'
  ) as SectionStatus[] | undefined | Error;

  // Fetch departments for filter
  const departments = useQuery(api.departments.list) as Department[] | undefined;

  // Fetch terms for filter
  const terms = useQuery(api.department.getTerms) as Term[] | undefined;

  // Fetch notifications for real-time updates (for student view)
  const notifications = useQuery(
    api.notifications.getMyNotifications,
    !isRegistrar && sessionToken ? { token: sessionToken } : 'skip'
  ) as Array<{
    _id: string;
    message: string;
    read: boolean;
    createdAt: number;
    courseId?: string;
  }> | undefined;

  // Mutation for sending reminder
  const sendReminder = useMutation(api.registrar.sendReminder);

  // Mutation for unlocking section
  const setSectionLock = useMutation(api.registrar.setSectionLock);

  // State for unlock modal
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [selectedSectionForUnlock, setSelectedSectionForUnlock] = useState<Id<"sections"> | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Track the last notification timestamp to detect new ones
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(Date.now());

  // Effect to expand accordion based on query parameter
  useEffect(() => {
    if (courseIdFromQuery && gradesData && Array.isArray(gradesData)) {
      const course = gradesData.find((g) => g.course._id === courseIdFromQuery);
      if (course) {
        setOpenAccordions(new Set([course.enrollmentId]));
        // Remove query parameter from URL after expanding
        router.replace('/grades', { scroll: false });
      }
    }
  }, [courseIdFromQuery, gradesData, router]);

  // Effect to show real-time alert when new grade notification is received
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      // Find the most recent unread notification about grades
      const gradeNotifications = notifications.filter(
        (n) => !n.read && n.message.includes('New grade posted') && n.createdAt > lastNotificationTime
      );
      
      if (gradeNotifications.length > 0) {
        const latestNotification = gradeNotifications[0];
        setAlertMessage({
          variant: 'info',
          title: 'New Grade Posted',
          message: latestNotification.message,
        });
        setLastNotificationTime(latestNotification.createdAt);
        
        // Auto-dismiss after 8 seconds
        const timer = setTimeout(() => {
          setAlertMessage(null);
        }, 8000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [notifications, lastNotificationTime]);

  // Initialize lastNotificationTime when component mounts or notifications load
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const latestTime = Math.max(...notifications.map((n) => n.createdAt));
      if (latestTime > lastNotificationTime) {
        setLastNotificationTime(latestTime);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);


  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getGradeColor = (percentage: number | null): 'success' | 'info' | 'warning' | 'error' | 'light' => {
    if (percentage === null) return 'light';
    if (percentage >= 70) return 'success';
    if (percentage >= 60) return 'info';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  const getStatusBadgeColor = (status: "Grades Submitted" | "Pending" | "Locked"): 'success' | 'warning' | 'info' => {
    if (status === "Grades Submitted") return 'success';
    if (status === "Locked") return 'info';
    return 'warning';
  };

  // Filter sections by search query (client-side filtering)
  const filteredSections = useMemo(() => {
    if (!Array.isArray(sectionsStatus)) {
      return [];
    }

    if (!searchQuery.trim()) {
      return sectionsStatus;
    }

    const query = searchQuery.toLowerCase().trim();
    return sectionsStatus.filter((section) => {
      const courseCode = section.courseCode.toLowerCase();
      const courseTitle = section.courseTitle.toLowerCase();
      return courseCode.includes(query) || courseTitle.includes(query);
    });
  }, [sectionsStatus, searchQuery]);

  // Calculate overview stats for registrar view (based on filtered sections)
  const overviewStats = useMemo(() => {
    if (!Array.isArray(filteredSections)) {
      return { totalSections: 0, gradesSubmitted: 0, pendingSubmission: 0 };
    }

    const totalSections = filteredSections.length;
    const gradesSubmitted = filteredSections.filter((s) => s.gradeStatus === "Grades Submitted").length;
    const pendingSubmission = filteredSections.filter((s) => s.gradeStatus === "Pending").length;

    return { totalSections, gradesSubmitted, pendingSubmission };
  }, [filteredSections]);

  // Handle send reminder
  const handleSendReminder = async (sectionId: Id<"sections">, instructorId: Id<"users">) => {
    if (!sessionToken) return;

    try {
      await sendReminder({
        token: sessionToken,
        instructorId,
        sectionId,
      });
      setAlertMessage({
        variant: 'success',
        title: 'Reminder Sent',
        message: 'Grade submission reminder has been sent to the instructor.',
      });
      setTimeout(() => setAlertMessage(null), 5000);
    } catch (error) {
      setAlertMessage({
        variant: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to send reminder.',
      });
      setTimeout(() => setAlertMessage(null), 5000);
    }
  };

  // Handle unlock button click
  const handleUnlockClick = (sectionId: Id<"sections">) => {
    setSelectedSectionForUnlock(sectionId);
    setUnlockReason('');
    setUnlockModalOpen(true);
  };

  // Handle unlock submission
  const handleUnlockSubmit = async () => {
    if (!sessionToken || !selectedSectionForUnlock || !unlockReason.trim()) {
      return;
    }

    setIsUnlocking(true);
    try {
      await setSectionLock({
        token: sessionToken,
        sectionId: selectedSectionForUnlock,
        locked: false,
        reason: unlockReason.trim(),
      });
      setAlertMessage({
        variant: 'success',
        title: 'Section Unlocked',
        message: 'The section has been unlocked for grading.',
      });
      setUnlockModalOpen(false);
      setSelectedSectionForUnlock(null);
      setUnlockReason('');
      setTimeout(() => setAlertMessage(null), 5000);
    } catch (error) {
      setAlertMessage({
        variant: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to unlock section.',
      });
      setTimeout(() => setAlertMessage(null), 5000);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Loading and error states
  const isLoading = isRegistrar
    ? sectionsStatus === undefined
    : gradesData === undefined;
  const isError = isRegistrar
    ? sectionsStatus instanceof Error
    : gradesData instanceof Error;
  const hasData = isRegistrar
    ? Array.isArray(sectionsStatus) && sectionsStatus.length > 0
    : Array.isArray(gradesData) && gradesData.length > 0;

  // Render registrar view
  if (isRegistrar) {
    if (isLoading) {
      return (
        <div>
          <PageBreadCrumb pageTitle="Registrar Grade Dashboard" />
          <div className="flex items-center justify-center py-12">
            <Loading />
          </div>
        </div>
      );
    }

    if (isError) {
      const errorMessage = sectionsStatus instanceof Error ? sectionsStatus.message : 'An error occurred while loading sections.';
      return (
        <div>
          <PageBreadCrumb pageTitle="Registrar Grade Dashboard" />
          <div className="space-y-6">
            <Alert
              variant="error"
              title="Error Loading Data"
              message={errorMessage}
            />
          </div>
        </div>
      );
    }

    return (
      <div>
        <PageBreadCrumb pageTitle="Registrar Grade Dashboard" />

        <div className="space-y-6">
          {/* Alert Messages */}
          {alertMessage && (
            <Alert
              variant={alertMessage.variant}
              title={alertMessage.title}
              message={alertMessage.message}
            />
          )}

          {/* Audit Log Link */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push('/grades/audit-log')}
            >
              View Audit Log
            </Button>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <MetricCard
              title="Total Sections"
              value={overviewStats.totalSections}
              description="All sections in the system"
            />
            <MetricCard
              title="Grades Submitted"
              value={overviewStats.gradesSubmitted}
              description="Sections with grades submitted"
            />
            <MetricCard
              title="Pending Submission"
              value={overviewStats.pendingSubmission}
              description="Sections awaiting grade submission"
            />
          </div>

          {/* Filters */}
          <div className="space-y-4">
            {/* Search */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Search Courses
              </label>
              <Input
                type="text"
                placeholder="Search by course code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Department and Term Filters */}
            <div className="flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Department
                </label>
                <Select
                  options={[
                    { value: '', label: 'All Departments' },
                    ...(departments?.map((d) => ({
                      value: d._id,
                      label: d.name,
                    })) || []),
                  ]}
                  placeholder="Select Department"
                  defaultValue={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Term
                </label>
                <Select
                  options={[
                    { value: '', label: 'All Terms' },
                    ...(terms?.map((t) => ({
                      value: t.name,
                      label: `${t.name} (${t.sessionYearLabel})`,
                    })) || []),
                  ]}
                  placeholder="Select Term"
                  defaultValue={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Master Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                    Course
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                    Instructor
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                    Grade Status
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                    Students Graded
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                    Action
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      {searchQuery.trim() ? 'No sections found matching your search.' : 'No sections found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSections.map((section) => (
                    <TableRow key={section._id}>
                      <TableCell className="px-5 py-3">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white/90">
                            {section.courseCode}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {section.courseTitle}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {section.termName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        {section.instructorName}
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <Badge
                          color={getStatusBadgeColor(section.gradeStatus)}
                          variant="light"
                          size="sm"
                        >
                          {section.gradeStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <div className="text-sm">
                          <span className="font-medium text-gray-800 dark:text-white/90">
                            {section.studentsWithGrades} / {section.totalStudents}
                          </span>
                          <span className="ml-2 text-gray-500 dark:text-gray-400">
                            ({section.percentageGraded}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        {section.instructorId && section.gradeStatus === "Pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendReminder(section._id, section.instructorId!)}
                          >
                            Remind
                          </Button>
                        )}
                        {section.gradeStatus === "Locked" && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleUnlockClick(section._id)}
                          >
                            Unlock
                          </Button>
                        )}
                        {section.gradeStatus === "Grades Submitted" && (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Unlock Modal */}
          <Modal
            isOpen={unlockModalOpen}
            onClose={() => {
              setUnlockModalOpen(false);
              setSelectedSectionForUnlock(null);
              setUnlockReason('');
            }}
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Unlock Section for Grading
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Please provide a reason for unlocking this section. This action will be recorded in the audit log.
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason <span className="text-error-500">*</span>
                </label>
                <TextArea
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Enter reason for unlocking this section..."
                  rows={4}
                  error={!unlockReason.trim() && unlockModalOpen}
                  hint={!unlockReason.trim() ? "Reason is required" : ""}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setUnlockModalOpen(false);
                    setSelectedSectionForUnlock(null);
                    setUnlockReason('');
                  }}
                  disabled={isUnlocking}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleUnlockSubmit}
                  disabled={!unlockReason.trim() || isUnlocking}
                >
                  {isUnlocking ? 'Unlocking...' : 'Unlock Section'}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      </div>
    );
  }

  // Render student view (existing code)
  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="My Grades" />
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = gradesData instanceof Error ? gradesData.message : 'An error occurred while loading your grades.';
    return (
      <div>
        <PageBreadCrumb pageTitle="My Grades" />
        <div className="space-y-6">
          <Alert
            variant="error"
            title="Error Loading Grades"
            message={errorMessage}
          />
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div>
        <PageBreadCrumb pageTitle="My Grades" />
        <div className="space-y-6">
          <Alert
            variant="info"
            title="No Active Courses"
            message="You are not currently enrolled in any active courses."
          />
        </div>
      </div>
    );
  }

  // Handle accordion toggle
  const handleAccordionToggle = (enrollmentId: string, isOpen: boolean) => {
    setOpenAccordions((prev) => {
      const newSet = new Set(prev);
      if (isOpen) {
        newSet.add(enrollmentId);
      } else {
        newSet.delete(enrollmentId);
      }
      return newSet;
    });
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="My Grades" />

      <div className="space-y-6">
        {/* Real-time Alert */}
        {alertMessage && (
          <div className="fixed top-20 right-4 z-50 w-full max-w-md animate-in slide-in-from-top-5">
            <Alert
              variant={alertMessage.variant}
              title={alertMessage.title}
              message={alertMessage.message}
            />
          </div>
        )}
        {/* GPA Calculator Button */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/grades/calculator')}
          >
            GPA Calculator
          </Button>
        </div>

        <div className="space-y-4">
          {Array.isArray(gradesData) && gradesData.map((gradeData: ActiveGrade) => {
            const { course, currentGrade, assessments } = gradeData;
            const percentage = currentGrade?.percentage ?? 0;
            const letter = currentGrade?.letter ?? 'N/A';
            const gradeColor = getGradeColor(currentGrade?.percentage ?? null);

            return (
              <Accordion
                key={gradeData.enrollmentId}
                title={`${course.code} - ${course.title}`}
                subtitle={`${course.credits} Credits`}
                isOpen={openAccordions.has(gradeData.enrollmentId)}
                onToggle={(isOpen) => handleAccordionToggle(gradeData.enrollmentId, isOpen)}
                headerContent={
                  <>
                    {/* Current Grade */}
                    <div className="text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Current Grade</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          color={gradeColor}
                          variant="light"
                          size="sm"
                        >
                          {percentage.toFixed(1)}% ({letter})
                        </Badge>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-32">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className={`h-full transition-all ${
                            percentage >= 70
                              ? 'bg-success-500'
                              : percentage >= 60
                              ? 'bg-blue-500'
                              : percentage >= 50
                              ? 'bg-warning-500'
                              : 'bg-error-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </>
                }
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                          Assignment
                        </TableCell>
                        <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                          Due Date
                        </TableCell>
                        <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                          Weight
                        </TableCell>
                        <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                          Score
                        </TableCell>
                        <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                          Grade
                        </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assessments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                            No assessments available for this course.
                          </TableCell>
                        </TableRow>
                      ) : (
                        assessments.map((assessment: ActiveGrade['assessments'][0]) => {
                          const hasScore = assessment.score !== null;
                          const isOverdue = assessment.isMissing;
                          const rowClassName = isOverdue
                            ? 'bg-error-50 dark:bg-error-500/10'
                            : '';

                          return (
                            <TableRow key={assessment._id} className={rowClassName}>
                              <TableCell className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  {assessment.title}
                                  {isOverdue && (
                                    <Badge color="error" variant="light" size="sm">
                                      Missing
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-5 py-3">
                                {formatDate(assessment.dueDate)}
                              </TableCell>
                              <TableCell className="px-5 py-3">
                                {assessment.weight}%
                              </TableCell>
                              <TableCell className="px-5 py-3">
                                {hasScore ? (
                                  <span className="font-medium">
                                    {assessment.score?.toFixed(1)} / {assessment.totalPoints}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </TableCell>
                              <TableCell className="px-5 py-3">
                                {hasScore ? (
                                  <Badge
                                    color={getGradeColor(assessment.percentage)}
                                    variant="light"
                                    size="sm"
                                  >
                                    {assessment.percentage?.toFixed(1)}% ({assessment.letter})
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Accordion>
            );
          })}
        </div>
      </div>
    </div>
  );
}

