import SiteHeader from "@/components/landingpage/SiteHeader";
import SiteFooter from "@/components/landingpage/SiteFooter";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open Source Projects & Community",
  description: "Deep Wide Research is an open-source company. Explore our GitHub repositories, contributors, and open-source projects including PuppyChat and Deep Wide Research.",
  alternates: {
    canonical: "https://deepwideresearch.com/opensource",
  },
  openGraph: {
    title: "Open Source Projects & Community - Deep Wide Research",
    description: "Explore our open-source projects and join our community. Star us on GitHub and contribute to enterprise-grade AI research tools.",
    url: "https://deepwideresearch.com/opensource",
    type: "website",
    images: [
      {
        url: "/DWResearch.png",
        width: 1200,
        height: 630,
        alt: "Deep Wide Research Open Source",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Source Projects & Community - Deep Wide Research",
    description: "Explore our open-source projects and join our community. Star us on GitHub and contribute to enterprise-grade AI research tools.",
    creator: "@realGuantum",
    images: ["/DWResearch.png"],
  },
};

export default function OpenSourcePage() {
  return (
    <div className="min-h-screen w-full font-mono bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <header className="border-2 border-white/20 bg-black/20 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/90">Open Source</h1>
          <p className="mt-3 text-sm text-foreground/60">Deep Wide Research is an opensource company, supporting existing open source tools and communities wherever possible.</p>
        </header>

        {/* GitHub CTA Section - Hero */}
        <section className="mt-6 border-2 border-[#2CAC58] bg-gradient-to-br from-[#2CAC58]/10 to-black/20 p-6 md:p-8 relative overflow-hidden">
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #2CAC58 10px, #2CAC58 11px)'
          }} />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-8 h-8 text-[#2CAC58]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <h2 className="text-xl md:text-2xl font-bold text-foreground/90">
                Star us on GitHub
              </h2>
            </div>
            
            <p className="text-sm md:text-base text-foreground/70 mb-6 max-w-2xl">
              Join our community! Star the repository, contribute code, report issues, or fork the project to build your own AI research agent.
            </p>
            
            <a 
              href="https://github.com/PuppyAgent/DeepWideResearch" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-[#2CAC58] hover:bg-[#25994D] px-6 py-3.5 text-base md:text-lg font-semibold text-white transition-all duration-200 shadow-lg shadow-[#2CAC58]/20 hover:shadow-xl hover:shadow-[#2CAC58]/30 hover:scale-105 active:scale-100 mb-6"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            <span>View on GitHub</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
        </section>

        <section className="mt-6 border-2 border-white/20 bg-black/20 p-6 md:p-8">
          <h2 className="text-lg font-semibold text-foreground/90 mb-6">Sponsors</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground/70 mb-3">Supporter</h3>
              <div className="text-sm text-foreground/50">No sponsors yet.</div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground/70 mb-3">Contributor</h3>
              <div className="space-y-2">
                <a href="https://github.com/realGuantum" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 border-2 border-white/20 hover:bg-white/5 transition-all">
                  <img src="https://github.com/realGuantum.png" alt="realGuantum avatar" className="h-8 w-8" />
                  <span className="text-sm text-foreground/80">realGuantum</span>
                  <code className="ml-auto text-xs text-foreground/40">→</code>
                </a>
                <a href="https://github.com/ERerGB" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 border-2 border-white/20 hover:bg-white/5 transition-all">
                  <img src="https://github.com/ERerGB.png" alt="ERerGB avatar" className="h-8 w-8" />
                  <span className="text-sm text-foreground/80">ERerGB</span>
                  <code className="ml-auto text-xs text-foreground/40">→</code>
                </a>
                <a href="https://github.com/HYPERVAPOR" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 border-2 border-white/20 hover:bg-white/5 transition-all">
                  <img src="https://github.com/HYPERVAPOR.png" alt="HYPERVAPOR avatar" className="h-8 w-8" />
                  <span className="text-sm text-foreground/80">HYPERVAPOR</span>
                  <code className="ml-auto text-xs text-foreground/40">→</code>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 border-2 border-white/20 bg-black/20 p-6 md:p-8">
          <h2 className="text-lg font-semibold text-foreground/90 mb-6">Open Source Projects</h2>
          <div className="space-y-3">
            <a
              href="https://github.com/PuppyAgent/PuppyChat"
              target="_blank"
              rel="noopener noreferrer"
              className="block border-2 border-white/20 bg-black/20 p-4 hover:bg-white/5 transition-all"
              aria-label="Open PuppyChat repository on GitHub"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10">
                  {/* Our repo lacks puppychatlogo; reuse DWR logo to avoid 404 */}
                  <Image src="/DWResearch.png" alt="PuppyChat logo" width={32} height={32} className="object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground/90">PuppyChat</div>
                  <p className="mt-1 text-xs text-foreground/60">AI chatbot interfaces SDK in React</p>
                </div>
                <code className="text-xs text-foreground/40">→</code>
              </div>
            </a>
            <a
              href="https://github.com/PuppyAgent/DeepWideResearch"
              target="_blank"
              rel="noopener noreferrer"
              className="block border-2 border-white/20 bg-black/20 p-4 hover:bg-white/5 transition-all"
              aria-label="Open Deep Wide Research repository on GitHub"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10">
                  <Image src="/DWResearch.png" alt="Deep Wide Research logo" width={32} height={32} className="object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground/90">Open Deep Wide Research</div>
                  <p className="mt-1 text-xs text-foreground/60">Enterprise-grade Deep/Wide Research. Open source, MCP-supported, self-hosted.</p>
                </div>
                <code className="text-xs text-foreground/40">→</code>
              </div>
            </a>
          </div>
        </section>
      </main>
      
      <div className="mt-24 md:mt-32" aria-hidden="true" />
      <SiteFooter />
    </div>
  );
}



