import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface TableProps<T> extends HTMLAttributes<HTMLTableElement> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  striped?: boolean;
  hoverable?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  loading = false,
  striped = true,
  hoverable = true,
  className = '',
  ...props
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${className}`} {...props}>
        <thead>
          <tr className="bg-graphite/50 border-b border-graphite">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-left text-caption font-w510 text-ash uppercase tracking-wider ${col.headerClassName || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-fog">
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-acid-lime" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 100" strokeLinecap="round" />
                  </svg>
                  Loading...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-ash">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyExtractor(row)}
                className={`
                  border-b border-graphite/50 transition-colors
                  ${striped && index % 2 === 1 ? 'bg-white/[0.02]' : ''}
                  ${hoverable && onRowClick ? 'hover:bg-graphite/50 cursor-pointer' : ''}
                `}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-body-sm text-mist ${col.className || ''}`}>
                    {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}