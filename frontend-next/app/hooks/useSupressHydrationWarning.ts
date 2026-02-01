import { useEffect } from 'react';

export function useSupressHydrationWarning() {
    useEffect(() => {
        // Suppress hydration warnings from browser extensions
        const originalError = console.error;
        console.error = (...args) => {
            if (
                typeof args[0] === 'string' &&
                args[0].includes('Extra attributes from the server') &&
                args[0].includes('fdprocessedid')
            ) {
                // Suppress this specific warning from browser extensions
                return;
            }
            originalError.apply(console, args);
        };

        return () => {
            console.error = originalError;
        };
    }, []);
}
