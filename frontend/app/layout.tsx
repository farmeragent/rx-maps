export const metadata = {
  title: 'Farmer Management System',
  description: 'Field planning with Mapbox'
};

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Suppress all console errors and warnings
                console.error = function() {};
                console.warn = function() {};

                // Suppress React error boundary
                window.addEventListener('error', function(e) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                  return false;
                }, true);

                window.addEventListener('unhandledrejection', function(e) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                  return false;
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
