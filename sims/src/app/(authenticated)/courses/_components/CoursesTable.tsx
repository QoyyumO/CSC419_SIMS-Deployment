'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import Badge from '@/components/ui/badge/Badge';

type Course = {
  _id: Id<'courses'>;
  code: string;
  title: string;
  credits: number;
  department?: {
    _id: Id<'departments'>;
    name: string;
  } | null;
  programs?: Array<{
    _id: Id<'programs'>;
    name: string;
  }>;
  status?: string;
  level?: string;
};

interface CoursesTableProps {
  courses: Course[] | undefined;
  isLoading: boolean;
}

export default function CoursesTable({ courses, isLoading }: CoursesTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium mb-2">No courses found</p>
        <p className="text-sm">Try adjusting your search or filter criteria</p>
      </div>
    );
  }

  const handleRowClick = (courseId: Id<'courses'>) => {
    router.push(`/courses/${courseId}`);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Course Code
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Title
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Credits
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Department
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Programs
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Status
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Level
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.map((course) => (
            <TableRow 
              key={course._id}
              onClick={() => handleRowClick(course._id)}
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <TableCell className="px-5 py-3 text-start font-medium">
                {course.code}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {course.title}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {course.credits}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {course.department?.name || '-'}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {course.programs && course.programs.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {course.programs.slice(0, 2).map((program) => (
                      <Badge key={program._id} color="info" variant="light" size="sm">
                        {program.name}
                      </Badge>
                    ))}
                    {course.programs.length > 2 && (
                      <Badge color="info" variant="light" size="sm">
                        +{course.programs.length - 2}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                <Badge 
                  color={
                    course.status === 'C' ? 'primary' : 
                    course.status === 'R' ? 'success' : 
                    'light'
                  } 
                  variant="light" 
                  size="sm"
                >
                  {course.status === 'C' ? 'Core' : course.status === 'R' ? 'Required' : course.status === 'E' ? 'Elective' : course.status || 'E'}
                </Badge>
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                <Badge color="primary" variant="light" size="sm">
                  {course.level}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

