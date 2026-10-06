import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/styles.css';
import './src/avalanche-theme.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
