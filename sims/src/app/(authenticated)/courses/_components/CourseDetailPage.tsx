'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import Button from '@/components/ui/button/Button';
import Badge from '@/components/ui/badge/Badge';
import Alert from '@/components/ui/alert/Alert';
import { Modal } from '@/components/ui/modal';
import Link from 'next/link';
import PrerequisitesGraph from './PrerequisitesGraph';
import { useAuth } from '@/hooks/useAuth';
import { isStudent } from '@/services/permissions.service';

type CourseDetails = {
  title: string;
  description: string;
  prerequisites: string[];
  activeSections: Array<{
    sectionId: string;
    instructor: string;
    schedule: string;
    room: string;
    seatsAvailable: number;
  }>;
};

function PrerequisitesSection({ courseId }: { courseId: Id<'courses'> }) {
  const [, setTick] = useState(0);
  const graphRes = useQuery(api.functions.courses.getPrerequisitesGraph, courseId ? { courseId } : 'skip');
  const loading = graphRes === undefined;
  const graph = graphRes?.graph ?? {};
  const validation = graphRes?.validation ?? { valid: true };
  const root = graphRes?.root ?? null;

  function buildChains(graph: Record<string, string[]>, root: string | null) {
    if (!root) return [] as string[][];
    const chains: string[][] = [];
    const path: string[] = [];

    function dfs(node: string) {
      path.push(node);
      const neigh = graph[node] || [];
      if (neigh.length === 0) {
        chains.push([...path]);
      } else {
        for (const n of neigh) {
          dfs(n);
        }
      }
      path.pop();
    }

    dfs(root);
    return chains;
  }

  const chains = buildChains(graph, root);

  return (
    <ComponentCard title="Prerequisite Graph">
      {loading ? (
        <div className="py-8 flex items-center justify-center"><Loading /></div>
      ) : (
        <>
          {!validation.valid ? (
            <div className="mb-4">
              <Alert variant="error" title="Circular prerequisite detected" message={validation.cycle ? `Cycle: ${validation.cycle.join(' -> ')}` : (validation.reason || 'Invalid prerequisite chain')} />
            </div>
          ) : null}

          {Object.keys(graph).length === 0 ? (
            <div className="py-6 text-center text-gray-500">
              <p className="mb-2">This course does not have any prerequisites.</p>
              <div className="mt-2">
                <button className="text-sm text-gray-500" onClick={() => setTick((t) => t + 1)}>Retry</button>
              </div>
            </div>
          ) : (
            <PrerequisitesGraph
              graph={graph}
              root={root ?? undefined}
              width={700}
              height={300}
              validation={validation}
              onNodeClick={(code) => window.location.href = `/courses?searchQuery=${encodeURIComponent(code)}`}
            />
          )}

          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prerequisite chains</div>
            {chains.length === 0 ? (
              <div className="text-gray-500">This course has no prerequisite chains.</div>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {chains.map((chain, idx) => (
                  <li key={idx}>
                    {chain.map((code, i) => (
                      <span key={code}>
                        <Link href={`/courses?searchQuery=${encodeURIComponent(code)}`} className="text-blue-600 hover:underline">{code}</Link>
                        {i < chain.length - 1 ? ' → ' : ''}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </ComponentCard>
  );
}

interface CourseDetailPageProps {
  courseId: Id<'courses'>;
}

export default function CourseDetailPage({ courseId }: CourseDetailPageProps) {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const userIsStudent = isStudent(roles);

  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [enrollingSectionId, setEnrollingSectionId] = useState<string | null>(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistSectionId, setWaitlistSectionId] = useState<string | null>(null);

  // Fetch course details
  const courseDetails = useQuery(
    api.functions.courses.getDetails,
    courseId ? { courseId } : 'skip'
  ) as CourseDetails | undefined;

  // @ts-expect-error - Convex API path with slashes
  const enrollMutation = useMutation(api["mutations/enrollmentMutations"].enroll);

  const isLoading = courseDetails === undefined;

  const handleEnroll = async (sectionId: string, joinWaitlist: boolean = false) => {
    if (!sessionToken) {
      setEnrollmentError('Authentication required. Please log in.');
      return;
    }

    setEnrollingSectionId(sectionId);
    setEnrollmentError(null);
    setShowWaitlistModal(false);
    setWaitlistSectionId(null);

    try {
      const result = await enrollMutation({
        sectionId: sectionId as Id<'sections'>,
        token: sessionToken,
        joinWaitlist: joinWaitlist,
      });
      
      if (result.status === 'waitlisted') {
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } else {
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
    } catch (error) {
      let errorMessage = 'Failed to enroll in section';
      
      if (error instanceof Error) {
        const fullMessage = error.message;
        
        if (fullMessage.includes('You have already enrolled for this course')) {
          errorMessage = 'You have already enrolled for this course.';
        } else if (fullMessage.includes('Section Full')) {
          setWaitlistSectionId(sectionId);
          setShowWaitlistModal(true);
          setEnrollingSectionId(null);
          return;
        } else if (fullMessage.includes('Missing prerequisites')) {
          errorMessage = fullMessage.replace(/.*Missing prerequisites:\s*/, 'Missing prerequisites: ');
        } else if (fullMessage.includes('Schedule conflicts') || fullMessage.includes('Schedule conflict')) {
          const conflictMatch = fullMessage.match(/Schedule conflicts? with:\s*(.+?)(?:\s+Called by client)?$/i);
          if (conflictMatch && conflictMatch[1]) {
            const conflicts = conflictMatch[1].split(',').map(c => c.trim());
            if (conflicts.length === 1) {
              errorMessage = `Schedule conflict: This section conflicts with ${conflicts[0]}.`;
            } else {
              errorMessage = `Schedule conflict: This section conflicts with your existing enrollments: ${conflicts.join(', ')}.`;
            }
          } else {
            errorMessage = 'Schedule conflict: This section conflicts with one of your existing enrollments.';
          }
        } else if (fullMessage.includes('Enrollment deadline has passed')) {
          errorMessage = 'The enrollment deadline for this section has passed. Please contact the registrar if you need assistance.';
        } else if (fullMessage.includes('Authentication required')) {
          errorMessage = 'Authentication required. Please log in.';
        } else if (fullMessage.includes('Invalid session token')) {
          errorMessage = 'Your session has expired. Please log in again.';
        } else if (fullMessage.includes('Only students can enroll')) {
          errorMessage = 'Only students can enroll in sections.';
        } else {
          const errorMatch = fullMessage.match(/(?:Uncaught )?Error:\s*(.+?)(?:\s+Called by client)?$/);
          if (errorMatch && errorMatch[1]) {
            errorMessage = errorMatch[1].trim();
          } else {
            errorMessage = fullMessage.replace(/\[CONVEX[^\]]+\]\s*/g, '').replace(/\[Request ID:[^\]]+\]\s*/g, '').replace(/Server Error\s*/g, '').trim();
          }
        }
      }
      
      setEnrollmentError(errorMessage);
      setTimeout(() => setEnrollmentError(null), 5000);
    } finally {
      setEnrollingSectionId(null);
    }
  };

  const handleWaitlistConfirm = () => {
    if (waitlistSectionId) {
      handleEnroll(waitlistSectionId, true);
    }
  };

  const breadcrumbItems = [
    { name: 'Course', href: '/courses' },
    { name: 'Course Details' }
  ];

  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb items={breadcrumbItems} />
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      </div>
    );
  }

  if (!courseDetails) {
    return (
      <div>
        <PageBreadCrumb items={breadcrumbItems} />
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium mb-2">Course not found</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb items={breadcrumbItems} />

      <div className="space-y-6">
        {showSuccessMessage && (
          <Alert variant="success" title="Success" message="Successfully enrolled in section!" />
        )}
        {enrollmentError && (
          <Alert variant="error" title="Enrollment Error" message={enrollmentError} />
        )}
        {/* Course Information */}
        <ComponentCard title={courseDetails.title}>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Description
              </h3>
              <p className="text-gray-800 dark:text-white/90">
                {courseDetails.description}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Prerequisites
              </h3>
              {courseDetails.prerequisites.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {courseDetails.prerequisites.map((prereq, index) => (
                    <li key={index} className="text-gray-800 dark:text-white/90">
                      {prereq}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No prerequisites</p>
              )}
            </div>

            {/* Link to versions page */}
            <div>
              <Link href={`/courses/${courseId}/versions`}>
                <Button size="sm" variant="outline">View Versions</Button>
              </Link>
            </div>

            {/* Prerequisites Graph */}
            <div className="mt-4">
              <PrerequisitesSection courseId={courseId} />
            </div>
          </div>
        </ComponentCard>

        {/* Available Sections Table - Only show for students */}
        {userIsStudent && (
          <ComponentCard title="Available Sections" desc="Browse available class sections for this course">
            {courseDetails.activeSections.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                        Instructor
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                        Schedule
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                        Room
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                        Seats Available
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                        Action
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseDetails.activeSections.map((section) => (
                      <TableRow key={section.sectionId}>
                        <TableCell className="px-5 py-3 text-start">
                          {section.instructor}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-start">
                          {section.schedule}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-start">
                          {section.room}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-start">
                          <Badge 
                            color={section.seatsAvailable > 0 ? 'success' : 'light'} 
                            variant="light" 
                            size="sm"
                          >
                            {section.seatsAvailable}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-5 py-3 text-start">
                          <Button
                            size="sm"
                            variant={section.seatsAvailable <= 0 ? "warning" : "primary"}
                            disabled={enrollingSectionId === section.sectionId}
                            onClick={() => {
                              if (section.seatsAvailable <= 0) {
                                setWaitlistSectionId(section.sectionId);
                                setShowWaitlistModal(true);
                              } else {
                                handleEnroll(section.sectionId);
                              }
                            }}
                          >
                            {enrollingSectionId === section.sectionId 
                              ? 'Enrolling...' 
                              : section.seatsAvailable <= 0 
                              ? 'Join Waitlist' 
                              : 'Enroll'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                <p className="text-lg font-medium mb-2">No active sections available</p>
                <p className="text-sm">Check back later for available sections</p>
              </div>
            )}
          </ComponentCard>
        )}

        {/* Waitlist Confirmation Modal */}
        {userIsStudent && (
          <Modal
            isOpen={showWaitlistModal}
            onClose={() => {
              setShowWaitlistModal(false);
              setWaitlistSectionId(null);
            }}
            className="max-w-[500px] p-6"
          >
            <div>
              <h4 className="text-title-sm mb-4 font-semibold text-gray-800 dark:text-white/90">
                Join Waitlist?
              </h4>
              <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                This section is full. Would you like to join the waitlist? You will be automatically enrolled if a spot becomes available.
              </p>
              <div className="mt-6 flex w-full items-center justify-end gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowWaitlistModal(false);
                    setWaitlistSectionId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="warning"
                  onClick={handleWaitlistConfirm}
                  disabled={enrollingSectionId !== null}
                >
                  {enrollingSectionId ? 'Joining...' : 'Join Waitlist'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
