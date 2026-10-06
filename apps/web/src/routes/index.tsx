import { createFileRoute } from '@tanstack/react-router';
import { ChatPage } from '../features/chat/chat-page';
import { Sidebar } from '../features/conversations/sidebar';

export const Route = createFileRoute('/')({
  component: () => <ChatPage sidebar={<Sidebar />} />,
});
