import type { Law } from '@cdc/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './composer';

const laws: Law[] = [
  {
    slug: 'cdc',
    title: 'Código de Defesa do Consumidor',
    shortName: 'CDC',
    reference: 'Lei nº 8.078/1990',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  },
];

describe('Composer', () => {
  it('submits on Enter with the selected law and clears the field', async () => {
    const onSubmit = vi.fn();
    render(<Composer laws={laws} busy={false} onSubmit={onSubmit} onStop={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText('Lei'), 'cdc');
    const field = screen.getByLabelText('Sua pergunta');
    await userEvent.type(field, 'posso devolver?{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('posso devolver?', 'cdc');
    expect(field).toHaveValue('');
  });

  it('Shift+Enter adds a new line instead of submitting', async () => {
    const onSubmit = vi.fn();
    render(<Composer laws={laws} busy={false} onSubmit={onSubmit} onStop={vi.fn()} />);
    await userEvent.type(
      screen.getByLabelText('Sua pergunta'),
      'linha 1{Shift>}{Enter}{/Shift}linha 2',
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Sua pergunta')).toHaveValue('linha 1\nlinha 2');
  });

  it('ignores questions shorter than 3 characters and searches all laws by default', async () => {
    const onSubmit = vi.fn();
    render(<Composer laws={laws} busy={false} onSubmit={onSubmit} onStop={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'oi{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Perguntar' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Sua pergunta'), ' tudo bem?{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('oi tudo bem?', undefined);
  });

  it('shows Parar while busy and calls onStop', async () => {
    const onStop = vi.fn();
    render(<Composer laws={laws} busy onSubmit={vi.fn()} onStop={onStop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Parar' }));
    expect(onStop).toHaveBeenCalled();
  });
});
