import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import HowItWorks from "@/components/HowItWorks";
import LocalsGrid from "@/components/LocalsGrid";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Categories />
      <HowItWorks />
      <LocalsGrid />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;