import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: () => <main className="p-8 font-law">Pergunte ao CDC</main>,
});
