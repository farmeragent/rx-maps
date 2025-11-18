export const metadata = {
  title: 'Farmer Management System',
  description: 'Field planning with Mapbox'
};

import { CopilotKit } from '@copilotkit/react-core';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        
      </head>
      <body>
        <CopilotKit runtimeUrl="/api/copilotkit" agent="root_agent">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
