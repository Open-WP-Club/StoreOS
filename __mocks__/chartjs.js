// Mock Chart.js for faster tests
import { vi } from 'vitest';

export const Chart = {
  register: vi.fn(),
  defaults: {
    font: {},
    color: '',
  },
};

export const registerables = [];

export default Chart;
