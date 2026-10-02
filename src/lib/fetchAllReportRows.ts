/** Read every page; never return a silently truncated or partially failed report. */
export async function fetchAllReportRows<T>(query: { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
