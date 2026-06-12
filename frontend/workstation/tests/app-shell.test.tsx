import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import App from '../src/App';

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('React workstation shell', () => {
  it('renders the professional chart-first app shell', () => {
    renderApp();
    expect(screen.getByText('Trading Research Workstation')).toBeInTheDocument();
    expect(screen.getByText('React + TypeScript workstation shell')).toBeInTheDocument();
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
    expect(screen.getByText('AI Research')).toBeInTheDocument();
  });

  it('switches right dock sections without legacy DOM delegation', async () => {
    renderApp();
    await userEvent.click(screen.getByLabelText('AI'));
    expect(screen.getByText('AI Workflow')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Paper'));
    expect(screen.getByText('Paper Trading')).toBeInTheDocument();
  });
});
