import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ChatSessionProvider } from '../features/chat/chat-session';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <ChatSessionProvider>
      <Outlet />
    </ChatSessionProvider>
  ),
});
