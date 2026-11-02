import React, { type ChangeEvent } from 'react';
import { Calendar } from 'lucide-react';
import { TIME_RANGES } from '../../constants/timeRanges';

interface TimeRangeSelectProps {
  value: number;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}

function TimeRangeSelect({ value, onChange }: TimeRangeSelectProps): React.ReactElement {
  return (
    <>
      <label
        htmlFor="time-range-select"
        className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Calendar className="w-4 h-4" />
        <span>Time Range:</span>
      </label>
      <select
        id="time-range-select"
        value={value}
        onChange={onChange}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
      >
        {TIME_RANGES.map((range) => (
          <option key={range.value} value={range.value}>
            {range.label}
          </option>
        ))}
      </select>
    </>
  );
}

export default TimeRangeSelect;
