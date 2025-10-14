import './globals.css';
import { ReactNode } from 'react';
import BubbleBackground from '@/components/BubbleBackground';

export const metadata = {
  title: 'IPad Tracking System',
  description: 'IPad Tracking System Application',};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <BubbleBackground />
        {children}
      </body>
    </html>
  );
}
