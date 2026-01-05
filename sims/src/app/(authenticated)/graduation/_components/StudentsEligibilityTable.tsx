'use client';

import React, { useState } from 'react';
import { Id } from '@/lib/convex';
import Button from '@/components/ui/button/Button';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import Badge from '@/components/ui/badge/Badge';

type StudentRow = {
  _id: Id<'students'>;
  studentNumber: string;
  name: string;
  email: string;
  department: { _id: Id<'departments'>; name: string } | null;
  status: string;
  level: string;
  gpa: number;
  totalCredits: number;
};

interface StudentsEligibilityTableProps {
  students: StudentRow[] | undefined;
  isLoading: boolean;
  onCheckEligibility: (studentId: Id<'students'>) => void;
  checkingStudentId: Id<'students'> | null;
}

export default function StudentsEligibilityTable({
  students,
  isLoading,
  onCheckEligibility,
  checkingStudentId,
}: StudentsEligibilityTableProps) {
  const [sortKey, setSortKey] = useState<'name' | 'studentNumber' | 'department' | 'gpa' | 'credits'>('name');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p>No students found</p>
      </div>
    );
  }

  const sorted = [...students].sort((a, b) => {
    let va: string | number = '';
    let vb: string | number = '';

    switch (sortKey) {
      case 'name':
        va = a.name ?? '';
        vb = b.name ?? '';
        break;
      case 'studentNumber':
        va = a.studentNumber ?? '';
        vb = b.studentNumber ?? '';
        break;
      case 'department':
        va = a.department?.name ?? '';
        vb = b.department?.name ?? '';
        break;
      case 'gpa':
        va = a.gpa ?? 0;
        vb = b.gpa ?? 0;
        break;
      case 'credits':
        va = a.totalCredits ?? 0;
        vb = b.totalCredits ?? 0;
        break;
      default:
        va = String(a.name ?? '');
        vb = String(b.name ?? '');
    }

    if (typeof va === 'string' && typeof vb === 'string') {
      const la = va.toLowerCase();
      const lb = vb.toLowerCase();
      if (la < lb) return sortAsc ? -1 : 1;
      if (la > lb) return sortAsc ? 1 : -1;
      return 0;
    }

    if (typeof va === 'number' && typeof vb === 'number') {
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    }

    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa < sb) return sortAsc ? -1 : 1;
    if (sa > sb) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              <div
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-5 -my-3 px-5 py-3"
                onClick={() => handleSort('studentNumber')}
              >
                Student Number
                {sortKey === 'studentNumber' && (sortAsc ? ' ↑' : ' ↓')}
              </div>
            </TableCell>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              <div
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-5 -my-3 px-5 py-3"
                onClick={() => handleSort('name')}
              >
                Name
                {sortKey === 'name' && (sortAsc ? ' ↑' : ' ↓')}
              </div>
            </TableCell>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              <div
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-5 -my-3 px-5 py-3"
                onClick={() => handleSort('department')}
              >
                Department
                {sortKey === 'department' && (sortAsc ? ' ↑' : ' ↓')}
              </div>
            </TableCell>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              <div
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-5 -my-3 px-5 py-3"
                onClick={() => handleSort('gpa')}
              >
                GPA
                {sortKey === 'gpa' && (sortAsc ? ' ↑' : ' ↓')}
              </div>
            </TableCell>
            <TableCell
              isHeader
              className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
            >
              <div
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-5 -my-3 px-5 py-3"
                onClick={() => handleSort('credits')}
              >
                Credits
                {sortKey === 'credits' && (sortAsc ? ' ↑' : ' ↓')}
              </div>
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Status
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Action
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row._id}>
              <TableCell className="px-5 py-3 text-start">{row.studentNumber}</TableCell>
              <TableCell className="px-5 py-3 text-start">
                <div>
                  <div className="font-medium text-gray-800 dark:text-white/90">{row.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{row.email}</div>
                </div>
              </TableCell>
              <TableCell className="px-5 py-3 text-start">{row.department?.name ?? '-'}</TableCell>
              <TableCell className="px-5 py-3 text-start">
                <span className="font-medium">{row.gpa.toFixed(2)}</span>
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                <span className="font-medium">{row.totalCredits}</span>
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                <Badge
                  color={
                    row.status === 'active'
                      ? 'success'
                      : row.status === 'suspended'
                      ? 'error'
                      : 'light'
                  }
                  variant="light"
                  size="sm"
                >
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCheckEligibility(row._id)}
                  disabled={checkingStudentId === row._id}
                >
                  {checkingStudentId === row._id ? 'Checking...' : 'Check Eligibility'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

