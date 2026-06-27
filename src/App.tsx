import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { ProjectIntro } from "./components/ProjectIntro";
import { FeatureGrid } from "./components/FeatureGrid";
import { WorkflowSection } from "./components/WorkflowSection";
import { InterfaceShowcase } from "./components/InterfaceShowcase";
import { TechStackSection } from "./components/TechStackSection";
import { UseCases } from "./components/UseCases";
import { ReleaseSection } from "./components/ReleaseSection";
import { FooterCTA } from "./components/FooterCTA";
import { ClickSparkLayer, CursorGlow } from "./components/MotionPrimitives";

function App() {
  return (
    <>
      <CursorGlow />
      <ClickSparkLayer />
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <Navbar />
      <main>
        <HeroSection />
        <ProjectIntro />
        <FeatureGrid />
        <WorkflowSection />
        <InterfaceShowcase />
        <TechStackSection />
        <UseCases />
        <ReleaseSection />
      </main>
      <FooterCTA />
    </>
  );
}

export default App;
