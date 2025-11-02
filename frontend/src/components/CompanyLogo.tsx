import { useState } from 'react';
import { getCompanyLogoUrl, getCompanyInitials, getCompanyColor } from '../utils/companyLogo';

interface CompanyLogoProps {
  company: string;
  size?: number;
  className?: string;
}

export default function CompanyLogo({ company, size = 48, className = '' }: CompanyLogoProps) {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = getCompanyLogoUrl(company, size);
  const initials = getCompanyInitials(company);
  const color = getCompanyColor(company);

  // If no logo URL or logo failed to load, show initials
  if (!logoUrl || logoError) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: `${color}20`,
          color: color,
          fontSize: `${size * 0.4}px`,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${company} logo`}
      className={`rounded-xl flex-shrink-0 object-contain bg-white ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      onError={() => setLogoError(true)}
      loading="lazy"
    />
  );
}
