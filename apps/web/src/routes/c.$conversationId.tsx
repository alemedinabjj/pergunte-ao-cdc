import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/c/$conversationId')({
  component: function ConversationRoute() {
    const { conversationId } = Route.useParams();
    return <main className="p-8">Conversa {conversationId}</main>;
  },
});
