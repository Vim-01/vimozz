import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import StreamerPanel from './pages/StreamerPanel';
import OBSOverlay from './pages/OBSOverlay';
import { QueueProvider } from './context/QueueContext';

const App: React.FC = () => {
  return (
    <QueueProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<StreamerPanel />} />
          <Route path="/obs" element={<OBSOverlay />} />
        </Routes>
      </HashRouter>
    </QueueProvider>
  );
};

export default App;