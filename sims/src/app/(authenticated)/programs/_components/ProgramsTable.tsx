'use client';

import React from 'react';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import Badge from '@/components/ui/badge/Badge';
import { PieChartIcon } from '@/icons';

type Program = {
  _id: Id<'programs'>;
  name: string;
  departmentId: Id<'departments'>;
  departmentName: string;
  durationYears: number;
  creditRequirements: number;
  requiredCoursesCount: number;
};

interface ProgramsTableProps {
  programs: Program[] | undefined;
  isLoading: boolean;
}

export default function ProgramsTable({ programs, isLoading }: ProgramsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!programs || programs.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <PieChartIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No programs found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Program Name
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Department
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Duration
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Credit Requirements
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Required Courses
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.map((program) => (
            <TableRow key={program._id}>
              <TableCell className="px-5 py-3 text-start font-medium">
                {program.name}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {program.departmentName}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                <Badge color="primary" variant="light" size="sm">
                  {program.durationYears} {program.durationYears === 1 ? 'Year' : 'Years'}
                </Badge>
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {program.creditRequirements} credits
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {program.requiredCoursesCount} courses
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

