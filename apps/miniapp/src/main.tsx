import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './styles/vintage.css';
import './styles/team-community.css';
import { bootTelegram, hasTelegramLaunchData } from './lib/telegram';
import { ThemeProvider } from './providers/ThemeProvider';
import { CommunityProvider } from './providers/CommunityProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

function TelegramLaunchRequired() {
  return (
    <main className="page-shell min-h-screen">
      <section className="surface-card mx-auto mt-10 max-w-xl p-6 text-center">
        <div className="section-kicker">Telegram Mini App</div>
        <h1 className="section-title mt-2">Open HOOMA from Telegram</h1>
        <p className="mt-3 muted">
          This HOOMA entry requires a verified Telegram Mini App launch. Open HOOMA from the bot
          menu button so Telegram can securely provide your account identity.
        </p>
      </section>
    </main>
  );
}

async function start() {
  await bootTelegram();

  const telegramEntry =
    window.location.pathname === '/telegram' || window.location.pathname.startsWith('/telegram/');
  const telegramReady = !telegramEntry || hasTelegramLaunchData();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        {telegramReady ? (
          <ThemeProvider>
            <BrowserRouter>
              <CommunityProvider>
                <App />
              </CommunityProvider>
            </BrowserRouter>
          </ThemeProvider>
        ) : (
          <TelegramLaunchRequired />
        )}
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void start();
