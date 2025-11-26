import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FeatureItemProps {
  icon: ReactNode;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <div className="flex gap-3">
      <div
        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
      >
        {icon}
      </div>
      <div>
        <h4 className="mb-1 text-[0.9375rem]" style={{ color: '#0c1310', fontWeight: 500 }}>
          {title}
        </h4>
        <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

interface FeatureSectionProps {
  badge?: string;
  title: string;
  description: string;
  features: Array<{
    icon: ReactNode;
    title: string;
    description: string;
  }>;
  visualContent: ReactNode;
  reverse?: boolean;
}

export function FeatureSection({
  badge,
  title,
  description,
  features,
  visualContent,
  reverse = false
}: FeatureSectionProps) {
  return (
    <section className="px-6 py-16 md:py-20">
      <div className="max-w-6xl mx-auto">
        <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${reverse ? 'lg:flex-row-reverse' : ''}`}>
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className={reverse ? 'lg:order-2' : ''}
          >
            {badge && (
              <div
                className="inline-block px-3 py-1 rounded-full mb-4 text-[0.8125rem]"
                style={{
                  backgroundColor: '#409677',
                  color: '#ffffff'
                }}
              >
                {badge}
              </div>
            )}

            <h2
              className="text-[1.875rem] md:text-[2.25rem] mb-4 leading-[1.15]"
              style={{
                fontWeight: 600,
                color: '#0c1310'
              }}
            >
              {title}
            </h2>

            <p
              className="text-[0.9375rem] md:text-[1rem] mb-7 leading-[1.65]"
              style={{
                color: '#5a6564'
              }}
            >
              {description}
            </p>

            <div className="space-y-5">
              {features.map((feature, index) => (
                <FeatureItem key={index} {...feature} />
              ))}
            </div>
          </motion.div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: reverse ? -20 : 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className={reverse ? 'lg:order-1' : ''}
          >
            {visualContent}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
