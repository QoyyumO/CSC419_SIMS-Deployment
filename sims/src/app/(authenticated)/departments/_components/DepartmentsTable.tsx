'use client';

import React from 'react';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import { PieChartIcon } from '@/icons';

type Department = {
  _id: Id<'departments'>;
  name: string;
  schoolId: Id<'schools'>;
  schoolName: string;
  headId: Id<'users'>;
};

interface DepartmentsTableProps {
  departments: Department[] | undefined;
  isLoading: boolean;
}

export default function DepartmentsTable({ departments, isLoading }: DepartmentsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!departments || departments.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <PieChartIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No departments found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Name
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              School Name
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {departments.map((department) => (
            <TableRow key={department._id}>
              <TableCell className="px-5 py-3 text-start font-medium">
                {department.name}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {department.schoolName}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

