import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface CTASectionProps {
  onGetStarted?: () => void;
  onLearnMore?: () => void;
}

export function CTASection({ onGetStarted, onLearnMore }: CTASectionProps) {
  return (
    <section className="px-6 py-16 md:py-20">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative rounded-2xl p-10 md:p-12 overflow-hidden"
          style={{ backgroundColor: '#1c3f40' }}
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-[#3eaca7] opacity-10 rounded-full blur-3xl" />

          <div className="relative z-10 text-center max-w-2xl mx-auto">
            <h2
              className="text-[2rem] md:text-[2.5rem] mb-4 leading-[1.15]"
              style={{
                fontWeight: 600,
                color: '#ffffff'
              }}
            >
              Ready to Accelerate Your Job Search?
            </h2>

            <p
              className="text-[0.9375rem] md:text-[1rem] mb-8 leading-[1.65]"
              style={{
                color: 'rgba(255, 255, 255, 0.8)'
              }}
            >
              Join thousands of job seekers who have landed their dream jobs with the power of AI.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="group px-6 h-11 text-[0.9375rem]"
                style={{
                  backgroundColor: '#3eaca7',
                  color: '#ffffff'
                }}
                onClick={onGetStarted}
              >
                Get Started Now
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="px-6 h-11 text-[0.9375rem]"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  backgroundColor: 'transparent'
                }}
                onClick={onLearnMore}
              >
                Learn More
              </Button>
            </div>

            <p className="mt-6 text-[0.8125rem]" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              No credit card required - Free forever - Cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
