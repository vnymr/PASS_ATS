import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Chrome, Download, Zap, FileText, MousePointer, ArrowRight } from 'lucide-react';

export default function Extension() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">
              Happy<span className="text-teal-600">Resumes</span>
            </span>
          </Link>
          <Link
            to="/auth"
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-full text-sm font-medium mb-6">
              <Chrome className="w-4 h-4" />
              Chrome Extension
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Extract Job Descriptions<br />
              <span className="text-teal-600">Instantly</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              One click to extract job descriptions from any job posting and generate a perfectly tailored resume.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-lg font-medium hover:bg-gray-800 transition-colors"
              >
                <Download className="w-5 h-5" />
                Add to Chrome
              </a>
              <Link
                to="/generate"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl text-lg font-medium hover:border-teal-500 hover:text-teal-600 transition-colors"
              >
                Try Without Extension
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: MousePointer,
                title: 'Browse Jobs',
                description: 'Visit any job posting on LinkedIn, Indeed, Glassdoor, or other supported sites.'
              },
              {
                step: '2',
                icon: Zap,
                title: 'Click Extract',
                description: 'Click the HappyResumes extension icon to automatically extract the job description.'
              },
              {
                step: '3',
                icon: FileText,
                title: 'Generate Resume',
                description: 'Get a perfectly tailored resume that highlights relevant skills and experience.'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-teal-600" />
                </div>
                <div className="text-sm text-teal-600 font-medium mb-2">Step {item.step}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Sites */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Works with all major job sites
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {['LinkedIn', 'Indeed', 'Glassdoor', 'Lever', 'Greenhouse', 'Workday', 'Google Careers', 'Apple Jobs'].map((site) => (
              <div
                key={site}
                className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 font-medium"
              >
                {site}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-teal-600 to-teal-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to land your dream job?
          </h2>
          <p className="text-teal-100 text-lg mb-8">
            Install the extension and start generating tailored resumes in seconds.
          </p>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-teal-700 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            <Chrome className="w-5 h-5" />
            Install Extension
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold">Happy<span className="text-teal-600">Resumes</span></span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600 text-sm">AI-Powered Resume Generator</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <Link to="/privacy" className="hover:text-teal-600">Privacy</Link>
            <Link to="/support" className="hover:text-teal-600">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
