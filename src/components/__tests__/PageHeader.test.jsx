import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PageHeader from '../PageHeader';

describe('PageHeader', () => {
  it('should render title', () => {
    render(<PageHeader title="Test Title" />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Title');
  });

  it('should render subtitle when provided', () => {
    render(<PageHeader title="Title" subtitle="This is a subtitle" />);

    expect(screen.getByText('This is a subtitle')).toBeInTheDocument();
  });

  it('should not render subtitle when not provided', () => {
    const { container } = render(<PageHeader title="Title" />);

    const subtitle = container.querySelector('p');
    expect(subtitle).not.toBeInTheDocument();
  });

  it('should render actions when provided', () => {
    render(
      <PageHeader
        title="Title"
        actions={<button>Action Button</button>}
      />
    );

    expect(screen.getByRole('button', { name: /action button/i })).toBeInTheDocument();
  });

  it('should not render actions container when not provided', () => {
    const { container } = render(<PageHeader title="Title" />);

    // Should only have one direct child div (the title container)
    const mainContainer = container.firstChild;
    const children = mainContainer.children;

    // When no actions, we expect only the title container
    expect(children).toHaveLength(1);
  });

  it('should render multiple action buttons', () => {
    render(
      <PageHeader
        title="Title"
        actions={
          <>
            <button>First</button>
            <button>Second</button>
            <button>Third</button>
          </>
        }
      />
    );

    expect(screen.getByRole('button', { name: /first/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /second/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /third/i })).toBeInTheDocument();
  });

  it('should handle click events on action buttons', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <PageHeader
        title="Title"
        actions={<button onClick={handleClick}>Click Me</button>}
      />
    );

    await user.click(screen.getByRole('button', { name: /click me/i }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply correct styling classes', () => {
    const { container } = render(
      <PageHeader title="Title" subtitle="Subtitle" />
    );

    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass('mb-6');
    expect(mainContainer).toHaveClass('flex');
    expect(mainContainer).toHaveClass('justify-between');
    expect(mainContainer).toHaveClass('items-start');
  });

  it('should apply correct title styling', () => {
    render(<PageHeader title="Title" />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('text-2xl');
    expect(heading).toHaveClass('font-bold');
  });

  it('should apply correct subtitle styling', () => {
    render(<PageHeader title="Title" subtitle="Subtitle" />);

    const subtitle = screen.getByText('Subtitle');
    expect(subtitle).toHaveClass('text-gray-600');
    expect(subtitle).toHaveClass('mt-1');
  });

  it('should support dark mode styling', () => {
    render(<PageHeader title="Title" subtitle="Subtitle" />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('dark:text-white');

    const subtitle = screen.getByText('Subtitle');
    expect(subtitle).toHaveClass('dark:text-gray-400');
  });

  it('should render complex action elements', () => {
    render(
      <PageHeader
        title="Title"
        actions={
          <div className="flex gap-2">
            <input type="text" placeholder="Search" />
            <select>
              <option>Option 1</option>
            </select>
            <button>Submit</button>
          </div>
        }
      />
    );

    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should handle empty string subtitle', () => {
    const { container } = render(<PageHeader title="Title" subtitle="" />);

    // Empty string is falsy, so subtitle should not render
    const subtitle = container.querySelector('p');
    expect(subtitle).not.toBeInTheDocument();
  });

  it('should handle long titles gracefully', () => {
    const longTitle = 'This is a very long title that might wrap to multiple lines in a real application';
    render(<PageHeader title={longTitle} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(longTitle);
  });

  it('should handle long subtitles gracefully', () => {
    const longSubtitle = 'This is a very long subtitle that provides detailed information about the current page and its functionality';
    render(<PageHeader title="Title" subtitle={longSubtitle} />);

    expect(screen.getByText(longSubtitle)).toBeInTheDocument();
  });

  it('should maintain proper structure with all props', () => {
    const { container } = render(
      <PageHeader
        title="Title"
        subtitle="Subtitle"
        actions={<button>Action</button>}
      />
    );

    const mainContainer = container.firstChild;
    const children = mainContainer.children;

    // Should have title container and actions container
    expect(children).toHaveLength(2);
  });
});
