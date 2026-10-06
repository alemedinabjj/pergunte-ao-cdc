import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cit } from '../../../test/fixtures';
import { Answer } from './answer';

const cit1 = cit();
const cit2 = cit({ id: 2, path: 'Art. 18' });

describe('Answer', () => {
  it('renders known citations as buttons and unknown ones as text', async () => {
    const onSelect = vi.fn();
    render(
      <Answer
        text="Pode [1]. Ver [7]."
        citations={[cit1]}
        citedIds={null}
        streaming={false}
        onSelectCitation={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Fonte 1: CDC, Art. 49' }));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('button', { name: /Fonte 7/ })).toBeNull();
    expect(screen.getByText(/\[7\]/)).toBeInTheDocument();
  });

  it('handles comma lists and adjacent citations', () => {
    render(
      <Answer
        text="Ver [1, 2] e [2][1]."
        citations={[cit1, cit2]}
        citedIds={null}
        streaming={false}
        onSelectCitation={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button', { name: /Fonte 1/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Fonte 2/ })).toHaveLength(2);
  });

  it('renders markdown emphasis', () => {
    render(
      <Answer
        text="**Sim**, você pode."
        citations={[]}
        citedIds={null}
        streaming={false}
        onSelectCitation={vi.fn()}
      />,
    );
    expect(screen.getByText('Sim').tagName).toBe('STRONG');
  });
});
