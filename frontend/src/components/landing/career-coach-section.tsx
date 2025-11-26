import { motion } from "framer-motion";
import { Target, TrendingUp, Sparkles, Calendar, BarChart3 } from "lucide-react";
import { Button } from "../ui/button";

export function CareerCoachSection() {
  return (
    <section className="px-6 py-20 md:py-24 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#3eaca7]/5 to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[0.8125rem]"
            style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Career Coach</span>
          </div>

          <h2
            className="text-[2rem] md:text-[2.75rem] mb-4 leading-[1.15]"
            style={{
              fontWeight: 600,
              color: '#0c1310'
            }}
          >
            Plan Your Next Move with Your AI Career Coach
          </h2>

          <p
            className="text-[0.9375rem] md:text-[1rem] leading-[1.65]"
            style={{ color: '#5a6564' }}
          >
            More than just a resume builder, our platform is your strategic partner. Chat with our AI to set career goals, track your progress, and get intelligent recommendations.
          </p>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Large feature card - spans 2 columns on lg */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="lg:col-span-2 rounded-xl p-6 border group hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: '#ffffff',
              borderColor: 'rgba(28, 63, 64, 0.08)'
            }}
          >
            <div className="flex items-start gap-4 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
              >
                <Target className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-[1.125rem] mb-2" style={{ color: '#0c1310', fontWeight: 600 }}>
                  Set Clear Goals
                </h3>
                <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>
                  Tell the AI your objective, from "Get a promotion" to "Switch to a new industry," and it will help you track it.
                </p>
              </div>
            </div>

            {/* Chat interface mockup */}
            <div className="space-y-2.5 mt-6">
              <div className="flex gap-2">
                <div
                  className="rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%] text-[0.8125rem]"
                  style={{ backgroundColor: '#f5f7f7', color: '#0c1310' }}
                >
                  I want to transition into a Senior Product Manager role within 6 months
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div
                  className="rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-[0.8125rem]"
                  style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
                >
                  Great goal! I'll help you create a strategic plan. Let's start by analyzing your current experience...
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div
                  className="rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-[0.8125rem]"
                  style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
                >
                  Goal Created: Senior PM in 6 months
                </div>
              </div>
            </div>
          </motion.div>

          {/* Progress card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="rounded-xl p-6 border group hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: '#ffffff',
              borderColor: 'rgba(28, 63, 64, 0.08)'
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{ backgroundColor: '#409677', color: '#ffffff' }}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-[1.125rem] mb-2" style={{ color: '#0c1310', fontWeight: 600 }}>
              Stay on Track
            </h3>
            <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              Your AI assistant creates daily routines and shows your progress.
            </p>

            {/* Progress bars */}
            <div className="space-y-3 mt-4">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span style={{ fontSize: '0.75rem', color: '#5a6564' }}>Applications</span>
                  <span style={{ fontSize: '0.75rem', color: '#3eaca7', fontWeight: 600 }}>47/50</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: '#e5e9e9' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ backgroundColor: '#3eaca7', width: '94%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span style={{ fontSize: '0.75rem', color: '#5a6564' }}>Interviews</span>
                  <span style={{ fontSize: '0.75rem', color: '#409677', fontWeight: 600 }}>3/10</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: '#e5e9e9' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ backgroundColor: '#409677', width: '30%' }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recommendations card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="rounded-xl p-6 border group hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: '#ffffff',
              borderColor: 'rgba(28, 63, 64, 0.08)'
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{ backgroundColor: '#1c3f40', color: '#ffffff' }}
            >
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-[1.125rem] mb-2" style={{ color: '#0c1310', fontWeight: 600 }}>
              Smart Insights
            </h3>
            <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Get data-driven recommendations on what to do next.
            </p>

            {/* Recommendation items */}
            <div className="space-y-2 mt-4">
              {[
                { label: 'Update resume', priority: 'high' },
                { label: 'Apply to 5 jobs', priority: 'high' },
                { label: 'LinkedIn optimization', priority: 'medium' }
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ backgroundColor: '#f5f7f7' }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: item.priority === 'high' ? '#3eaca7' : '#409677'
                    }}
                  />
                  <span style={{ fontSize: '0.8125rem', color: '#0c1310' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Daily routine card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="lg:col-span-2 rounded-xl p-6 border group hover:shadow-md transition-all duration-300"
            style={{
              backgroundColor: '#ffffff',
              borderColor: 'rgba(28, 63, 64, 0.08)'
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#409677', color: '#ffffff' }}
                >
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[1.125rem] mb-2" style={{ color: '#0c1310', fontWeight: 600 }}>
                    Your Daily Career Routine
                  </h3>
                  <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    AI-generated daily tasks to keep you moving toward your goal
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="h-8 px-3 text-[0.8125rem]"
                style={{ color: '#3eaca7' }}
              >
                View All
              </Button>
            </div>

            {/* Timeline */}
            <div className="space-y-3 mt-4">
              {[
                { time: '9:00 AM', task: 'Review and respond to messages', done: true },
                { time: '10:00 AM', task: 'Apply to 3 recommended positions', done: true },
                { time: '2:00 PM', task: 'Update skills section', done: false },
                { time: '4:00 PM', task: 'Network on LinkedIn', done: false }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: item.done ? '#3eaca7' : 'rgba(28, 63, 64, 0.2)',
                      backgroundColor: item.done ? '#3eaca7' : 'transparent'
                    }}
                  >
                    {item.done && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ffffff' }} />
                    )}
                  </div>
                  <span
                    className="text-[0.75rem] w-16 flex-shrink-0"
                    style={{ color: '#5a6564' }}
                  >
                    {item.time}
                  </span>
                  <span
                    className="text-[0.8125rem]"
                    style={{
                      color: item.done ? '#5a6564' : '#0c1310',
                      textDecoration: item.done ? 'line-through' : 'none'
                    }}
                  >
                    {item.task}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
