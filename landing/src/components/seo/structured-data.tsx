export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Resume AI",
    "description": "AI-powered resume generator that creates ATS-ready resumes from your profile and job posts in under 20 seconds",
    "url": "https://getresume.us",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Chrome, Edge, Firefox",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "creator": {
      "@type": "Organization",
      "name": "Resume AI Team",
      "url": "https://getresume.us"
    },
    "featureList": [
      "AI-powered resume generation",
      "ATS optimization",
      "Chrome extension integration",
      "LinkedIn job parsing",
      "Indeed job parsing",
      "One-click resume creation",
      "Professional templates",
      "PDF export"
    ],
    "screenshot": "https://getresume.us/og-image.png",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "2400"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
