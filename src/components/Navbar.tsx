import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import mascotImg from "@/assets/mascot-cutesy.png";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <img src={mascotImg} alt="LocalConnect mascot" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-xl font-display font-semibold text-foreground">
              LocalConnect
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </a>
            <a href="#locals" className="text-muted-foreground hover:text-foreground transition-colors">
              Browse Locals
            </a>
            <a href="#destinations" className="text-muted-foreground hover:text-foreground transition-colors">
              Destinations
            </a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" onClick={() => window.location.href = '/auth'}>Log in</Button>
            <Button onClick={() => window.location.href = '/auth'}>Sign up</Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              <a href="#how-it-works" className="text-foreground py-2" onClick={() => setIsOpen(false)}>How it Works</a>
              <a href="#locals" className="text-foreground py-2" onClick={() => setIsOpen(false)}>Browse Locals</a>
              <a href="#destinations" className="text-foreground py-2" onClick={() => setIsOpen(false)}>Destinations</a>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => window.location.href = '/auth'}>Log in</Button>
                <Button className="flex-1" onClick={() => window.location.href = '/auth'}>Sign up</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;