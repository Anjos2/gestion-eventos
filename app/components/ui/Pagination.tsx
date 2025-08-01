'use client';

import Link from 'next/link';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
  path: string;
}

export default function Pagination({ currentPage, totalCount, itemsPerPage, path }: PaginationProps) {
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (totalPages <= 1) {
    return null;
  }

  const prevPagePath = currentPage > 1 ? `${path}?page=${currentPage - 1}` : '#';
  const nextPagePath = currentPage < totalPages ? `${path}?page=${currentPage + 1}` : '#';

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <div className="flex justify-between items-center mt-6 text-slate-400">
      <div>
        <p className="text-sm">
          Mostrando <span className="font-medium text-white">{startItem}</span> a <span className="font-medium text-white">{endItem}</span> de <span className="font-medium text-white">{totalCount}</span> resultados
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link href={prevPagePath} passHref>
          <button
            disabled={currentPage === 1}
            className="px-3 py-2 bg-slate-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
          >
            <FiChevronLeft />
          </button>
        </Link>
        <span className="text-sm font-medium text-white">
          Página {currentPage} de {totalPages}
        </span>
        <Link href={nextPagePath} passHref>
          <button
            disabled={currentPage === totalPages}
            className="px-3 py-2 bg-slate-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
          >
            <FiChevronRight />
          </button>
        </Link>
      </div>
    </div>
  );
}