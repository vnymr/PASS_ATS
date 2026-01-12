import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../api-clerk';
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Template = {
  id: string;
  name: string;
  description?: string;
  bestFor?: string[];
  fonts?: { name: string; heading: string };
};

// System templates with preview info
const TEMPLATE_PREVIEWS: Record<string, { color: string; style: string }> = {
  'default_jakes_resume': { color: '#2563eb', style: 'Classic & Clean' },
  'default_harvard_classic': { color: '#dc2626', style: 'Traditional Academic' },
  'default_modern_executive': { color: '#059669', style: 'Modern Professional' },
  'default_minimal_tech': { color: '#7c3aed', style: 'Minimal & Technical' },
  'default_academic_cv': { color: '#ea580c', style: 'Academic Format' },
};

export default function Templates() {
  const navigate = useNavigate();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadData();
    }
  }, [isLoaded, isSignedIn]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // Load templates
      const res = await api.getTemplates(token || undefined);
      if (res.success) {
        // Only show system templates to avoid duplicates
        setTemplates(res.templates.defaults);
      }

      // Load user's current default
      const defRes = await api.getDefaultTemplate(token || undefined);
      if (defRes.success && defRes.template) {
        // Map user template back to system template id
        if (defRes.source === 'user' && defRes.template.latex) {
          try {
            const config = JSON.parse(defRes.template.latex);
            setSelectedId(`default_${config.baseTemplate}`);
          } catch {
            setSelectedId(defRes.template.id);
          }
        } else {
          setSelectedId(defRes.template.id);
        }
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (templateId: string) => {
    if (saving || selectedId === templateId) return;

    setSaving(true);
    try {
      const token = await getToken();
      const baseTemplate = templateId.replace('default_', '');
      const template = templates.find(t => t.id === templateId);

      // Save as user's default template
      await api.saveTemplate(
        template?.name || 'My Template',
        JSON.stringify({ baseTemplate, customization: null }),
        true,
        token || undefined
      );

      setSelectedId(templateId);
    } catch (e) {
      console.error('Failed to select template:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-neutral-200/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/generate')}
            className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Resume Templates</h1>
            <p className="text-sm text-neutral-500">Choose a style for your resumes</p>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const isSelected = selectedId === template.id;
            const preview = TEMPLATE_PREVIEWS[template.id] || { color: '#6b7280', style: 'Professional' };

            return (
              <button
                key={template.id}
                onClick={() => handleSelect(template.id)}
                disabled={saving}
                className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                  isSelected
                    ? 'border-neutral-900 bg-neutral-50 shadow-md'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm'
                }`}
              >
                {/* Selected badge */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-neutral-900 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Template preview bar */}
                <div
                  className="h-2 w-full rounded-full mb-4"
                  style={{ backgroundColor: preview.color }}
                />

                {/* Template info */}
                <h3 className="font-semibold text-neutral-900 mb-1">{template.name}</h3>
                <p className="text-sm text-neutral-500 mb-3">{preview.style}</p>

                {/* Best for tags */}
                {template.bestFor && template.bestFor.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.bestFor.slice(0, 2).map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Loading indicator */}
                {saving && !isSelected && (
                  <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* AI Suggestion Section */}
        <div className="mt-8 p-6 bg-gradient-to-br from-neutral-50 to-neutral-100/50 rounded-2xl border border-neutral-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">AI Template Recommendation</h3>
              <p className="text-sm text-neutral-600 mb-3">
                Based on your profile, we recommend <strong>Jake's Resume</strong> for tech roles
                or <strong>Harvard Classic</strong> for traditional industries.
              </p>
              <p className="text-xs text-neutral-500">
                Your AI-generated resumes will automatically use your selected template.
              </p>
            </div>
          </div>
        </div>

        {/* Info text */}
        <p className="text-center text-sm text-neutral-400 mt-8">
          Templates are applied when generating new resumes
        </p>
      </div>
    </div>
  );
}
