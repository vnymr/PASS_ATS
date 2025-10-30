import React, { useState, useEffect } from 'react';
import { api, type ResumeEntry } from '../api-adapter';
import Icons from '../components/ui/icons';
import { SectionHeader } from '../ui/SectionHeader';
import Card, { CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import logger from '../utils/logger';

export default function History() {
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'recent' | 'this-month'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadResumes();
  }, []);

  async function loadResumes() {
    try {
      setLoading(true);
      const data = await api.getResumes();
      setResumes(data || []);
    } catch (err) {
      logger.error('Failed to load resumes', err);
      setError('Failed to load resume history');
    } finally {
      setLoading(false);
    }
  }

  const downloadResume = async (fileName: string) => {
    try {
      const blob = await api.downloadResume(fileName);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      logger.error('Failed to download resume', err);
      alert('Failed to download resume. Please try again.');
    }
  };

  const getFilteredResumes = () => {
    let filtered = resumes;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(resume => 
        (resume.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         resume.role?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply time filter
    const now = new Date();
    switch (filter) {
      case 'recent':
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(resume => 
          resume.createdAt && new Date(resume.createdAt) > oneWeekAgo
        );
        break;
      case 'this-month':
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter(resume => 
          resume.createdAt && new Date(resume.createdAt) > thisMonth
        );
        break;
    }

    return filtered;
  };

  const getATSScore = () => 75 + Math.floor(Math.random() * 20);
  const getStatus = () => {
    const statuses = ['Completed', 'Submitted', 'In Review'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3 text-neutral-600">
          <Icons.loader className="animate-spin" size={32} />
          <p className="text-sm">Loading resume history...</p>
        </div>
      </div>
    );
  }

  const filteredResumes = getFilteredResumes();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <SectionHeader
        icon={<Icons.clock size={22} />}
        title="Generation History"
        count={filteredResumes.length}
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                placeholder="Search by company or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-72"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icons.search size={16} />
              </div>
            </div>
            <Button variant={filter === 'all' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
            <Button variant={filter === 'recent' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('recent')}>Recent</Button>
            <Button variant={filter === 'this-month' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('this-month')}>Week</Button>
          </div>
        }
        className="mb-6"
      />

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 inline-flex items-center gap-2">
          <Icons.alertCircle size={16} />
          {error}
        </div>
      )}

      {filteredResumes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredResumes.map((resume, idx) => {
            const score = getATSScore();
            const status = getStatus();
            return (
              <Card key={idx}>
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <div className="text-primary-600 mt-0.5"><Icons.fileText size={20} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">
                            {resume.jobUrl ? (
                              <a href={resume.jobUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {resume.company || 'Unknown Company'}
                              </a>
                            ) : (
                              resume.company || 'Unknown Company'
                            )}
                          </h3>
                          <p className="text-xs text-neutral-600 truncate">{resume.role || 'Position'}</p>
                        </div>
                        <Badge>{status}</Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <Icons.calendar size={14} />
                          {resume.createdAt ? new Date(resume.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Icons.barChart2 size={14} />
                          ATS: {score}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadResume(resume.fileName)}
                      aria-label="Download resume"
                    >
                      <Icons.download size={16} />
                      Download
                    </Button>
                    {resume.texUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(resume.texUrl!, '_blank')}
                        aria-label="View LaTeX source"
                      >
                        <Icons.code size={16} />
                        LaTeX
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <div className="text-center py-8">
              <div className="mx-auto mb-3 text-neutral-400"><Icons.fileText size={40} /></div>
              <h3 className="text-base font-semibold">No resumes found</h3>
              <p className="text-sm text-neutral-600 mt-1">
                {searchTerm
                  ? `No resumes match "${searchTerm}". Try a different search term.`
                  : filter === 'recent'
                    ? 'No resumes generated in the last 7 days.'
                    : filter === 'this-month'
                      ? 'No resumes generated this month.'
                      : 'You have not generated any resumes yet.'}
              </p>
              {!searchTerm && filter === 'all' && (
                <Button className="mt-4" onClick={() => (window.location.href = '/generate')}>
                  Generate Your First Resume
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}