import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../api-clerk';
import { ArrowLeft, Check, Eye, Settings, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PdfPreview from '../components/PdfPreview';

type Template = {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  isSystemDefault?: boolean;
  bestFor?: string[];
  fonts?: { name: string; heading: string };
};

type CustomizationOptions = {
  fontFamily: string;
  fontSize: string;
  margins: string;
  lineSpacing: string;
};

type ViewMode = 'gallery' | 'view' | 'customize';

const DEFAULT_CUSTOMIZATION: CustomizationOptions = {
  fontFamily: 'default',
  fontSize: 'medium',
  margins: 'normal',
  lineSpacing: 'normal',
};

export default function Templates() {
  const navigate = useNavigate();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [userDefaultId, setUserDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [customization, setCustomization] = useState<CustomizationOptions>(DEFAULT_CUSTOMIZATION);
  const [customizationOptions, setCustomizationOptions] = useState<any>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadTemplates();
      loadCustomizationOptions();
    }
  }, [isLoaded, isSignedIn]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await api.getTemplates(token || undefined);
      if (res.success) {
        // Only show system defaults - user templates are just saved preferences
        const allTemplates = res.templates.defaults.map((t: any) => ({ ...t, isSystemDefault: true }));
        setTemplates(allTemplates);

        // Get user's default and map back to system template
        const def = await api.getDefaultTemplate(token || undefined);
        if (def.success && def.template) {
          // If user has a saved template, parse it to get the base system template
          if (def.source === 'user' && def.template.latex) {
            try {
              const config = JSON.parse(def.template.latex);
              setUserDefaultId(`default_${config.baseTemplate}`);
            } catch {
              setUserDefaultId(def.template.id);
            }
          } else {
            setUserDefaultId(def.template.id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomizationOptions = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/templates/customization`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCustomizationOptions(data.options);
      }
    } catch (e) {
      console.error('Failed to load customization options:', e);
    }
  };

  const loadPreview = async (templateId: string, customOpts?: CustomizationOptions) => {
    setPreviewLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/templates/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId,
          customization: customOpts || null
        })
      });
      const data = await res.json();
      if (data.success && data.pdf) {
        setPreviewPdf(data.pdf);
      } else {
        console.error('Preview failed:', data.error);
        setPreviewPdf(null);
      }
    } catch (e) {
      console.error('Failed to load preview:', e);
      setPreviewPdf(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openTemplate = async (t: Template) => {
    setSelectedTemplate(t);
    setViewMode('view');
    setCustomization(DEFAULT_CUSTOMIZATION);
    await loadPreview(t.id);
  };

  const openCustomize = async (t: Template) => {
    setSelectedTemplate(t);
    setViewMode('customize');
    setCustomization(DEFAULT_CUSTOMIZATION);
    await loadPreview(t.id);
  };

  const handleCustomizationChange = async (key: string, value: string) => {
    const newCustomization = { ...customization, [key]: value };
    setCustomization(newCustomization);
    if (selectedTemplate) {
      await loadPreview(selectedTemplate.id, newCustomization);
    }
  };

  const handleChoose = async (t?: Template) => {
    const templateToChoose = t || selectedTemplate;
    if (!templateToChoose) return;

    setChoosing(true);
    try {
      const token = await getToken();

      if (templateToChoose.isSystemDefault) {
        // For system templates, save with current customization
        await api.saveTemplate(
          templateToChoose.name,
          JSON.stringify({
            baseTemplate: templateToChoose.id.replace('default_', ''),
            customization
          }),
          true,
          token || undefined
        );
      } else {
        await api.updateTemplate(templateToChoose.id, { isDefault: true }, token || undefined);
      }

      setUserDefaultId(templateToChoose.id);
      await loadTemplates();

      if (viewMode !== 'gallery') {
        setViewMode('gallery');
        setSelectedTemplate(null);
        setPreviewPdf(null);
      }
    } catch (e) {
      console.error('Failed to choose template:', e);
    }
    setChoosing(false);
  };

  const handleSaveCustomized = async () => {
    if (!selectedTemplate) return;

    setChoosing(true);
    try {
      const token = await getToken();
      const baseTemplate = selectedTemplate.id.replace('default_', '');

      // Save as new custom template
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/templates/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceId: selectedTemplate.id,
          name: `${selectedTemplate.name} (Custom)`,
          customization
        })
      });

      await loadTemplates();
      setViewMode('gallery');
      setSelectedTemplate(null);
      setPreviewPdf(null);
    } catch (e) {
      console.error('Failed to save customized template:', e);
    }
    setChoosing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
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
          <p className="text-center text-neutral-500 mb-8">
            Professional DOCX templates • Customizable fonts, sizes, and spacing
          </p>

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

                {/* Template preview placeholder */}
                <div className="aspect-[8.5/11] border-b border-neutral-100 bg-neutral-50 flex items-center justify-center">
                  <div className="text-center p-6">
                    <div className="text-4xl mb-3">📄</div>
                    <p className="text-sm font-medium text-neutral-700">{t.name}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {t.fonts?.name || 'Professional'} font
                    </p>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-neutral-900">{t.name}</h3>
                  <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
                    {t.description || 'Professional resume template'}
                  </p>

                  {t.bestFor && t.bestFor.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.bestFor.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openTemplate(t)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      onClick={() => openCustomize(t)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
                    >
                      <Settings className="w-4 h-4" />
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
      </div>
    );
  }

  // === VIEW MODE (Preview) ===
  if (viewMode === 'view') {
    return (
      <div className="fixed inset-0 bg-[#f5f5f4] z-50">
        <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-6 bg-white/90 backdrop-blur-sm border-b border-neutral-200/50">
          <button
            onClick={() => { setViewMode('gallery'); setSelectedTemplate(null); setPreviewPdf(null); }}
            className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>

          <h2 className="text-sm font-semibold text-neutral-900">{selectedTemplate?.name}</h2>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('customize')}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
            >
              <Settings className="w-4 h-4" />
              Customize
            </button>
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
              {userDefaultId === selectedTemplate?.id ? 'Current' : choosing ? 'Choosing...' : 'Choose'}
            </button>
          </div>
        </div>

        <div className="absolute inset-0 top-14 flex items-center justify-center p-8">
          {previewLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
              <p className="text-sm text-neutral-500">Generating preview...</p>
            </div>
          ) : previewPdf ? (
            <div className="bg-white shadow-2xl rounded-lg overflow-hidden" style={{ maxHeight: '90vh' }}>
              <PdfPreview pdfBase64={previewPdf} />
            </div>
          ) : (
            <div className="text-center">
              <p className="text-neutral-500">Preview not available</p>
              <p className="text-sm text-neutral-400 mt-1">LibreOffice may not be installed</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === CUSTOMIZE MODE ===
  return (
    <div className="fixed inset-0 bg-[#f5f5f4] z-50 flex">
      {/* Left panel - Customization options */}
      <div className="w-80 bg-white border-r border-neutral-200 flex flex-col">
        <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-200">
          <button
            onClick={() => { setViewMode('gallery'); setSelectedTemplate(null); setPreviewPdf(null); }}
            className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <h2 className="text-sm font-semibold text-neutral-900">Customize</h2>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-neutral-500 mb-4">
            Customize {selectedTemplate?.name}
          </p>

          {customizationOptions && Object.entries(customizationOptions).map(([key, opt]: [string, any]) => (
            <div key={key} className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                {opt.label}
              </label>
              <select
                value={(customization as any)[key] || opt.default}
                onChange={(e) => handleCustomizationChange(key, e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {opt.options.map((option: any) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-neutral-200 space-y-2">
          <button
            onClick={handleSaveCustomized}
            disabled={choosing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition"
          >
            {choosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save as Custom Template
          </button>
          <button
            onClick={() => handleChoose()}
            disabled={choosing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition"
          >
            Use Without Saving
          </button>
        </div>
      </div>

      {/* Right panel - Preview */}
      <div className="flex-1 flex items-center justify-center p-8">
        {previewLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            <p className="text-sm text-neutral-500">Updating preview...</p>
          </div>
        ) : previewPdf ? (
          <div className="bg-white shadow-2xl rounded-lg overflow-hidden" style={{ maxHeight: '90vh' }}>
            <PdfPreview pdfBase64={previewPdf} />
          </div>
        ) : (
          <div className="text-center">
            <p className="text-neutral-500">Preview not available</p>
            <p className="text-sm text-neutral-400 mt-1">LibreOffice may not be installed</p>
          </div>
        )}
      </div>
    </div>
  );
}
