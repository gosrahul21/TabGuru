import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Paywall from './Paywall';
import './paywall.css';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Paywall />
  </StrictMode>,
);
