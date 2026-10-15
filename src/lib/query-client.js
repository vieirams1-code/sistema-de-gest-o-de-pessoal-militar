import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Reaproveita dados recentes ao navegar entre telas em vez de recarregar tudo.
			staleTime: 2 * 60 * 1000,
		},
	},
});