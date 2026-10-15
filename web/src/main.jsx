import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import 'leaflet/dist/leaflet.css';
import './theme.css';
import './styles.css';
import './screens.css';
import './kitchen.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
