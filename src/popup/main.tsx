import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import './popup.css';
import { ThemeProvider } from '../newtab/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Popup />
    </ThemeProvider>
  </React.StrictMode>
);
