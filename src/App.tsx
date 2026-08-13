import React, { useState } from 'react';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';

type Page = 'home' | 'dashboard';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
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
  );
}

export default App;