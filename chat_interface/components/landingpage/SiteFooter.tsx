'use client'
import Image from "next/image";

export default function SiteFooter() {
  return (
    <>
      <div className="w-full border-t border-[#CDCDCD]" />
      <footer className="flex flex-col items-center justify-center px-4 max-w-[1000px] sm:px-[16px] sm:max-w-[100vw] py-8 sm:py-[48px] w-full sm:w-[1000px] mx-auto">
        {/* Tagline */}
        <div className="w-full text-left mb-8">
          <p className="text-[18px] sm:text-[20px] font-medium text-[#CDCDCD] italic" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            making the world friendly for AI agents
          </p>
        </div>

        {/* Bottom: product name + logo, and company copyright */}
        <div className="w-full flex flex-col items-start">
          <div className="flex items-center gap-3 text-left mb-2" style={{ fontFamily: 'Helvetica' }}>
            <Image src="/DWResearch.png" alt="Open Deep Wide Research logo" width={96} height={96} />
            <div className="flex flex-col leading-tight text-[#6D7177]">
              <span className="text-[16px] sm:text-[18px] font-semibold tracking-tight">Open</span>
              <span className="text-[16px] sm:text-[18px] font-semibold tracking-tight">Deep Wide</span>
              <span className="text-[16px] sm:text-[18px] font-semibold tracking-tight">Research</span>
            </div>
          </div>
          <div className="text-left text-[14px] font-normal text-[#6D7177]">
            <p>© {new Date().getFullYear()} PuppyAgent Tech Pte Ltd All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}


