import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import { createNavigationSocket } from './services/socket';
import { useStore } from './store';
import { ThemeProvider } from './theme/ThemeProvider';

type Page = 'home' | 'dashboard';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const setWebsocketStatus = useStore((state) => state.setWebsocketStatus);
  const loadPorts = useStore((state) => state.loadPorts);

  useEffect(() => {
    const socket = createNavigationSocket(({ connected }) => setWebsocketStatus(connected));
    return () => {
      socket.disconnect();
    };
  }, [setWebsocketStatus]);

  useEffect(() => {
    void loadPorts();
  }, [loadPorts]);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
        <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      {currentPage === 'home' && (
        <div className="page-enter">
          <HomePage onNavigate={handleNavigate} />
        </div>
      )}

        {currentPage === 'dashboard' && (
          <div className="page-enter">
            <DashboardPage onNavigate={handleNavigate} />
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;