'use client';

import React from 'react';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';

type Term = {
  _id: Id<'terms'>;
  sessionId: Id<'academicSessions'>;
  sessionYearLabel: string;
  name: string;
  startDate: number;
  endDate: number;
};

interface TermsTableProps {
  terms: Term[] | undefined;
  isLoading: boolean;
}

export default function TermsTable({ terms, isLoading }: TermsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!terms || terms.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p>No terms found</p>
        <p className="mt-2 text-sm">Create your first term to get started</p>
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
              Session
            </TableCell>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              Term Name
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
          {terms.map((term) => (
            <TableRow key={term._id}>
              <TableCell className="px-5 py-3 text-start font-medium">
                {term.sessionYearLabel}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {term.name}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {formatDate(term.startDate)}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {formatDate(term.endDate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

