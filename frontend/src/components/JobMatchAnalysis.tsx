import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import Icons from './ui/icons';

interface MatchAnalysis {
  overallScore: number;
  overallRating: string;
  breakdown: {
    skills: {
      score: number;
      matchedSkills: string[];
      missingSkills: string[];
      extraSkills: string[];
      details: string;
    };
    experience: {
      score: number;
      userYears: number;
      requiredYears: number;
      userLevel: string;
      jobLevel: string;
      details: string;
      experiences: Array<{ company: string; role: string; dates: string }>;
    };
    education: {
      score: number;
      details: string;
    };
    location: {
      score: number;
      details: string;
    };
    cultureFit: {
      score: number;
      details: string;
    };
  };
  insights: string;
  jobInfo: {
    title: string;
    company: string;
    location: string;
    salary?: string;
  };
}

interface JobMatchAnalysisProps {
  jobId: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function JobMatchAnalysis({ jobId }: JobMatchAnalysisProps) {
  const { getToken } = useAuth();
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadAnalysis();
  }, [jobId]);

  async function loadAnalysis() {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        setError('Please sign in to see match analysis');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/jobs/${jobId}/match-analysis`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      setError('Failed to load match analysis');
    } finally {
      setLoading(false);
    }
  }

  const Icon = (name: keyof typeof Icons) => {
    const Component = Icons[name];
    return <Component className="w-4 h-4" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return '#10B981'; // Green
    if (score >= 0.6) return '#F59E0B'; // Orange
    if (score >= 0.4) return '#6B7280'; // Gray
    return '#EF4444'; // Red
  };

  const getScoreIcon = (score: number) => {
    if (score >= 0.8) return '✅';
    if (score >= 0.6) return '⚠️';
    return '❌';
  };

  if (loading) {
    return (
      <div className="bg-elevated rounded-2xl border border-[rgba(28,63,64,0.12)] p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
        <p className="text-sm text-yellow-800">{error}</p>
        {error.includes('profile') && (
          <a href="/memory" className="text-sm text-primary hover:underline mt-2 inline-block">
            Complete your profile →
          </a>
        )}
      </div>
    );
  }

  if (!analysis) return null;

  const overallScorePercent = Math.round(analysis.overallScore * 100);
  const scoreColor = getScoreColor(analysis.overallScore);

  return (
    <div className="bg-elevated rounded-2xl border border-[rgba(28,63,64,0.12)] p-6 shadow-sm">
      {/* Header: Overall Score */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-text mb-1">Match Analysis</h3>
          <p className="text-sm text-gray-600">{analysis.overallRating}</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl"
            style={{
              backgroundColor: `${scoreColor}20`,
              color: scoreColor
            }}
          >
            {overallScorePercent}%
          </div>
        </div>
      </div>

      {/* Breakdown Sections */}
      <div className="space-y-4">
        {/* Skills */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getScoreIcon(analysis.breakdown.skills.score)}</span>
              <h4 className="font-semibold text-text">Skills Match</h4>
            </div>
            <span className="text-sm font-bold" style={{ color: getScoreColor(analysis.breakdown.skills.score) }}>
              {Math.round(analysis.breakdown.skills.score * 100)}%
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{analysis.breakdown.skills.details}</p>

          {expanded && (
            <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
              {analysis.breakdown.skills.matchedSkills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-600 mb-1">✅ You Have:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.breakdown.skills.matchedSkills.map((skill, i) => (
                      <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.breakdown.skills.missingSkills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-orange-600 mb-1">📚 Learn:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.breakdown.skills.missingSkills.map((skill, i) => (
                      <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Experience */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getScoreIcon(analysis.breakdown.experience.score)}</span>
              <h4 className="font-semibold text-text">Experience Match</h4>
            </div>
            <span className="text-sm font-bold" style={{ color: getScoreColor(analysis.breakdown.experience.score) }}>
              {Math.round(analysis.breakdown.experience.score * 100)}%
            </span>
          </div>
          <p className="text-sm text-gray-600">{analysis.breakdown.experience.details}</p>
        </div>

        {/* Other Categories */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{getScoreIcon(analysis.breakdown.education.score)}</span>
              <h4 className="font-semibold text-sm text-text">Education</h4>
            </div>
            <p className="text-xs text-gray-600">{analysis.breakdown.education.details}</p>
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{getScoreIcon(analysis.breakdown.location.score)}</span>
              <h4 className="font-semibold text-sm text-text">Location</h4>
            </div>
            <p className="text-xs text-gray-600">{analysis.breakdown.location.details}</p>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {analysis.insights && analysis.insights !== 'Insights temporarily unavailable' && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-semibold text-sm text-blue-900 mb-2 flex items-center gap-2">
            <span>💡</span>
            AI-Powered Insights
          </h4>
          <div className="text-sm text-blue-800 whitespace-pre-line">
            {analysis.insights}
          </div>
        </div>
      )}

      {/* Toggle Details Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-4 w-full py-2 text-sm font-medium text-primary hover:bg-primary-50 rounded-lg transition"
      >
        {expanded ? 'Show Less' : 'Show Detailed Breakdown'}
      </button>
    </div>
  );
}
