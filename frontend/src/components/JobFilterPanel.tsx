import { useState } from 'react';
import { X, ChevronDown, ChevronUp, Filter, Save, RotateCcw, Briefcase, Zap, DollarSign, Home, Calendar, Bot } from 'lucide-react';

export interface JobFilters {
  // Experience & Level
  experienceLevel?: string[];
  minYearsExperience?: number;
  maxYearsExperience?: number;

  // Compensation
  minSalary?: number;
  maxSalary?: number;

  // Location & Work Type
  locations?: string[];
  workType?: string[];

  // Job Type & Status
  jobType?: string[];
  postedWithin?: string;

  // Skills (Boolean Search)
  requiredSkills?: string[];
  preferredSkills?: string[];
  excludeSkills?: string[];

  // Company
  companySize?: string[];
  industries?: string[];

  // ATS & Application
  atsType?: string;
  aiApplyable?: boolean;
  applicationComplexity?: string[];
}

interface JobFilterPanelProps {
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
  onClose: () => void;
  isOpen: boolean;
}

interface FilterSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function FilterSection({ title, icon, children, defaultExpanded = false }: FilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm text-gray-900">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

interface SkillInputProps {
  label: string;
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  placeholder: string;
  helpText?: string;
}

function SkillInput({ label, skills, onSkillsChange, placeholder, helpText }: SkillInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addSkill = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onSkillsChange([...skills, trimmed]);
      setInputValue('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    onSkillsChange(skills.filter(s => s !== skillToRemove));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSkill();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          type="button"
          onClick={addSkill}
          className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition"
        >
          Add
        </button>
      </div>
      {helpText && (
        <p className="text-xs text-gray-500 mb-2">{helpText}</p>
      )}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="hover:bg-primary/20 rounded-full p-0.5 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobFilterPanel({ filters, onFiltersChange, onClose, isOpen }: JobFilterPanelProps) {
  if (!isOpen) return null;

  const updateFilter = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayValue = <K extends keyof JobFilters>(
    key: K,
    value: string,
    currentArray: string[] = []
  ) => {
    if (currentArray.includes(value)) {
      updateFilter(key, currentArray.filter((v) => v !== value) as JobFilters[K]);
    } else {
      updateFilter(key, [...currentArray, value] as JobFilters[K]);
    }
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.keys(filters).filter((key) => {
    const value = filters[key as keyof JobFilters];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null;
  }).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">
                Job Filters
              </h2>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 bg-primary text-white text-xs font-medium rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex-1 overflow-y-auto">
            {/* Experience Level */}
            <FilterSection title="Experience Level" icon={<Briefcase className="w-4 h-4 text-gray-600" />} defaultExpanded>
              <div className="space-y-2">
                {['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Principal'].map((level) => {
                  const isSelected = filters.experienceLevel?.includes(level.toLowerCase()) || false;
                  return (
                    <label key={level} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          toggleArrayValue('experienceLevel', level.toLowerCase(), filters.experienceLevel)
                        }
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{level}</span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>

            {/* Skills (Boolean) */}
            <FilterSection title="Skills (Boolean Search)" icon={<Zap className="w-4 h-4 text-gray-600" />} defaultExpanded>
              <div className="space-y-4">
                <SkillInput
                  label="Must Have (Required)"
                  skills={filters.requiredSkills || []}
                  onSkillsChange={(skills) => updateFilter('requiredSkills', skills)}
                  placeholder="e.g., React"
                  helpText="Jobs MUST have ALL these skills"
                />
                <SkillInput
                  label="Nice to Have (Preferred)"
                  skills={filters.preferredSkills || []}
                  onSkillsChange={(skills) => updateFilter('preferredSkills', skills)}
                  placeholder="e.g., GraphQL"
                  helpText="Boosts job score if present"
                />
                <SkillInput
                  label="Exclude (Must Not Have)"
                  skills={filters.excludeSkills || []}
                  onSkillsChange={(skills) => updateFilter('excludeSkills', skills)}
                  placeholder="e.g., PHP"
                  helpText="Jobs with these skills are excluded"
                />
              </div>
            </FilterSection>

            {/* Salary Range */}
            <FilterSection title="Salary Range" icon={<DollarSign className="w-4 h-4 text-gray-600" />}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Minimum ($)
                  </label>
                  <input
                    type="number"
                    value={filters.minSalary || ''}
                    onChange={(e) => updateFilter('minSalary', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 80000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Maximum ($)
                  </label>
                  <input
                    type="number"
                    value={filters.maxSalary || ''}
                    onChange={(e) => updateFilter('maxSalary', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 150000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </FilterSection>

            {/* Work Type */}
            <FilterSection title="Work Type" icon={<Home className="w-4 h-4 text-gray-600" />}>
              <div className="space-y-2">
                {['Remote', 'Hybrid', 'Onsite'].map((type) => {
                  const isSelected = filters.workType?.includes(type.toLowerCase()) || false;
                  return (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleArrayValue('workType', type.toLowerCase(), filters.workType)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{type}</span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>

            {/* Posted Within */}
            <FilterSection title="Posted Within" icon={<Calendar className="w-4 h-4 text-gray-600" />}>
              <div className="space-y-2">
                {[
                  { label: 'Last 24 hours', value: '24h' },
                  { label: 'Last 7 days', value: '7d' },
                  { label: 'Last 14 days', value: '14d' },
                  { label: 'Last 30 days', value: '30d' }
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="postedWithin"
                      checked={filters.postedWithin === option.value}
                      onChange={() => updateFilter('postedWithin', option.value)}
                      className="w-4 h-4 border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            {/* AI Applyable */}
            <FilterSection title="Application Type" icon={<Bot className="w-4 h-4 text-gray-600" />}>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.aiApplyable === true}
                    onChange={(e) => updateFilter('aiApplyable', e.target.checked ? true : undefined)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">AI Auto-Apply Available</span>
                </label>
              </div>
            </FilterSection>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              type="button"
              onClick={clearAllFilters}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All Filters
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
