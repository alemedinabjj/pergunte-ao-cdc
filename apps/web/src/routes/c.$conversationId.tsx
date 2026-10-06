import { createFileRoute } from '@tanstack/react-router';
import { ChatPage } from '../features/chat/chat-page';

export const Route = createFileRoute('/c/$conversationId')({
  component: function ConversationRoute() {
    const { conversationId } = Route.useParams();
    return <ChatPage conversationId={conversationId} />;
  },
});
