import SiteHeader from "@/components/landingpage/SiteHeader";
import SiteFooter from "@/components/landingpage/SiteFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Cloud Hosted Plans",
  description: "Deep Wide Research pricing plans. Choose from Free, Plus, Pro, or Enterprise tiers. Or self-host the open-source version for free.",
  alternates: {
    canonical: "https://deepwideresearch.com/pricing",
  },
  openGraph: {
    title: "Pricing - Deep Wide Research Cloud Plans",
    description: "Flexible pricing for enterprise-grade AI research. From free community tier to unlimited enterprise plans. Or self-host for free.",
    url: "https://deepwideresearch.com/pricing",
    type: "website",
    images: [
      {
        url: "/DWResearch.png",
        width: 1200,
        height: 630,
        alt: "Deep Wide Research Pricing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - Deep Wide Research Cloud Plans",
    description: "Flexible pricing for enterprise-grade AI research. From free community tier to unlimited enterprise plans. Or self-host for free.",
    creator: "@realGuantum",
    images: ["/DWResearch.png"],
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen w-full font-mono bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <header className="border-2 border-white/20 bg-black/20 p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/90">
          Pricing <span className="text-lg text-foreground/50">(cloud version)</span>
        </h1>
        <p className="mt-3 text-sm text-foreground/60">Deep Wide Research is an open-source product from <a href="https://www.puppyagent.com" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-foreground underline">PuppyAgent</a>.</p>
      </header>

      {/* Pricing Tiers */}
      <section className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Free Tier */}
          <div className="border-2 border-white/20 bg-black/20 p-6 md:p-8 flex flex-col">
            <h2 className="text-xl font-bold text-foreground/90 mb-2">Free</h2>
            <div className="mt-2 mb-6">
              <span className="text-3xl font-bold text-foreground/90">$0</span>
              <span className="text-sm text-foreground/50 ml-1">/ month</span>
            </div>
            
            <div className="space-y-3 text-sm text-foreground/70 mb-6 flex-grow">
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span><strong className="text-foreground/90">100 credits</strong> per month</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-foreground/40 flex-shrink-0">[✗]</code>
                <span className="text-foreground/40">API & SDK access</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Community support</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-foreground/40 flex-shrink-0">[✗]</code>
                <span className="text-foreground/40">Advanced features</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-foreground/40 flex-shrink-0">[✗]</code>
                <span className="text-foreground/40">Custom integrations</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-foreground/40 flex-shrink-0">[✗]</code>
                <span className="text-foreground/40">SLA & compliance</span>
              </div>
            </div>
            
            <button className="w-full border-2 border-white/20 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm font-semibold text-foreground/90 transition-all">
              Get Started
            </button>
          </div>

          {/* Plus Tier - Highlighted */}
          <div className="border-2 border-[#2CAC58] bg-gradient-to-br from-[#2CAC58]/10 to-black/20 p-6 md:p-8 flex flex-col relative">
            <div className="absolute top-0 right-0 bg-[#2CAC58] px-3 py-1 text-xs font-bold text-white">
              POPULAR
            </div>
            
            <h2 className="text-xl font-bold text-foreground/90 mb-2">Plus</h2>
            <div className="mt-2 mb-6">
              <span className="text-3xl font-bold text-foreground/90">$15</span>
              <span className="text-sm text-foreground/50 ml-1">/ month</span>
            </div>
            
            <div className="space-y-3 text-sm text-foreground/70 mb-6 flex-grow">
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span><strong className="text-foreground/90">2,000 credits</strong> per month</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>API & SDK access</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Priority support</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Advanced features</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-foreground/40 flex-shrink-0">[✗]</code>
                <span className="text-foreground/40">Custom integrations</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-foreground/40 flex-shrink-0">[✗]</code>
                <span className="text-foreground/40">SLA & compliance</span>
              </div>
            </div>
            
            <button className="w-full bg-[#2CAC58] hover:bg-[#25994D] px-4 py-3 text-sm font-semibold text-white transition-all shadow-lg shadow-[#2CAC58]/20 hover:shadow-xl hover:shadow-[#2CAC58]/30">
              Upgrade to Plus
            </button>
          </div>

          {/* Pro Tier */}
          <div className="border-2 border-white/20 bg-black/20 p-6 md:p-8 flex flex-col">
            <h2 className="text-xl font-bold text-foreground/90 mb-2">Pro</h2>
            <div className="mt-2 mb-6">
              <span className="text-3xl font-bold text-foreground/90">$100</span>
              <span className="text-sm text-foreground/50 ml-1">/ month</span>
            </div>
            
            <div className="space-y-3 text-sm text-foreground/70 mb-6 flex-grow">
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span><strong className="text-foreground/90">15,000 credits</strong> per month</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>API & SDK access</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Dedicated support</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Advanced features</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Custom integrations</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-foreground/40 flex-shrink-0">[✗]</code>
                <span className="text-foreground/40">SLA & compliance</span>
              </div>
            </div>
            
            <button className="w-full border-2 border-white/20 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm font-semibold text-foreground/90 transition-all">
              Upgrade to Pro
            </button>
          </div>

          {/* Enterprise Tier */}
          <div className="border-2 border-white/20 bg-black/20 p-6 md:p-8 flex flex-col">
            <h2 className="text-xl font-bold text-foreground/90 mb-2">Enterprise</h2>
            <div className="mt-2 mb-6">
              <span className="text-2xl font-bold text-foreground/90">Custom</span>
            </div>
            
            <div className="space-y-3 text-sm text-foreground/70 mb-6 flex-grow">
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span><strong className="text-foreground/90">Unlimited credits</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>API & SDK access</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Enterprise support (24/7)</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Advanced features</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>Custom integrations</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-[#2CAC58] flex-shrink-0">[✓]</code>
                <span>SLA & compliance</span>
              </div>
            </div>
            
            <button className="w-full border-2 border-[#2CAC58] bg-[#2CAC58]/10 hover:bg-[#2CAC58]/20 px-4 py-3 text-sm font-semibold text-foreground/90 transition-all">
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section className="mt-6 border-2 border-white/20 bg-black/20 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-6 h-6 text-foreground/50" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          <h2 className="text-lg font-semibold text-foreground/80">Open Source Version</h2>
        </div>
        
        <div className="space-y-4 text-sm text-foreground/60">
          <p>
            Deep Wide Research is <strong className="text-foreground/80">completely free and open source</strong>. 
            You can self-host the entire platform and use it without any limitations.
          </p>
          
          <p className="text-xs">
            The cloud version above is for those who prefer a managed service without the hassle of self-hosting.
          </p>
          
          <a 
            href="https://github.com/PuppyAgent/DeepWideResearch" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#2CAC58] hover:bg-[#25994D] px-4 py-2.5 text-sm font-medium text-white transition-all"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <span>View on GitHub</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>
      </main>
      
      <div className="mt-24 md:mt-32" aria-hidden="true" />
      <SiteFooter />
    </div>
  );
}



