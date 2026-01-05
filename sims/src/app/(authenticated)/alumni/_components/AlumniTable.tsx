'use client';

import React, { useState } from 'react';
import { Id } from '@/lib/convex';
import Button from '@/components/ui/button/Button';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import Badge from '@/components/ui/badge/Badge';

type Address = {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type AlumniRow = {
  _id: Id<'alumniProfiles'>;
  name: string | null;
  graduationYear: number;
  department?: { _id: Id<'departments'>; name: string } | null;
  employmentStatus: string;
  contactInfo: { email: string; phone: string; address?: Address };
};

interface AlumniTableProps {
  alumni: AlumniRow[] | undefined;
  isLoading: boolean;
}

export default function AlumniTable({ alumni, isLoading }: AlumniTableProps) {
  const [sortKey] = useState<'name' | 'graduationYear' | 'department'>('graduationYear');
  const [sortAsc] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!alumni || alumni.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p>No alumni found</p>
      </div>
    );
  }

  const sorted = [...alumni].sort((a, b) => {
    // Determine values for comparison in a type-safe way
    let va: string | number = '';
    let vb: string | number = '';

    switch (sortKey) {
      case 'name':
        va = a.name ?? '';
        vb = b.name ?? '';
        break;
      case 'graduationYear':
        va = a.graduationYear ?? 0;
        vb = b.graduationYear ?? 0;
        break;
      case 'department':
        va = a.department?.name ?? '';
        vb = b.department?.name ?? '';
        break;
      default:
        va = String(a.name ?? '');
        vb = String(b.name ?? '');
    }

    // Compare strings (case-insensitive) and numbers appropriately
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

    // Fallback string comparison for mixed types
    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa < sb) return sortAsc ? -1 : 1;
    if (sa > sb) return sortAsc ? 1 : -1;
    return 0;
  });

  const exportCSV = () => {
    const header = ['Name', 'Graduation Year', 'Department', 'Employment Status', 'Email', 'Phone'];
    const rows = sorted.map(r => [r.name ?? '', String(r.graduationYear), r.department?.name ?? '', r.employmentStatus, r.contactInfo.email ?? '', r.contactInfo.phone ?? '']);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alumni_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Button size="sm" onClick={exportCSV}>Export CSV</Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">Name</TableCell>
              <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">Graduation Year</TableCell>
              <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">Department</TableCell>
              <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">Employment</TableCell>
              <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">Contact</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row._id}>
                <TableCell className="px-5 py-3 text-start">{row.name}</TableCell>
                <TableCell className="px-5 py-3 text-start">{row.graduationYear}</TableCell>
                <TableCell className="px-5 py-3 text-start">{row.department?.name ?? '-'}</TableCell>
                <TableCell className="px-5 py-3 text-start">
                  <Badge color={row.employmentStatus === 'employed' ? 'success' : 'light'} variant="light" size="sm">
                    {row.employmentStatus}
                  </Badge>
                </TableCell>
                <TableCell className="px-5 py-3 text-start">
                  <div>{row.contactInfo.email}</div>
                  <div className="text-sm text-gray-500">{row.contactInfo.phone}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
