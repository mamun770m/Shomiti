import { createRoot } from 'react-dom/client';
import { installNetlifyStaticApiEngine } from './lib/netlifyStaticEngine.ts';
import App from './App.tsx';
import './index.css';

installNetlifyStaticApiEngine();

createRoot(document.getElementById('root')!).render(<App />);

