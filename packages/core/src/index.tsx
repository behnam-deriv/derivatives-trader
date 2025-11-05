/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from 'App/app.jsx';
import initStore from 'App/initStore';
import { AnalyticsInitializer } from 'Utils/Analytics';
// eslint-disable-next-line
import registerServiceWorker from 'Utils/PWA';

import AppNotificationMessages from './App/Containers/app-notification-messages.jsx';

import 'promise-polyfill';

AnalyticsInitializer();
if (
    !!window?.localStorage.getItem?.('debug_service_worker') || // To enable local service worker related development
    !window.location.hostname.startsWith('localhost')
) {
    registerServiceWorker();
}

const initApp = async () => {
    // For simplified authentication, we don't need to pass accounts to initStore
    // The authentication will be handled by temp-auth.js and client-store.js
    const root_store = initStore(AppNotificationMessages);

    const wrapper = document.getElementById('derivatives_trader');
    if (wrapper) {
        // Create root with React 18 compatibility options
        const root = createRoot(wrapper, {
            // Add error recovery handler for better debugging
            onRecoverableError: error => {
                // Only log in development to avoid console errors in production
                if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.error('React recoverable error:', error);
                }
            },
        });

        // Render the app - React 18 will handle batching automatically
        // For MobX compatibility, ensure stores are properly configured with React 18
        root.render(<App root_store={root_store} />);
    }
};

initApp();
