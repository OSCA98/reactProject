import React, { StrictMode } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import App from './App.jsx';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
