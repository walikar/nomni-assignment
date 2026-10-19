import { useEffect, useState } from 'react';
import { ALL_STATUSES, PROVIDER_LABELS, PROVIDERS, SORT_OPTIONS, STATUS_LABELS } from '../constants';
import { OrderFilters as Filters } from '../types';

interface OrderFiltersProps {
  filters: Filters;
  showClear: boolean;
  // replace = true updates the URL without adding a history entry (used while typing in search).
  onChange: (changes: Partial<Filters>, replace?: boolean) => void;
  onClear: () => void;
}

const SEARCH_DELAY_MS = 300;

const controlClass = 'w-full min-h-[40px] px-2.5 py-2 bg-surface text-ink border border-line rounded-lg';
const labelClass = 'block text-xs text-muted mb-1';

export default function OrderFilters({ filters, showClear, onChange, onClear }: OrderFiltersProps) {
  // What's typed in the search box. It's written to the URL after the user pauses typing.
  const [searchText, setSearchText] = useState(filters.search);

  // If the URL changes from outside (back button, Clear), show that in the box.
  useEffect(() => {
    setSearchText(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchText === filters.search) return;
    const timer = setTimeout(() => onChange({ search: searchText.trim() }, true), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText, filters.search, onChange]);

  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-wrap items-end gap-x-3 gap-y-2 mb-4"
    >
      <div className="flex-[1_1_260px]">
        <label htmlFor="search" className="sr-only">Search</label>
        <input
          id="search"
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search order ID, customer, phone"
          className={controlClass}
        />
      </div>

      <div className="flex-[1_1_calc(50%-6px)] md:flex-none">
        <label htmlFor="provider" className={labelClass}>Provider</label>
        <select id="provider" value={filters.provider} onChange={(e) => onChange({ provider: e.target.value })} className={controlClass}>
          <option value="">All</option>
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>
          ))}
        </select>
      </div>

      <div className="flex-[1_1_calc(50%-6px)] md:flex-none">
        <label htmlFor="status" className={labelClass}>Status</label>
        <select id="status" value={filters.status} onChange={(e) => onChange({ status: e.target.value })} className={controlClass}>
          <option value="">All</option>
          {ALL_STATUSES.map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
      </div>

      <div className="flex-[1_1_calc(50%-6px)] md:flex-none">
        <label htmlFor="sort" className={labelClass}>Sort</label>
        <select id="sort" value={filters.sort} onChange={(e) => onChange({ sort: e.target.value })} className={controlClass}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {showClear && (
        <button type="button" onClick={onClear} className="min-h-[40px] px-3.5 py-2 text-accent bg-transparent border border-transparent rounded-lg cursor-pointer">
          Clear
        </button>
      )}
    </form>
  );
}
