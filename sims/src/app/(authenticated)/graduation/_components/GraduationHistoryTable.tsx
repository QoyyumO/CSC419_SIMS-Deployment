'use client';

import React, { useState, useEffect } from 'react';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import Badge from '@/components/ui/badge/Badge';
import Button from '@/components/ui/button/Button';
import { useRouter } from 'next/navigation';

type GraduationRecord = {
  _id: Id<'graduationRecords'>;
  studentId: Id<'students'>;
  studentName: string;
  studentNumber: string;
  department: string;
  approvedBy: Id<'users'>;
  approverName: string;
  approverEmail: string;
  date: number;
  graduationYear: number;
};

interface GraduationHistoryTableProps {
  records: GraduationRecord[] | undefined;
  isLoading: boolean;
}

export default function GraduationHistoryTable({
  records,
  isLoading,
}: GraduationHistoryTableProps) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const [sortKey, setSortKey] = useState<'date' | 'studentName' | 'graduationYear'>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Update current time periodically for "time ago" calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Format date and time
  const formatDateTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    const diff = currentTime - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (weeks > 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} min ago`;
    } else {
      return 'Just now';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p>No graduation records found</p>
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => {
    let va: string | number = '';
    let vb: string | number = '';

    switch (sortKey) {
      case 'date':
        va = a.date;
        vb = b.date;
        break;
      case 'studentName':
        va = a.studentName;
        vb = b.studentName;
        break;
      case 'graduationYear':
        va = a.graduationYear;
        vb = b.graduationYear;
        break;
      default:
        va = a.date;
        vb = b.date;
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

    return 0;
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {sorted.length} graduation record{sorted.length !== 1 ? 's' : ''}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/grades/audit-log')}
        >
          View Full Audit Log
        </Button>
      </div>
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
                  onClick={() => handleSort('date')}
                >
                  Date Approved
                  {sortKey === 'date' && (sortAsc ? ' ↑' : ' ↓')}
                </div>
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
              >
                <div
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-5 -my-3 px-5 py-3"
                  onClick={() => handleSort('studentName')}
                >
                  Student
                  {sortKey === 'studentName' && (sortAsc ? ' ↑' : ' ↓')}
                </div>
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
              >
                <div
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-5 -my-3 px-5 py-3"
                  onClick={() => handleSort('graduationYear')}
                >
                  Graduation Year
                  {sortKey === 'graduationYear' && (sortAsc ? ' ↑' : ' ↓')}
                </div>
              </TableCell>
              <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                Department
              </TableCell>
              <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                Approved By
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((record) => (
              <TableRow key={record._id}>
                <TableCell className="px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {formatDateTime(record.date)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(record.date)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3">
                  <div>
                    <div className="font-medium text-gray-800 dark:text-white/90">
                      {record.studentName}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {record.studentNumber}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3">
                  <Badge color="primary" variant="light" size="sm">
                    {record.graduationYear}
                  </Badge>
                </TableCell>
                <TableCell className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {record.department}
                </TableCell>
                <TableCell className="px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {record.approverName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {record.approverEmail}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

