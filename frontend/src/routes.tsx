/**
 * Application Routes
 * React Router configuration
 */

import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';
import { Dashboard } from './pages/Dashboard.js';
import { ScenarioBuilder } from './pages/ScenarioBuilder.js';
import { ExecutionView } from './pages/ExecutionView.js';
import { History } from './pages/History.js';
import { Reports } from './pages/Reports.js';
import { Settings } from './pages/Settings.js';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AppLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'builder', Component: ScenarioBuilder },
      { path: 'execute', Component: ExecutionView },
      { path: 'history', Component: History },
      { path: 'reports', Component: Reports },
      { path: 'settings', Component: Settings },
    ],
  },
]);