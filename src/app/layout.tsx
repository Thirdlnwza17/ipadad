import './globals.css';
import { ReactNode } from 'react';
import BubbleBackground from '@/components/BubbleBackground';
import { IBM_Plex_Sans_Thai } from 'next/font/google';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-ibm-plex-sans-thai',
});

export const metadata = {
  title: 'IPad Tracking System',
  description: 'IPad Tracking System Application',};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={ibmPlexSansThai.variable}>
      <body>
        <BubbleBackground />
        {children}
      </body>
    </html>
  );
}
