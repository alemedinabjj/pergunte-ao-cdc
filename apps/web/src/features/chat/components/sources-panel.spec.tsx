import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cit } from '../../../test/fixtures';
import { SourcesPanel } from './sources-panel';

const cit1 = cit();
const cit2 = cit({
  id: 2,
  path: 'Art. 18',
  content: 'Art. 18. Os fornecedores respondem pelos vícios.',
});

describe('SourcesPanel', () => {
  it('fades uncited sources after done', () => {
    render(
      <SourcesPanel
        citations={[cit1, cit2]}
        citedIds={[1]}
        selectedId={null}
        onSelect={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByTestId('source-1')).toHaveAttribute('data-cited', 'true');
    expect(screen.getByTestId('source-2')).toHaveAttribute('data-cited', 'false');
  });

  it('keeps every source fully visible while the answer is streaming', () => {
    render(
      <SourcesPanel
        citations={[cit1, cit2]}
        citedIds={null}
        selectedId={null}
        onSelect={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByTestId('source-2')).toHaveAttribute('data-cited', 'true');
  });

  it('highlights the selected source text and links to planalto', () => {
    render(
      <SourcesPanel
        citations={[cit1, cit2]}
        citedIds={null}
        selectedId={2}
        onSelect={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByTestId('source-2').querySelector('.marker')).toHaveAttribute(
      'data-selected',
      'true',
    );
    expect(screen.getAllByRole('link', { name: 'Ver no planalto.gov.br' })[0]).toHaveAttribute(
      'href',
      cit1.sourceUrl,
    );
  });

  it('selects a source when its heading is clicked', async () => {
    const onSelect = vi.fn();
    render(
      <SourcesPanel
        citations={[cit1, cit2]}
        citedIds={null}
        selectedId={null}
        onSelect={onSelect}
        loading={false}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /CDC, Art. 18/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('shows the lookup state before sources arrive', () => {
    render(
      <SourcesPanel citations={[]} citedIds={null} selectedId={null} onSelect={vi.fn()} loading />,
    );
    expect(screen.getByText('Consultando a lei…')).toBeInTheDocument();
  });
});
