import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../api-clerk';
import { ArrowLeft, Check, Eye, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LatexPreview from '../components/LatexPreview';

const A4_WIDTH = 595;
const A4_HEIGHT = 842;

type Template = {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  isSystemDefault?: boolean;
};

type ViewMode = 'gallery' | 'view';

const getTemplateDescription = (templateId: string) => {
  // Remove 'default_' prefix if present
  const id = templateId.replace('default_', '');
  switch (id) {
    case 'jakes_resume':
      return 'Classic format trusted by thousands. Clean tabular header, ATS-optimized.';
    case 'minimal_centered':
      return 'Modern minimal design with centered header and professional summary.';
    case 'classic_professional':
      return 'Traditional professional format. Timeless and widely accepted.';
    case 'modern_dense':
      return 'Compact modern layout. Fits more content on one page.';
    case 'academic_research':
      return 'Academic style with publications section. Ideal for research roles.';
    default:
      return 'Custom template';
  }
};

// Sample content to fill templates for preview
const SAMPLE_CONTENT = {
  name: "Alex Johnson",
  email: "alex.johnson@email.com",
  phone: "(555) 123-4567",
  location: "San Francisco, CA",
  linkedin: "linkedin.com/in/alexjohnson",
  summary: "Senior Software Engineer with 8+ years of experience building scalable web applications. Expertise in React, Node.js, and cloud architecture.",
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Tech Corp",
      location: "San Francisco, CA",
      dates: "Jan 2021 - Present",
      bullets: [
        "Led development of microservices architecture serving 2M+ daily users",
        "Reduced API latency by 40% through optimization and caching strategies",
        "Mentored team of 5 junior developers and established code review practices"
      ]
    },
    {
      title: "Software Engineer",
      company: "StartupXYZ",
      location: "San Francisco, CA",
      dates: "Jun 2018 - Dec 2020",
      bullets: [
        "Built real-time analytics dashboard using React and D3.js",
        "Implemented CI/CD pipeline reducing deployment time by 60%",
        "Designed and deployed RESTful APIs handling 100K+ requests/day"
      ]
    }
  ],
  education: {
    degree: "B.S. Computer Science",
    school: "University of California, Berkeley",
    dates: "2014 - 2018",
    location: "Berkeley, CA"
  },
  skills: {
    "Languages": ["JavaScript", "TypeScript", "Python", "Go"],
    "Frameworks": ["React", "Node.js", "Express", "FastAPI"],
    "Tools": ["Docker", "Kubernetes", "AWS", "PostgreSQL", "Redis"]
  }
};

// Fill a template with sample content for preview
function fillTemplateForPreview(latex: string): string {
  let filled = latex;

  // Fill header
  const headerHtml = `\\begin{center}
    {\\Huge \\scshape ${SAMPLE_CONTENT.name}} \\\\ \\vspace{1pt}
    \\small ${SAMPLE_CONTENT.location} $|$ ${SAMPLE_CONTENT.phone} $|$ ${SAMPLE_CONTENT.email} $|$ ${SAMPLE_CONTENT.linkedin}
\\end{center}`;
  filled = filled.replace(/\{\{HEADER\}\}/g, headerHtml);

  // Fill summary
  filled = filled.replace(/\{\{SUMMARY\}\}/g, SAMPLE_CONTENT.summary);

  // Fill experience
  const expLatex = SAMPLE_CONTENT.experience.map(exp => `
  \\resumeSubheading
    {${exp.title}}{${exp.dates}}
    {${exp.company}}{${exp.location}}
    \\resumeItemListStart
      ${exp.bullets.map(b => `\\resumeItem{${b}}`).join('\n      ')}
    \\resumeItemListEnd`).join('\n');
  filled = filled.replace(/\{\{EXPERIENCE\}\}/g, expLatex);

  // Fill education
  const eduLatex = `\\resumeSubheading
    {${SAMPLE_CONTENT.education.school}}{${SAMPLE_CONTENT.education.dates}}
    {${SAMPLE_CONTENT.education.degree}}{${SAMPLE_CONTENT.education.location}}`;
  filled = filled.replace(/\{\{EDUCATION\}\}/g, eduLatex);

  // Fill skills
  const skillLines = Object.entries(SAMPLE_CONTENT.skills)
    .map(([cat, items]) => `\\textbf{${cat}}{: ${items.join(', ')}}`)
    .join(' \\\\\n    ');
  const skillsLatex = `\\begin{itemize}[leftmargin=0.15in, label={}]
  \\small{\\item{
    ${skillLines}
  }}
\\end{itemize}`;
  filled = filled.replace(/\{\{SKILLS\}\}/g, skillsLatex);

  // Remove optional sections (projects, certifications, publications)
  filled = filled.replace(/\{\{#PROJECTS\}\}[\s\S]*?\{\{\/PROJECTS\}\}/g, '');
  filled = filled.replace(/\{\{#CERTIFICATIONS\}\}[\s\S]*?\{\{\/CERTIFICATIONS\}\}/g, '');
  filled = filled.replace(/\{\{#PUBLICATIONS\}\}[\s\S]*?\{\{\/PUBLICATIONS\}\}/g, '');
  filled = filled.replace(/\{\{#SUMMARY\}\}[\s\S]*?\{\{\/SUMMARY\}\}/g, '');

  // Remove any remaining placeholders
  filled = filled.replace(/\{\{[A-Z_]+\}\}/g, '');

  return filled;
}

export default function Templates() {
  const navigate = useNavigate();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [userDefaultId, setUserDefaultId] = useState<string | null>(null);
  const [latex, setLatex] = useState('');
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [scale, setScale] = useState(0.8);
  const [templateLatexCache, setTemplateLatexCache] = useState<Record<string, string>>({});
  const [showComingSoon, setShowComingSoon] = useState(false);

  const calculateScale = useCallback(() => {
    const availableHeight = window.innerHeight - 160;
    const availableWidth = window.innerWidth - 100;
    const scaleH = availableHeight / A4_HEIGHT;
    const scaleW = availableWidth / A4_WIDTH;
    setScale(Math.min(scaleH, scaleW, 0.9));
  }, []);

  useEffect(() => {
    calculateScale();
    const handler = () => calculateScale();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [calculateScale]);

  useEffect(() => {
    if (isLoaded && isSignedIn) loadTemplates();
  }, [isLoaded, isSignedIn]);

  // Auto-hide coming soon toast
  useEffect(() => {
    if (showComingSoon) {
      const timer = setTimeout(() => setShowComingSoon(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showComingSoon]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.getTemplates(token || undefined);
      if (res.success) {
        const allTemplates = [
          ...res.templates.defaults.map((t: any) => ({ ...t, isSystemDefault: true })),
          ...res.templates.user
        ];
        setTemplates(allTemplates);

        const def = await api.getDefaultTemplate(token || undefined);
        if (def.success && def.template) {
          setUserDefaultId(def.template.id);
        }

        // Pre-load latex for all templates and fill with sample content for preview
        const latexCache: Record<string, string> = {};
        await Promise.all(
          allTemplates.map(async (t) => {
            try {
              const tRes = await api.getTemplate(t.id, token || undefined);
              if (tRes.success && tRes.template?.latex) {
                // Fill with sample content for preview
                latexCache[t.id] = fillTemplateForPreview(tRes.template.latex);
              }
            } catch (e) {
              console.warn(`Failed to load latex for template ${t.id}`);
            }
          })
        );
        setTemplateLatexCache(latexCache);
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  };

  const openTemplate = async (t: Template) => {
    const token = await getToken();
    const res = await api.getTemplate(t.id, token || undefined);
    if (res.success) {
      setSelectedTemplate(t);
      // Fill with sample content for preview
      setLatex(fillTemplateForPreview(res.template.latex));
      setViewMode('view');
    }
  };

  const handleChoose = async (t?: Template) => {
    const templateToChoose = t || selectedTemplate;
    if (!templateToChoose) return;

    setChoosing(true);
    try {
      const token = await getToken();

      // Get the ORIGINAL template latex (not the preview-filled version)
      const res = await api.getTemplate(templateToChoose.id, token || undefined);
      if (!res.success) {
        throw new Error('Failed to get template');
      }
      const templateLatex = res.template.latex;

      if (templateToChoose.isSystemDefault) {
        await api.saveTemplate(templateToChoose.name, templateLatex, true, token || undefined);
      } else {
        await api.updateTemplate(templateToChoose.id, { isDefault: true }, token || undefined);
      }
      setUserDefaultId(templateToChoose.id);
      await loadTemplates();

      if (viewMode !== 'gallery') {
        setViewMode('gallery');
        setSelectedTemplate(null);
      }
    } catch (e) {
      console.error('Failed to choose template:', e);
    }
    setChoosing(false);
  };

  // Mini preview for gallery cards - use HTML preview directly (faster, works without LaTeX compiler)
  const renderMiniPreview = (templateId: string) => {
    const templateLatex = templateLatexCache[templateId];

    if (!templateLatex) {
      return (
        <div className="w-full h-full bg-white flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-neutral-200 border-t-neutral-400 rounded-full animate-spin" />
        </div>
      );
    }

    // Use HTML preview for gallery (faster, no server compilation needed)
    return (
      <div className="w-full h-full bg-white overflow-hidden" style={{ transform: 'scale(0.35)', transformOrigin: 'top left', width: '286%', height: '286%' }}>
        <LatexPreview latex={templateLatex} className="w-full h-full" />
      </div>
    );
  };

  // Full preview - render using LatexPreview (HTML)
  const renderFullPreview = () => {
    const latexToRender = latex || (selectedTemplate ? templateLatexCache[selectedTemplate.id] : '');

    if (!latexToRender) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-white">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
        </div>
      );
    }

    return <LatexPreview latex={latexToRender} className="w-full h-full" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  // === GALLERY VIEW ===
  if (viewMode === 'gallery') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-neutral-200/50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <button onClick={() => navigate('/generate')} className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <h1 className="text-lg font-semibold text-neutral-900">Choose a Template</h1>
            <div className="w-9" />
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`group relative bg-white rounded-2xl border-2 transition-all duration-200 hover:shadow-lg overflow-hidden ${
                  userDefaultId === t.id ? 'border-neutral-900 shadow-md' : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {userDefaultId === t.id && (
                  <div className="absolute top-3 right-3 z-10 px-2.5 py-1 bg-neutral-900 text-white text-xs font-medium rounded-full">
                    Current
                  </div>
                )}

                <div className="aspect-[8.5/11] border-b border-neutral-100 overflow-hidden">
                  {renderMiniPreview(t.id)}
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-neutral-900">{t.name}</h3>
                  <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{getTemplateDescription(t.id)}</p>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openTemplate(t)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      onClick={() => setShowComingSoon(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-neutral-400 bg-neutral-100 rounded-xl cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                      Customize
                    </button>
                  </div>

                  {userDefaultId !== t.id && (
                    <button
                      onClick={() => handleChoose(t)}
                      disabled={choosing}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-neutral-700 border border-neutral-200 hover:bg-neutral-50 rounded-xl transition"
                    >
                      <Check className="w-4 h-4" />
                      {choosing ? 'Choosing...' : 'Choose This'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Coming Soon Toast */}
        {showComingSoon && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-neutral-900 text-white text-sm font-medium rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-4">
            ✨ Template customization coming soon!
          </div>
        )}
      </div>
    );
  }

  // === VIEW MODE ===
  return (
    <div className="fixed inset-0 bg-[#f5f5f4] z-50">
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-6 bg-white/90 backdrop-blur-sm border-b border-neutral-200/50">
        <button
          onClick={() => { setViewMode('gallery'); setSelectedTemplate(null); }}
          className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>

        <h2 className="text-sm font-semibold text-neutral-900">{selectedTemplate?.name}</h2>

        <button
          onClick={() => handleChoose()}
          disabled={choosing || userDefaultId === selectedTemplate?.id}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition ${
            userDefaultId === selectedTemplate?.id
              ? 'bg-neutral-100 text-neutral-400 cursor-default'
              : 'bg-neutral-900 text-white hover:bg-neutral-800'
          }`}
        >
          <Check className="w-4 h-4" />
          {userDefaultId === selectedTemplate?.id ? 'Current Template' : choosing ? 'Choosing...' : 'Choose This'}
        </button>
      </div>

      <div className="absolute inset-0 top-14 flex items-center justify-center p-8">
        <div
          className="bg-white shadow-[0_4px_60px_rgba(0,0,0,0.12)]"
          style={{
            width: `${A4_WIDTH}px`,
            height: `${A4_HEIGHT}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {renderFullPreview()}
        </div>
      </div>
    </div>
  );
}
