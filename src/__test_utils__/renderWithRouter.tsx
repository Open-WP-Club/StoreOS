import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { ReactElement } from 'react';

interface RenderWithRouterOptions extends RenderOptions {
  routerProps?: MemoryRouterProps;
}

/**
 * Render a component wrapped in MemoryRouter for testing
 * components that use react-router hooks (useNavigate, useParams, etc.)
 */
export function renderWithRouter(
  ui: ReactElement,
  { routerProps = {}, ...renderOptions }: RenderWithRouterOptions = {}
) {
  return render(<MemoryRouter {...routerProps}>{ui}</MemoryRouter>, renderOptions);
}

export default renderWithRouter;
