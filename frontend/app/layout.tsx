export const metadata = {
  title: 'Farmer Management System',
  description: 'Field planning with Mapbox'
};

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

