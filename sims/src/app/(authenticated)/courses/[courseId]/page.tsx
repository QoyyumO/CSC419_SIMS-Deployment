'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import Button from '@/components/ui/button/Button';
import Badge from '@/components/ui/badge/Badge';

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

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as Id<'courses'>;

  // Fetch course details
  const courseDetails = useQuery(
    api.courses.getDetails,
    courseId ? { courseId } : 'skip'
  ) as CourseDetails | undefined;

  const isLoading = courseDetails === undefined;

  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Course Details" />
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      </div>
    );
  }

  if (!courseDetails) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Course Details" />
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium mb-2">Course not found</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Course Details" />

      <div className="space-y-6">
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
          </div>
        </ComponentCard>

        {/* Available Sections Table */}
        <ComponentCard title="Available Sections" desc="Browse available class sections for this course">
          {courseDetails.activeSections.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                      Section ID
                    </TableCell>
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
                      <TableCell className="px-5 py-3 text-start font-medium">
                        {section.sectionId.slice(-8)}
                      </TableCell>
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
                          variant="primary"
                          disabled={true}
                        >
                          Register
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
      </div>
    </div>
  );
}

