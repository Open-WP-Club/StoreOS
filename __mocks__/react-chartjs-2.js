// Mock react-chartjs-2 for faster tests
import React from 'react';

export const Line = () => React.createElement('div', { 'data-testid': 'mock-line-chart' });
export const Bar = () => React.createElement('div', { 'data-testid': 'mock-bar-chart' });
export const Pie = () => React.createElement('div', { 'data-testid': 'mock-pie-chart' });
export const Doughnut = () => React.createElement('div', { 'data-testid': 'mock-doughnut-chart' });

export default { Line, Bar, Pie, Doughnut };
