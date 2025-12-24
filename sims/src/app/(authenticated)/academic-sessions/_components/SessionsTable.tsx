'use client';

import React from 'react';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';

type AcademicSession = {
  _id: Id<'academicSessions'>;
  yearLabel: string;
  startDate: number;
  endDate: number;
};

interface SessionsTableProps {
  sessions: AcademicSession[] | undefined;
  isLoading: boolean;
}

export default function SessionsTable({ sessions, isLoading }: SessionsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p>No academic sessions found</p>
        <p className="mt-2 text-sm">Create your first academic session to get started</p>
      </div>
    );
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              Year Label
            </TableCell>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              Start Date
            </TableCell>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              End Date
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session._id}>
              <TableCell className="px-5 py-3 text-start font-medium">
                {session.yearLabel}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {formatDate(session.startDate)}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {formatDate(session.endDate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

