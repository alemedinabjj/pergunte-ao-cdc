import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-client';

export function useConversations() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: api.conversations });
}

export function useConversation(id: string) {
  return useQuery({ queryKey: queryKeys.conversation(id), queryFn: () => api.conversation(id) });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.conversation(id) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}
