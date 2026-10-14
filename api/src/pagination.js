// Server-side pagination: the browser never receives more than one page.
const MAX_PAGE_SIZE = 100;

export function readPage(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paged(rows, total, { page, pageSize }) {
  return { data: rows, page, pageSize, total: Number(total) };
}
