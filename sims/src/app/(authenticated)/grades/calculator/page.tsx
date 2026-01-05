'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Loading from '@/components/loading/Loading';
import Alert from '@/components/ui/alert/Alert';
import MetricCard from '@/components/common/MetricCard';
import Badge from '@/components/ui/badge/Badge';
import Select from '@/components/form/Select';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';

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

// Grade points mapping
const GRADE_POINTS: Record<string, number> = {
  'A': 5.0,
  'B': 4.0,
  'C': 3.0,
  'D': 2.0,
  'E': 1.0,
  'F': 0.0,
};

const GRADE_OPTIONS = [
  { value: 'A', label: 'A (5.0)' },
  { value: 'B', label: 'B (4.0)' },
  { value: 'C', label: 'C (3.0)' },
  { value: 'D', label: 'D (2.0)' },
  { value: 'E', label: 'E (1.0)' },
  { value: 'F', label: 'F (0.0)' },
];

export default function GPACalculatorPage() {
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  // Store selected grades for each course
  const [selectedGrades, setSelectedGrades] = useState<Record<string, string>>({});

  // Fetch transcript data (current GPA and credits from transcript table)
  const transcriptData = useQuery(
    api.transcript.getFullHistory,
    sessionToken ? { token: sessionToken } : 'skip'
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
  } | undefined | Error;

  // Fetch active grades
  const gradesData = useQuery(
    api.grades.getMyActiveGrades,
    sessionToken ? { token: sessionToken } : 'skip'
  ) as ActiveGrade[] | undefined | Error;

  // Calculate projected GPA
  const projectedGPA = useMemo(() => {
    if (!transcriptData || transcriptData instanceof Error || !gradesData || Array.isArray(gradesData) === false) {
      return transcriptData && !(transcriptData instanceof Error) ? transcriptData.cumulativeGPA : 0;
    }

    // Use transcript GPA as the base (this is the official GPA from transcript table)
    const transcriptGPA = transcriptData.cumulativeGPA;
    
    // Calculate total credits from transcript entries
    let transcriptTotalCredits = 0;
    if (transcriptData.groupedData) {
      Object.values(transcriptData.groupedData).forEach((termEntries) => {
        termEntries.forEach((entry) => {
          transcriptTotalCredits += entry.credits;
        });
      });
    }
    
    // Calculate current points from transcript GPA and total credits from transcript
    // Formula: GPA = totalPoints / totalCredits, so totalPoints = GPA * totalCredits
    let totalPoints = transcriptGPA * transcriptTotalCredits;
    let totalCredits = transcriptTotalCredits;

    // Add points and credits from active courses
    // Use selected grade if available, otherwise use current grade
    if (Array.isArray(gradesData)) {
      gradesData.forEach((gradeData) => {
        const courseId = gradeData.course._id;
        const selectedGrade = selectedGrades[courseId];
        const currentGrade = gradeData.currentGrade;
        const credits = gradeData.course.credits;

        // Use selected grade if available, otherwise use current grade points
        let points: number | null = null;
        if (selectedGrade && GRADE_POINTS[selectedGrade] !== undefined) {
          points = GRADE_POINTS[selectedGrade];
        } else if (currentGrade) {
          points = currentGrade.points;
        }

        // Only add to calculation if we have a grade (selected or current)
        if (points !== null) {
          totalPoints += points * credits;
          totalCredits += credits;
        }
      });
    }

    if (totalCredits === 0) return transcriptGPA;
    const gpa = totalPoints / totalCredits;
    return Math.round(gpa * 100) / 100;
  }, [transcriptData, gradesData, selectedGrades]);

  // Get status badge info based on Nigerian degree classification
  const getStatusInfo = (gpa: number) => {
    if (gpa >= 4.5 && gpa <= 5.0) {
      return { label: 'First Class', color: 'success' as const };
    } else if (gpa >= 3.5 && gpa < 4.5) {
      return { label: 'Second Class (Upper Division)', color: 'info' as const };
    } else if (gpa >= 2.4 && gpa < 3.5) {
      return { label: 'Second Class (Lower Division)', color: 'warning' as const };
    } else if (gpa >= 1.5 && gpa < 2.4) {
      return { label: 'Third Class', color: 'warning' as const };
    } else {
      return { label: 'Probation', color: 'error' as const };
    }
  };

  const handleGradeChange = (courseId: string, value: string) => {
    setSelectedGrades((prev) => ({
      ...prev,
      [courseId]: value,
    }));
  };

  const isLoading = transcriptData === undefined || gradesData === undefined;
  const isError = transcriptData instanceof Error || gradesData instanceof Error;
  const hasTranscript = !isError && transcriptData && !(transcriptData instanceof Error);
  const hasGrades = !isError && Array.isArray(gradesData) && gradesData.length > 0;
  
  // Calculate total credits from transcript entries
  const transcriptTotalCredits = useMemo(() => {
    if (!hasTranscript || !transcriptData.groupedData) return 0;
    let total = 0;
    Object.values(transcriptData.groupedData).forEach((termEntries) => {
      termEntries.forEach((entry) => {
        total += entry.credits;
      });
    });
    return total;
  }, [hasTranscript, transcriptData]);

  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb 
          items={[
            { name: 'Grades', href: '/grades' },
            { name: 'GPA Calculator' }
          ]} 
        />
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = 
      transcriptData instanceof Error ? transcriptData.message :
      gradesData instanceof Error ? gradesData.message : 
      'An error occurred while loading your data.';
    return (
      <div>
        <PageBreadCrumb 
          items={[
            { name: 'Grades', href: '/grades' },
            { name: 'GPA Calculator' }
          ]} 
        />
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

  const currentGPA = hasTranscript ? transcriptData.cumulativeGPA : 0;
  const currentCredits = transcriptTotalCredits;
  const currentStatus = getStatusInfo(currentGPA);
  const projectedStatus = getStatusInfo(projectedGPA);

  return (
    <div>
      <PageBreadCrumb 
        items={[
          { name: 'Grades', href: '/grades' },
          { name: 'GPA Calculator' }
        ]} 
      />

      <div className="space-y-6">
        {/* Current Stats Section */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            title="Current GPA"
            value={currentGPA.toFixed(2)}
            description="Cumulative GPA"
          />
          <MetricCard
            title="Total Credits"
            value={currentCredits}
            description="Credits completed"
          />
          <div className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Current Status
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge color={currentStatus.color} variant="light" size="md">
                {currentStatus.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Projected GPA Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-shadow md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="text-xl font-semibold text-gray-600 dark:text-white/90">
            Projected GPA
          </h4>
          <p className="text-theme-sm mt-2 text-gray-500 dark:text-gray-400">
            See how different grades will affect your cumulative GPA
          </p>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold text-gray-800 dark:text-white/90">
                  {projectedGPA.toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Based on selected grades
                </p>
              </div>
              <Badge color={projectedStatus.color} variant="light" size="md">
                {projectedStatus.label}
              </Badge>
            </div>

            {/* GPA Change Indicator */}
            {projectedGPA !== currentGPA && (
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className={projectedGPA > currentGPA ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}>
                    {projectedGPA > currentGPA ? '↑' : '↓'} {Math.abs(projectedGPA - currentGPA).toFixed(2)}
                  </span>
                  {' '}points {projectedGPA > currentGPA ? 'increase' : 'decrease'} from current GPA
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active Courses Section */}
        {hasGrades ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-shadow md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h4 className="text-xl font-semibold text-gray-600 dark:text-white/90">
              Active Courses
            </h4>
            <p className="text-theme-sm mt-2 text-gray-500 dark:text-gray-400">
              Select hypothetical grades to see their impact on your GPA
            </p>
            <div className="mt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                      Course
                    </TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                      Credits
                    </TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                      Current Grade
                    </TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                      Hypothetical Grade
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradesData.map((gradeData) => {
                    const courseId = gradeData.course._id;
                    const currentGrade = gradeData.currentGrade;
                    const selectedGrade = selectedGrades[courseId] || '';
                    const defaultValue = currentGrade?.letter || '';

                    return (
                      <TableRow key={gradeData.enrollmentId}>
                        <TableCell className="px-5 py-3">
                          <div>
                            <div className="font-medium text-gray-800 dark:text-white/90">
                              {gradeData.course.code}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {gradeData.course.title}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          {gradeData.course.credits}
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          {currentGrade ? (
                            <Badge
                              color={
                                currentGrade.points >= 4.0
                                  ? 'success'
                                  : currentGrade.points >= 3.0
                                  ? 'info'
                                  : currentGrade.points >= 2.0
                                  ? 'warning'
                                  : 'error'
                              }
                              variant="light"
                              size="sm"
                            >
                              {currentGrade.letter} ({currentGrade.percentage.toFixed(1)}%)
                            </Badge>
                          ) : (
                            <span className="text-gray-400">No grade yet</span>
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          <div className="w-48">
                            <Select
                              key={`${courseId}-${selectedGrade || defaultValue}`}
                              options={GRADE_OPTIONS}
                              placeholder="Select grade"
                              defaultValue={selectedGrade || defaultValue || ''}
                              onChange={(e) => handleGradeChange(courseId, e.target.value)}
                              className="w-full"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <Alert
            variant="info"
            title="No Active Courses"
            message="You are not currently enrolled in any active courses. Enroll in courses to use the GPA calculator."
          />
        )}
      </div>
    </div>
  );
}

