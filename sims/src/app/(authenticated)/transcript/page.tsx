'use client';

import React, { useState, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Loading from '@/components/loading/Loading';
import Alert from '@/components/ui/alert/Alert';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Button from '@/components/ui/button/Button';
import ComponentCard from '@/components/common/ComponentCard';

type TranscriptData = {
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
  cumulativeGPA: number;
  studentInfo: {
    studentNumber: string;
    name: string;
    departmentId: string;
    departmentName: string;
  };
};

export default function TranscriptPage() {
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch transcript data
  const transcriptData = useQuery(
    api.transcript.getFullHistory,
    sessionToken ? { token: sessionToken } : 'skip'
  ) as TranscriptData | undefined | Error;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      // Use window.print() with CSS media queries for better browser compatibility
      window.print();
    }
  };

  const isLoading = transcriptData === undefined;
  const isError = transcriptData instanceof Error;
  const hasData = transcriptData && !isError && Object.keys(transcriptData.groupedData || {}).length > 0;

  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Official Transcript" />
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = transcriptData instanceof Error ? transcriptData.message : 'An error occurred while loading your transcript.';
    return (
      <div>
        <PageBreadCrumb pageTitle="Official Transcript" />
        <div className="space-y-6">
          <Alert
            variant="error"
            title="Error Loading Transcript"
            message={errorMessage}
          />
        </div>
      </div>
    );
  }

  if (!hasData || !transcriptData) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Official Transcript" />
        <div className="space-y-6">
          <Alert
            variant="info"
            title="No Transcript Data"
            message="You do not have any completed courses to display on your transcript."
          />
        </div>
      </div>
    );
  }

  const { groupedData, termGPAs, cumulativeGPA, studentInfo } = transcriptData;
  const termLabels = Object.keys(groupedData).sort(() => {
    // Sort by term label (most recent first - already sorted in backend)
    return 0;
  });

  return (
    <div>
      <PageBreadCrumb pageTitle="Official Transcript" />

      <div className="space-y-6">
        {/* Action Button */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handlePrint}
            startIcon={
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
            }
          >
            Download PDF
          </Button>
        </div>

        {/* Transcript Content - Print View */}
        <div ref={printRef} className="transcript-print-view">
          <style jsx global>{`
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                background: white !important;
                color: black !important;
              }
              .transcript-print-view {
                padding: 0 !important;
                background: white !important;
                color: black !important;
              }
              .transcript-print-view * {
                color: black !important;
              }
              .transcript-print-view .bg-gray-100,
              .transcript-print-view .bg-gray-800 {
                background: #f0f0f0 !important;
              }
              .transcript-print-view .dark\\:bg-gray-800 {
                background: #f0f0f0 !important;
              }
              .transcript-print-view .dark\\:text-white {
                color: black !important;
              }
              .transcript-print-view .dark\\:text-gray-300 {
                color: black !important;
              }
              .transcript-print-view .dark\\:text-gray-400 {
                color: black !important;
              }
              .transcript-print-view table {
                page-break-inside: auto;
              }
              .transcript-print-view tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              .transcript-print-view thead {
                display: table-header-group;
              }
              .transcript-print-view tfoot {
                display: table-footer-group;
              }
            }
            .transcript-print-view {
              background: white;
              color: black;
            }
          `}</style>

          <ComponentCard title="Official Transcript">
            {/* Screen View */}
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center border-b-2 border-gray-300 pb-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OFFICIAL TRANSCRIPT</h1>
              </div>

              {/* Student Information */}
              <div className="space-y-2">
                <p><strong>Student Name:</strong> {studentInfo.name}</p>
                <p><strong>Student Number:</strong> {studentInfo.studentNumber}</p>
                <p><strong>Department:</strong> {studentInfo.departmentName}</p>
              </div>

              {/* Terms */}
              {termLabels.map((termLabel) => {
                const courses = groupedData[termLabel];
                const termGPA = termGPAs[termLabel] || 0;

                return (
                  <div key={termLabel} className="space-y-4">
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {termLabel}
                      </h2>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                              Course Code
                            </TableCell>
                            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                              Course Title
                            </TableCell>
                            <TableCell isHeader className="px-5 py-3 text-center font-medium text-gray-500 dark:text-gray-400">
                              Credits
                            </TableCell>
                            <TableCell isHeader className="px-5 py-3 text-center font-medium text-gray-500 dark:text-gray-400">
                              Score
                            </TableCell>
                            <TableCell isHeader className="px-5 py-3 text-center font-medium text-gray-500 dark:text-gray-400">
                              Grade
                            </TableCell>
                            <TableCell isHeader className="px-5 py-3 text-center font-medium text-gray-500 dark:text-gray-400">
                              Points
                            </TableCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {courses.map((course, index) => (
                            <TableRow key={`${termLabel}-${index}`}>
                              <TableCell className="px-5 py-3 font-medium text-gray-800 dark:text-white">
                                {course.courseCode}
                              </TableCell>
                              <TableCell className="px-5 py-3 text-gray-600 dark:text-gray-300">
                                {course.courseTitle}
                              </TableCell>
                              <TableCell className="px-5 py-3 text-center text-gray-600 dark:text-gray-300">
                                {course.credits}
                              </TableCell>
                              <TableCell className="px-5 py-3 text-center text-gray-600 dark:text-gray-300">
                                {course.grade.percentage.toFixed(1)}%
                              </TableCell>
                              <TableCell className="px-5 py-3 text-center font-medium text-gray-800 dark:text-white">
                                {course.grade.letter}
                              </TableCell>
                              <TableCell className="px-5 py-3 text-center text-gray-600 dark:text-gray-300">
                                {course.grade.points.toFixed(1)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Term GPA: {termGPA.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Cumulative GPA */}
              <div className="border-t-2 border-gray-300 pt-4 mt-6">
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    Cumulative GPA: {cumulativeGPA.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </ComponentCard>

        </div>
      </div>
    </div>
  );
}

