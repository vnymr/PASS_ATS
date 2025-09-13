import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Instrument_Serif } from "next/font/google";
import StructuredData from "@/components/seo/structured-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://getresume.us'),
  title: "Resume - AI-Powered Resume Generator | GetResume.us",
  description: "Turn your profile + any job post into a one-page, ATS-ready resume. Every time in under 20 seconds. Chrome extension for LinkedIn, Indeed, and other job sites.",
  icons: {
    icon: [
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/logo.png',
  },
  keywords: [
    "resume generator",
    "AI resume",
    "ATS resume",
    "chrome extension",
    "job application",
    "resume builder",
    "LinkedIn resume",
    "Indeed resume",
    "automatic resume",
    "resume AI",
    "job search tools",
    "resume optimization",
    "ATS compliant resume",
    "resume creator",
    "professional resume"
  ],
  authors: [{ name: "Resume AI Team" }],
  creator: "Resume AI",
  publisher: "Resume AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://getresume.us',
    title: 'Resume - AI-Powered Resume Generator',
    description: 'Turn your profile + any job post into a one-page, ATS-ready resume. Every time in under 20 seconds.',
    siteName: 'Resume AI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Resume AI - Generate ATS-ready resumes instantly',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resume - AI-Powered Resume Generator',
    description: 'Turn your profile + any job post into a one-page, ATS-ready resume. Every time in under 20 seconds.',
    images: ['/og-image.png'],
    creator: '@resumeai',
  },
  alternates: {
    canonical: 'https://getresume.us',
  },
  category: 'technology',
  classification: 'Business Software',
  other: {
    'google-site-verification': 'your-google-verification-code-here',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <StructuredData />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${instrumentSerif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
